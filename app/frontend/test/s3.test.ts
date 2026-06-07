import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ALLOWED_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
  buildUploadKey,
  isAllowedContentType,
  presignUpload,
  slugify,
} from '@/lib/s3';

// server-only throws outside a Server Component bundler — neutralize for tests.
vi.mock('server-only', () => ({}));
vi.mock('@aws-sdk/client-s3', () => ({ S3Client: class {} }));

const createPresignedPost = vi.fn();
vi.mock('@aws-sdk/s3-presigned-post', () => ({
  createPresignedPost: (...args: unknown[]) => createPresignedPost(...args),
}));

describe('slugify', () => {
  it('lowercases, strips unsafe chars, trims dashes', () => {
    expect(slugify('My File (1).PDF')).not.toMatch(/[^a-z0-9.\-]/);
    expect(slugify('My File (1).PDF')).toContain('.pdf');
    expect(slugify('   ')).toBe('file'); // empty -> fallback
    expect(slugify('', 'doc')).toBe('doc');
  });
});

describe('buildUploadKey', () => {
  it('scopes the key under the raw userId and slugs doc + filename', () => {
    const key = buildUploadKey('user_2abcXYZ', 'w2', 'W-2 Form.pdf');
    expect(key.startsWith('users/user_2abcXYZ/w2/')).toBe(true);
    expect(key).toMatch(/users\/user_2abcXYZ\/w2\/[0-9a-f-]{36}-w-2-form\.pdf$/);
  });

  it('never lets a doc id inject path segments to escape the prefix', () => {
    // Slashes are stripped, so a traversal-looking doc id stays one flat segment
    // under users/u1/ — exactly 4 segments: users / u1 / doc / file.
    const key = buildUploadKey('u1', '../../etc', 'x.pdf');
    expect(key.startsWith('users/u1/')).toBe(true);
    expect(key.split('/')).toHaveLength(4);
  });
});

describe('isAllowedContentType', () => {
  it('accepts the allow-list and rejects others', () => {
    for (const t of ALLOWED_CONTENT_TYPES) expect(isAllowedContentType(t)).toBe(true);
    expect(isAllowedContentType('text/html')).toBe(false);
    expect(isAllowedContentType('')).toBe(false);
  });
});

describe('presignUpload', () => {
  beforeEach(() => createPresignedPost.mockReset());

  it('rejects a disallowed content type before signing', async () => {
    await expect(
      presignUpload({ userId: 'u1', docId: 'w2', filename: 'x.html', contentType: 'text/html' })
    ).rejects.toThrow(/Unsupported file type/);
    expect(createPresignedPost).not.toHaveBeenCalled();
  });

  it('signs with a user-prefix condition + size cap', async () => {
    createPresignedPost.mockResolvedValue({
      url: 'https://bucket.s3.amazonaws.com',
      fields: { key: 'users/u1/w2/uuid-a.pdf', 'Content-Type': 'application/pdf' },
    });
    const { key, post } = await presignUpload({
      userId: 'u1',
      docId: 'w2',
      filename: 'a.pdf',
      contentType: 'application/pdf',
    });
    expect(key.startsWith('users/u1/w2/')).toBe(true);
    expect(post.url).toContain('s3');

    const params = createPresignedPost.mock.calls[0][1] as {
      Conditions: unknown[];
      Fields: Record<string, string>;
    };
    expect(params.Conditions).toContainEqual(['starts-with', '$key', 'users/u1/']);
    expect(params.Conditions).toContainEqual(['content-length-range', 1, MAX_UPLOAD_BYTES]);
    expect(params.Fields['Content-Type']).toBe('application/pdf');
  });
});
