import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// Called by the browser AFTER a successful direct-to-S3 upload. Triggers the
// agent-py ingest service (Unsiloed parse -> Moss) so the document becomes
// retrievable by the voice agent. The Clerk userId — not any client value — is
// what we forward as the ingest identity, keeping the whole seam on one id.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CompleteBody {
  key?: string;
  docId?: string;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  let body: CompleteBody;
  try {
    body = await req.json();
  } catch {
    return new NextResponse('Invalid JSON body', { status: 400 });
  }

  const { key, docId } = body;
  if (!key || !docId) {
    return new NextResponse('key and docId are required', { status: 400 });
  }

  // The key must belong to THIS user. Never trust a client-supplied user id —
  // derive identity from the Clerk session and verify the key prefix matches.
  if (!key.startsWith(`users/${userId}/`)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const agentIngestUrl = process.env.AGENT_INGEST_URL;
  const agentIngestSecret = process.env.AGENT_INGEST_SECRET;
  if (!agentIngestUrl || !agentIngestSecret) {
    return new NextResponse('Ingest service is not configured', { status: 500 });
  }

  let res: Response;
  try {
    res = await fetch(`${agentIngestUrl}/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Shared-secret trust boundary — the agent rejects calls without this.
        'X-Ingest-Secret': agentIngestSecret,
      },
      body: JSON.stringify({ s3_key: key, user_id: userId, doc_id: docId, source: docId }),
    });
  } catch {
    return new NextResponse('Could not reach ingest service', { status: 502 });
  }

  if (!res.ok) {
    return new NextResponse('Ingest trigger failed', { status: 502 });
  }

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: 202 });
}
