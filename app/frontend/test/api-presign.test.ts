import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/uploads/presign/route';

const authMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ auth: () => authMock() }));

const presignUpload = vi.fn();
vi.mock('@/lib/s3', () => ({ presignUpload: (...a: unknown[]) => presignUpload(...a) }));

function req(body: unknown) {
  return new Request('http://localhost/api/uploads/presign', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  authMock.mockReset();
  presignUpload.mockReset();
});

describe('POST /api/uploads/presign', () => {
  it('401 when signed out', async () => {
    authMock.mockResolvedValue({ userId: null });
    const r = await POST(req({ filename: 'a.pdf', contentType: 'application/pdf', docId: 'w2' }));
    expect(r.status).toBe(401);
  });

  it('400 when required fields are missing', async () => {
    authMock.mockResolvedValue({ userId: 'u1' });
    expect((await POST(req({}))).status).toBe(400);
    expect((await POST(req({ filename: 'a.pdf' }))).status).toBe(400);
  });

  it('returns the presigned post for the authed user', async () => {
    authMock.mockResolvedValue({ userId: 'u1' });
    presignUpload.mockResolvedValue({
      key: 'users/u1/w2/uuid-a.pdf',
      post: { url: 'https://s3.test', fields: { key: 'users/u1/w2/uuid-a.pdf' } },
    });
    const r = await POST(req({ filename: 'a.pdf', contentType: 'application/pdf', docId: 'w2' }));
    expect(r.status).toBe(200);
    const json = await r.json();
    expect(json.key).toBe('users/u1/w2/uuid-a.pdf');
    expect(json.url).toBe('https://s3.test');
    // Identity comes from the session, not the client.
    expect(presignUpload).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', docId: 'w2' })
    );
  });

  it('400 when the file type is unsupported', async () => {
    authMock.mockResolvedValue({ userId: 'u1' });
    presignUpload.mockRejectedValue(new Error('Unsupported file type: text/html'));
    const r = await POST(req({ filename: 'x.html', contentType: 'text/html', docId: 'w2' }));
    expect(r.status).toBe(400);
  });
});
