import { extractText, getDocumentProxy } from 'unpdf';
import { ExtractionSchema, type ExtractionResult } from './schema';

export interface UploadedDoc {
  docId: string; // user-claimed type, e.g. "w2"
  name: string; // original filename
  bytes: Uint8Array;
}

export interface ExtractOutcome {
  result: ExtractionResult;
  warnings: string[];
}

const MIN_TEXT_CHARS = 40; // below this we treat a PDF as scanned/unreadable
const EMPTY: ExtractionResult = { documents: [], taxpayerName: null, filingStatusGuess: null };

const JSON_SHAPE = `{
  "documents": [
    {
      "formType": "one of: W-2, 1099-INT, 1099-DIV, 1099-B, 1099-R, 1099-G, SSA-1099, 1040-prior, unknown",
      "sourceLabel": "employer/payer name or null",
      "wages": "number or null (W-2 box 1)",
      "fedWithholding": "number or null (W-2 box 2 / 1099 federal tax withheld)",
      "interestIncome": "number or null (1099-INT box 1)",
      "ordinaryDividends": "number or null (1099-DIV box 1a)",
      "qualifiedDividends": "number or null (1099-DIV box 1b)",
      "capitalGain": "number or null (1099-B realized gain/loss)",
      "otherIncome": "number or null",
      "notes": "string or null"
    }
  ],
  "taxpayerName": "string or null",
  "filingStatusGuess": "one of: single, married_joint, married_separate, head_of_household, or null"
}`;

const SYSTEM_PROMPT = `You are a meticulous US tax-document transcription engine for tax year 2025.
You receive the extracted text of one or more tax documents, each delimited and tagged with the type the user claims it is.
For each document, identify the actual form type and transcribe ONLY the literal box values.
NEVER calculate, infer, sum, or estimate. Strip "$" and commas; output plain numbers (not strings). If a value is not present, use null.
If a block is not a recognizable tax form, set formType "unknown". Return one entry per distinct form found (e.g. two W-2s -> two entries).
Report the taxpayer's name, and only if clearly determinable (e.g. from a prior-year 1040) a filingStatusGuess; otherwise null.
Return ONLY a JSON object with exactly this shape (no markdown, no commentary):
${JSON_SHAPE}`;

function apiKey(): string {
  return process.env.QWEN_API_KEY ?? process.env.DASHSCOPE_API_KEY ?? '';
}

function baseUrl(): string {
  return (
    process.env.QWEN_BASE_URL ?? 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
  ).replace(/\/$/, '');
}

async function readPdfText(bytes: Uint8Array): Promise<string> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: true });
    return (Array.isArray(text) ? text.join('\n') : text).trim();
  } catch {
    return '';
  }
}

async function callQwen(prompt: string): Promise<unknown> {
  const res = await fetch(`${baseUrl()}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: process.env.QWEN_MODEL ?? 'qwen-plus',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    }),
  });
  if (!res.ok) {
    throw new Error(`DashScope ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? '';
  return JSON.parse(content);
}

export async function extractDocuments(docs: UploadedDoc[]): Promise<ExtractOutcome> {
  const warnings: string[] = [];
  const readable: { docId: string; name: string; text: string }[] = [];

  for (const d of docs) {
    const text = await readPdfText(d.bytes);
    if (text.length < MIN_TEXT_CHARS) {
      warnings.push(
        `"${d.name}" looks scanned or image-only — couldn't read its text, so it was not included.`,
      );
      continue;
    }
    readable.push({ docId: d.docId, name: d.name, text });
  }

  if (readable.length === 0) {
    return { result: EMPTY, warnings };
  }

  if (!apiKey()) {
    warnings.push(
      'No QWEN_API_KEY configured — returning empty extraction (the form will compute from zeros).',
    );
    return { result: EMPTY, warnings };
  }

  const prompt = readable
    .map(
      (d, i) =>
        `=== DOCUMENT ${i + 1} (user labeled: ${d.docId}, file: ${d.name}) ===\n${d.text}`,
    )
    .join('\n\n');

  try {
    const raw = await callQwen(prompt);
    const parsed = ExtractionSchema.safeParse(raw);
    if (parsed.success) {
      return { result: parsed.data, warnings };
    }
    warnings.push('Extraction returned an unexpected shape; the form was computed from zeros.');
    return { result: EMPTY, warnings };
  } catch (err) {
    warnings.push(
      `Extraction model call failed (${err instanceof Error ? err.message : 'unknown error'}); the form was computed from zeros.`,
    );
    return { result: EMPTY, warnings };
  }
}
