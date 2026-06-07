import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// The route guards on NODE_ENV === 'development'; ensure that, and ensure no
// Qwen key so we exercise the deterministic (no-extraction) pipeline path.
beforeAll(() => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('QWEN_API_KEY', '');
  vi.stubEnv('DASHSCOPE_API_KEY', '');
});
afterAll(() => {
  vi.unstubAllEnvs();
});

async function post(parts: { bytes: Uint8Array; name: string; docId: string }[]) {
  const { POST } = await import('./route');
  const fd = new FormData();
  for (const p of parts) {
    fd.append('files', new File([p.bytes as BlobPart], p.name, { type: 'application/pdf' }));
    fd.append('docIds', p.docId);
  }
  const req = new Request('http://localhost/api/generate-1040', { method: 'POST', body: fd });
  return POST(req);
}

describe('POST /api/generate-1040', () => {
  it('bypasses when no files are uploaded', async () => {
    const res = await post([]);
    const data = await res.json();
    expect(data.bypassed).toBe(true);
  });

  it('runs the full pipeline and returns a filled IRS PDF', async () => {
    // Use the vendored template as a stand-in "uploaded" text PDF.
    const tpl = new Uint8Array(
      await readFile(join(process.cwd(), 'app/api/generate-1040/f1040-2025.pdf'))
    );
    const res = await post([{ bytes: tpl, name: 'sample.pdf', docId: 'w2' }]);
    const data = await res.json();

    expect(data.bypassed).toBe(false);
    expect(typeof data.pdfBase64).toBe('string');
    expect(data.pdfBase64.length).toBeGreaterThan(1000);
    expect(data.summary.taxYear).toBe(2025);
    // Deterministic regardless of extraction: the 2025 standard deduction is applied.
    expect(data.summary.standardDeduction).toBe(15750);
    expect(Array.isArray(data.warnings)).toBe(true);
    // No key configured -> extraction is skipped with an explanatory warning.
    expect(data.warnings.join(' ')).toMatch(/QWEN_API_KEY/i);
  });
});
