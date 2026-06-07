import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { presignUpload } from '@/lib/s3';

// Returns a short-lived presigned POST so the browser can upload a document
// DIRECTLY to S3. The object key is fixed server-side under the authenticated
// user's prefix (users/{userId}/…), so a client can never write outside its own
// namespace — hop #1 of the identity seam.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PresignBody {
  filename?: string;
  contentType?: string;
  docId?: string;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  let body: PresignBody;
  try {
    body = await req.json();
  } catch {
    return new NextResponse('Invalid JSON body', { status: 400 });
  }

  const { filename, contentType, docId } = body;
  if (!filename || !contentType || !docId) {
    return new NextResponse('filename, contentType and docId are required', { status: 400 });
  }

  try {
    const { key, post } = await presignUpload({ userId, docId, filename, contentType });
    return NextResponse.json({ key, url: post.url, fields: post.fields });
  } catch (err) {
    // Disallowed content type (or signing failure) — a client-correctable 400.
    const message = err instanceof Error ? err.message : 'Could not presign upload';
    return new NextResponse(message, { status: 400 });
  }
}
