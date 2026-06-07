// Client-side upload orchestration: the single source of truth for the
// presign -> direct-to-S3 flow used by the upload view. Keeping it here (not
// inline in the component) means the dance and its error handling are tested
// once, in isolation.
//
//   presign (Next)  ->  POST file to S3
//
// Upload just lands the bytes in S3 and returns the key. The prepared 1040 shown
// on /return is a separate document (placed in S3 + ingested into Moss by the
// local script); these uploads aren't parsed by the app.

export interface UploadResult {
  docId: string;
  key: string;
}

interface PresignResponse {
  key: string;
  url: string;
  fields: Record<string, string>;
}

/** Upload one file: presign, then POST directly to S3. Returns its object key. */
export async function uploadFile(docId: string, file: File): Promise<UploadResult> {
  // 1) Ask our server for a presigned POST scoped to this user + document.
  const presignRes = await fetch('/api/uploads/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      // Some browsers leave File.type empty; default to PDF (the common case).
      contentType: file.type || 'application/pdf',
      docId,
    }),
  });
  if (!presignRes.ok) {
    throw new Error((await presignRes.text()) || 'Could not prepare upload');
  }
  const { key, url, fields }: PresignResponse = await presignRes.json();

  // 2) POST the file straight to S3. The file part MUST be appended last.
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append('file', file);
  const s3Res = await fetch(url, { method: 'POST', body: form });
  if (!s3Res.ok) {
    throw new Error(`Upload to storage failed (${s3Res.status})`);
  }

  return { docId, key };
}

export type UploadStatus = 'uploading' | 'done' | 'error';

export interface UploadAllCallbacks {
  concurrency?: number;
  onStatus?: (docId: string, status: UploadStatus, detail?: string) => void;
}

export interface UploadAllOutcome {
  results: UploadResult[];
  errors: Record<string, string>;
}

/**
 * Upload many files concurrently with a small concurrency cap (default 4) so a
 * multi-document submission feels instant without opening dozens of sockets.
 * Never rejects — per-file failures are collected in `errors` so one bad file
 * doesn't sink the rest.
 */
export async function uploadAll(
  files: Record<string, File>,
  { concurrency = 4, onStatus }: UploadAllCallbacks = {}
): Promise<UploadAllOutcome> {
  const entries = Object.entries(files);
  const results: UploadResult[] = [];
  const errors: Record<string, string> = {};
  let next = 0;

  async function worker() {
    while (next < entries.length) {
      const [docId, file] = entries[next++];
      onStatus?.(docId, 'uploading');
      try {
        const result = await uploadFile(docId, file);
        results.push(result);
        onStatus?.(docId, 'done');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        errors[docId] = message;
        onStatus?.(docId, 'error', message);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, entries.length) }, worker);
  await Promise.all(workers);
  return { results, errors };
}
