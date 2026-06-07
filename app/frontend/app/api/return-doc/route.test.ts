import { beforeEach, describe, expect, it, vi } from 'vitest';

// Returns a presigned GET URL for THIS user's prepared 1040 in S3. We mock auth()
// and the s3 helpers so the route's auth + per-user key derivation + existence
// gating are tested without AWS.
const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({ auth: mockAuth }));

const { mockBuildKey, mockExists, mockPresign } = vi.hoisted(() => ({
  mockBuildKey: vi.fn(),
  mockExists: vi.fn(),
  mockPresign: vi.fn(),
}));
vi.mock('@/lib/s3', () => ({
  buildReturnDocKey: mockBuildKey,
  returnDocExists: mockExists,
  presignReturnDoc: mockPresign,
}));

beforeEach(() => {
  mockAuth.mockReset().mockResolvedValue({ userId: 'u1' });
  mockBuildKey.mockReset().mockImplementation((id: string) => `users/${id}/return/1040.pdf`);
  mockExists.mockReset().mockResolvedValue(true);
  mockPresign.mockReset().mockResolvedValue('https://s3.test/1040.pdf?sig=abc');
});

async function get() {
  const { GET } = await import('./route');
  return GET();
}

describe('GET /api/return-doc', () => {
  it('rejects an unauthenticated request with 401', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });
    expect((await get()).status).toBe(401);
  });

  it("presigns the signed-in user's own 1040 key", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect((await res.json()).url).toBe('https://s3.test/1040.pdf?sig=abc');
    expect(mockBuildKey).toHaveBeenCalledWith('u1');
    expect(mockPresign).toHaveBeenCalledWith('users/u1/return/1040.pdf');
  });

  it('404s when this user has no prepared return', async () => {
    mockExists.mockResolvedValue(false);
    expect((await get()).status).toBe(404);
    expect(mockPresign).not.toHaveBeenCalled();
  });

  it('502s when presigning fails', async () => {
    mockPresign.mockRejectedValue(new Error('s3 down'));
    expect((await get()).status).toBe(502);
  });
});
