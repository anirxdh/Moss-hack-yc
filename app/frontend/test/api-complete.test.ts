import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/uploads/complete/route';

const authMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ auth: () => authMock() }));

function req(body: unknown) {
  return new Request('http://localhost/api/uploads/complete', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  authMock.mockReset();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  process.env.AGENT_INGEST_URL = 'http://agent.test:8000';
  process.env.AGENT_INGEST_SECRET = 'shh';
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.AGENT_INGEST_URL;
  delete process.env.AGENT_INGEST_SECRET;
});

describe('POST /api/uploads/complete', () => {
  it('401 when signed out', async () => {
    authMock.mockResolvedValue({ userId: null });
    expect((await POST(req({ key: 'users/u1/w2/x.pdf', docId: 'w2' }))).status).toBe(401);
  });

  it('400 when fields missing', async () => {
    authMock.mockResolvedValue({ userId: 'u1' });
    expect((await POST(req({}))).status).toBe(400);
  });

  it('403 when the key is not under the caller’s prefix', async () => {
    authMock.mockResolvedValue({ userId: 'u1' });
    const r = await POST(req({ key: 'users/someone-else/w2/x.pdf', docId: 'w2' }));
    expect(r.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('500 when the ingest service is not configured', async () => {
    delete process.env.AGENT_INGEST_URL;
    authMock.mockResolvedValue({ userId: 'u1' });
    expect((await POST(req({ key: 'users/u1/w2/x.pdf', docId: 'w2' }))).status).toBe(500);
  });

  it('forwards to the agent with the shared secret and returns 202', async () => {
    authMock.mockResolvedValue({ userId: 'u1' });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ job_id: 'job_9' }) } as Response);

    const r = await POST(req({ key: 'users/u1/w2/uuid-x.pdf', docId: 'w2' }));
    expect(r.status).toBe(202);
    expect(await r.json()).toEqual({ job_id: 'job_9' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://agent.test:8000/ingest');
    expect(init.headers['X-Ingest-Secret']).toBe('shh');
    const sent = JSON.parse(init.body);
    // The server supplies the identity — user_id is the Clerk id, never client-set.
    expect(sent).toMatchObject({ s3_key: 'users/u1/w2/uuid-x.pdf', user_id: 'u1', doc_id: 'w2' });
  });

  it('502 when the agent call fails', async () => {
    authMock.mockResolvedValue({ userId: 'u1' });
    fetchMock.mockResolvedValue({ ok: false } as Response);
    expect((await POST(req({ key: 'users/u1/w2/x.pdf', docId: 'w2' }))).status).toBe(502);
  });
});
