import { NextResponse } from 'next/server';
import { aggregate, computeForm1040, summarize } from './_lib/compute';
import { type UploadedDoc, extractDocuments } from './_lib/extract';
import { fillForm1040 } from './_lib/fill-1040';
import { persistGenerated1040 } from './_lib/persist';
import { redactPdf } from './_lib/redact';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FILES = 20;
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB/file

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return new NextResponse(
      'THIS API ROUTE IS INSECURE. DO NOT USE IN PRODUCTION WITHOUT AN AUTH LAYER.',
      { status: 403 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data.' }, { status: 400 });
  }

  const warnings: string[] = [];
  const docs: UploadedDoc[] = [];
  const fileEntries = formData.getAll('files');
  const docIds = formData.getAll('docIds').map(String);

  for (const entry of fileEntries) {
    if (!(entry instanceof File)) continue;
    if (docs.length >= MAX_FILES) {
      warnings.push(`More than ${MAX_FILES} files uploaded — extras ignored.`);
      break;
    }
    if (entry.size > MAX_BYTES) {
      warnings.push(`"${entry.name}" exceeds 15 MB and was skipped.`);
      continue;
    }
    const isPdf = entry.type === 'application/pdf' || entry.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      warnings.push(`"${entry.name}" is not a PDF and was skipped.`);
      continue;
    }
    docs.push({
      docId: docIds[docs.length] ?? 'unknown',
      name: entry.name,
      bytes: new Uint8Array(await entry.arrayBuffer()),
    });
  }

  // BYPASS: nothing usable uploaded.
  if (docs.length === 0) {
    return NextResponse.json({ bypassed: true, warnings });
  }

  try {
    const { result, warnings: exWarnings } = await extractDocuments(docs);
    warnings.push(...exWarnings);

    const inputs = aggregate(result.documents, {
      taxpayerName: result.taxpayerName,
      filingStatusGuess: result.filingStatusGuess,
    });
    const form1040 = computeForm1040(inputs);
    const pdfBytes = await fillForm1040(form1040);
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
    const summary = summarize(form1040, result.documents.length);

    // Upload the finished 1040 to S3 and index it (Unsiloed -> Moss) via the
    // existing ingest service, so the voice CPA can ground on the return.
    // Best-effort: failures degrade to warnings; the PDF is still returned.
    const persisted = await persistGenerated1040(pdfBytes);
    warnings.push(...persisted.warnings);

    // Visually redact the uploaded document (SSN / account & routing / EIN) for
    // safe on-screen preview in the demo. Display-only; Moss keeps the raw text.
    let redactedDocBase64: string | null = null;
    try {
      const { bytes: redacted, count } = await redactPdf(docs[0].bytes);
      const b64 = Buffer.from(redacted).toString('base64');
      if (b64.length <= 3_500_000) {
        redactedDocBase64 = b64;
      } else {
        warnings.push(
          'Uploaded document is large — skipped the redacted preview; showing the generated 1040.'
        );
      }
      if (count === 0) {
        warnings.push('No SSN/account/EIN patterns found to redact in the uploaded document.');
      }
    } catch (err) {
      warnings.push(
        `Could not build a redacted preview of the uploaded document (${err instanceof Error ? err.message : 'unknown error'}).`
      );
    }

    return NextResponse.json({
      bypassed: false,
      summary,
      pdfBase64,
      redactedDocBase64,
      s3Key: persisted.s3Key,
      indexed: persisted.indexed,
      warnings,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate 1040.', warnings },
      { status: 500 }
    );
  }
}
