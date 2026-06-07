import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadAll, uploadFile } from '@/lib/uploads';

// A tiny Response-like helper for mocking fetch.
function res(ok: boolean, body: unknown = {}, status = ok ? 200 : 400) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as Response;
}

const PRESIGN = {
  key: 'users/u1/w2/uuid-a.pdf',
  url: 'https://s3.test/upload',
  fields: { key: 'users/u1/w2/uuid-a.pdf' },
};

function file(name = 'a.pdf') {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'application/pdf' });
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

// Route each call by URL so the three-step flow is explicit.
function wire({
  presign = res(true, PRESIGN),
  s3 = res(true),
  complete = res(true, { job_id: 'job_1' }),
} = {}) {
  fetchMock.mockImplementation((url: string) => {
    if (url.includes('/api/uploads/presign')) return Promise.resolve(presign);
    if (url === PRESIGN.url) return Promise.resolve(s3);
    if (url.includes('/api/uploads/complete')) return Promise.resolve(complete);
    throw new Error(`unexpected fetch: ${url}`);
  });
}

describe('uploadFile', () => {
  it('presigns, posts to S3, completes, and returns the job id', async () => {
    wire();
    const result = await uploadFile('w2', file());
    expect(result).toEqual({ docId: 'w2', key: PRESIGN.key, jobId: 'job_1' });
    // S3 POST must send multipart with the file part last.
    const s3Call = fetchMock.mock.calls.find((c) => c[0] === PRESIGN.url)!;
    expect(s3Call[1].method).toBe('POST');
    expect(s3Call[1].body).toBeInstanceOf(FormData);
  });

  it('throws if presign fails', async () => {
    wire({ presign: res(false, 'Unsupported file type') });
    await expect(uploadFile('w2', file())).rejects.toThrow(/Unsupported file type/);
  });

  it('throws if the S3 upload fails', async () => {
    wire({ s3: res(false, '', 403) });
    await expect(uploadFile('w2', file())).rejects.toThrow(/storage failed \(403\)/);
  });

  it('throws if completion (ingest trigger) fails', async () => {
    wire({ complete: res(false, 'Ingest trigger failed', 502) });
    await expect(uploadFile('w2', file())).rejects.toThrow(/Ingest trigger failed/);
  });
});

describe('uploadAll', () => {
  it('collects results and per-file errors without rejecting', async () => {
    // w2 succeeds; 1099int fails at the S3 step.
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes('/api/uploads/presign')) {
        const body = JSON.parse(init!.body as string);
        return Promise.resolve(res(true, { ...PRESIGN, key: `users/u1/${body.docId}/uuid-a.pdf` }));
      }
      if (url === PRESIGN.url) {
        // Fail the second file's S3 upload.
        return Promise.resolve(uploadAllState.failNextS3 ? res(false, '', 500) : res(true));
      }
      if (url.includes('/api/uploads/complete')) return Promise.resolve(res(true, { job_id: 'j' }));
      throw new Error(`unexpected: ${url}`);
    });

    const statuses: Array<[string, string]> = [];
    const { results, errors } = await uploadAll(
      { w2: file('w2.pdf'), '1099int': file('int.pdf') },
      {
        concurrency: 1,
        onStatus: (docId, status) => {
          statuses.push([docId, status]);
          if (docId === 'w2' && status === 'done') uploadAllState.failNextS3 = true;
        },
      }
    );

    expect(results.map((r) => r.docId)).toContain('w2');
    expect(Object.keys(errors)).toContain('1099int');
    expect(statuses).toContainEqual(['w2', 'uploading']);
    expect(statuses).toContainEqual(['1099int', 'error']);
  });
});

// Small mutable flag used by the uploadAll test's fetch impl.
const uploadAllState = { failNextS3: false };
beforeEach(() => {
  uploadAllState.failNextS3 = false;
});
