// Persist the generated 1040: upload it to S3 under the signed-in user's prefix
// and index it (Unsiloed -> Moss) via the EXISTING agent ingest service, so the
// voice CPA can ground on the finished return — the same seam used for uploaded
// source docs (/api/uploads/complete -> agent /ingest).
//
// Everything here is best-effort and lazily imported: when the user isn't signed
// in or S3/ingest aren't configured (e.g. unit tests), it degrades to a warning
// and the caller still returns the generated PDF. Lazy imports also keep
// `server-only`/Clerk/AWS out of the module graph for the non-request paths.

export interface PersistOutcome {
  s3Key: string | null;
  indexed: boolean;
  warnings: string[];
}

async function currentUserId(): Promise<string | null> {
  try {
    const { auth } = await import('@clerk/nextjs/server');
    const { userId } = await auth();
    return userId ?? null;
  } catch {
    return null;
  }
}

async function triggerIndex(s3Key: string, userId: string): Promise<boolean> {
  const url = process.env.AGENT_INGEST_URL;
  const secret = process.env.AGENT_INGEST_SECRET;
  if (!url || !secret) return false;
  const res = await fetch(`${url}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Ingest-Secret': secret },
    body: JSON.stringify({
      s3_key: s3Key,
      user_id: userId,
      doc_id: 'generated-1040',
      source: 'generated-1040',
    }),
    signal: AbortSignal.timeout(10000),
  });
  return res.ok;
}

export async function persistGenerated1040(pdfBytes: Uint8Array): Promise<PersistOutcome> {
  const warnings: string[] = [];

  const userId = await currentUserId();
  if (!userId) {
    warnings.push(
      'Not signed in (or Clerk unavailable) — skipped S3 upload + indexing of the generated 1040.'
    );
    return { s3Key: null, indexed: false, warnings };
  }

  let s3Key: string;
  try {
    const { buildGeneratedKey, putObject } = await import('@/lib/s3');
    s3Key = buildGeneratedKey(userId);
    await putObject(s3Key, pdfBytes, 'application/pdf');
  } catch (err) {
    warnings.push(
      `Could not upload the generated 1040 to S3 (${err instanceof Error ? err.message : 'unknown error'}); not indexed.`
    );
    return { s3Key: null, indexed: false, warnings };
  }

  let indexed = false;
  try {
    indexed = await triggerIndex(s3Key, userId);
    if (!indexed) {
      warnings.push(
        'Generated 1040 uploaded to S3, but the ingest service is unavailable/unconfigured — not indexed.'
      );
    }
  } catch (err) {
    warnings.push(
      `Generated 1040 uploaded to S3 but indexing failed (${err instanceof Error ? err.message : 'unknown error'}).`
    );
  }

  return { s3Key, indexed, warnings };
}
