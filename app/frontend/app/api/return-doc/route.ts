import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { buildReturnDocKey, presignReturnDoc, returnDocExists } from '@/lib/s3';

// Hands the browser a short-lived presigned GET URL for THIS user's prepared 1040
// (placed in S3 under their prefix and ingested into Moss by the local script).
// The /return PDF viewer loads this URL; the voice agent grounds on the same
// document via Moss. The key is derived server-side from the authenticated
// userId, so each user only ever gets their own return and the client never
// chooses what to fetch.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const key = buildReturnDocKey(userId);
  // 404 (not a broken iframe) if this user has no prepared return yet.
  if (!(await returnDocExists(key))) {
    return new NextResponse('No prepared return found for this user', { status: 404 });
  }

  try {
    const url = await presignReturnDoc(key);
    return NextResponse.json({ url });
  } catch {
    return new NextResponse('Could not prepare the return document', { status: 502 });
  }
}
