import { randomUUID } from 'node:crypto';
// eslint-disable-next-line import/no-unresolved -- `server-only` ships an exports map the import resolver can't follow; it resolves fine at build/runtime.
import 'server-only';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { type PresignedPost, createPresignedPost } from '@aws-sdk/s3-presigned-post';

// Server-only S3 helpers for the document-upload flow. The browser uploads
// DIRECTLY to S3 with a short-lived presigned POST policy that this module signs
// — bytes never transit the Next server. The policy is the security boundary:
// the server fixes the object key under the caller's own user prefix and caps
// size + type, so a client cannot write outside `users/{theirUserId}/…`.

const REGION = process.env.AWS_REGION ?? 'us-west-2';
const BUCKET = process.env.S3_UPLOAD_BUCKET ?? 'moss-yc-hackathon-docs';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB — typical tax PDFs are well under this
export const PRESIGN_TTL_SECONDS = 300; // 5 min
export const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
] as const;

let _client: S3Client | null = null;
function client(): S3Client {
  // Lazily construct so importing this module (e.g. in unit tests) doesn't
  // require AWS credentials until an actual presign is requested.
  if (!_client) _client = new S3Client({ region: REGION });
  return _client;
}

/** Lowercase, strip anything but [a-z0-9.-], collapse/trim dashes, cap length. */
export function slugify(value: string, fallback = 'file'): string {
  const s = value
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return s || fallback;
}

/**
 * Build the S3 key for an upload. Shape: `users/{userId}/{docId}/{uuid}-{name}`.
 * The userId comes from the server (Clerk) — never the client — and the random
 * uuid prevents collisions / overwrites across re-uploads of the same slot.
 */
export function buildUploadKey(userId: string, docId: string, filename: string): string {
  return `users/${userId}/${slugify(docId, 'doc')}/${randomUUID()}-${slugify(filename)}`;
}

export function isAllowedContentType(contentType: string): boolean {
  return (ALLOWED_CONTENT_TYPES as readonly string[]).includes(contentType);
}

export interface PresignParams {
  userId: string;
  docId: string;
  filename: string;
  contentType: string;
}

/**
 * Create a presigned POST scoped to this user. Conditions enforce:
 *  - the object key stays under `users/{userId}/` (identity seam, hop #1)
 *  - 1..MAX_UPLOAD_BYTES content length
 *  - exact Content-Type (added automatically from Fields)
 * Throws on a disallowed content type so the route returns 400 before signing.
 */
export async function presignUpload({
  userId,
  docId,
  filename,
  contentType,
}: PresignParams): Promise<{ key: string; post: PresignedPost }> {
  if (!isAllowedContentType(contentType)) {
    throw new Error(`Unsupported file type: ${contentType || 'unknown'}`);
  }
  const key = buildUploadKey(userId, docId, filename);
  const post = await createPresignedPost(client(), {
    Bucket: BUCKET,
    Key: key,
    Conditions: [
      ['content-length-range', 1, MAX_UPLOAD_BYTES],
      ['starts-with', '$key', `users/${userId}/`],
    ],
    Fields: { 'Content-Type': contentType },
    Expires: PRESIGN_TTL_SECONDS,
  });
  return { key, post };
}

/**
 * Key for a server-generated artifact (e.g. the filled 1040). Lives under the
 * user's own prefix in a dedicated `generated/` folder so the same per-user
 * retrieval filter and ingest seam apply as for uploaded source docs.
 */
export function buildGeneratedKey(userId: string, filename = '1040.pdf'): string {
  return `users/${userId}/generated/${randomUUID()}-${slugify(filename)}`;
}

/**
 * Upload bytes to S3 from the server (used for the generated 1040 — the browser
 * never holds these bytes, so the presigned-POST path doesn't apply here).
 */
export async function putObject(
  key: string,
  body: Uint8Array,
  contentType = 'application/pdf'
): Promise<void> {
  await client().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}
