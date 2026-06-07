// Discovery: correlate AcroForm field rectangles with the page's text labels by
// Y position, so we can map opaque field names to 1040 line numbers reliably.
// Run from app/frontend:  node app/api/generate-1040/_lib/dump-geometry.mjs
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { getDocumentProxy } from 'unpdf';

const here = dirname(fileURLToPath(import.meta.url));
const bytes = new Uint8Array(await readFile(join(here, '..', 'f1040-2025.pdf')));

// --- Field rectangles via pdf-lib ---
const doc = await PDFDocument.load(bytes);
const pages = doc.getPages();
const pageRef = pages.map((p) => p.ref);
const form = doc.getForm();

const fields = [];
for (const f of form.getFields()) {
  const type = f.constructor.name;
  for (const w of f.acroField.getWidgets()) {
    const rect = w.getRectangle();
    // find page index by matching the widget's /P ref
    const pRef = w.P();
    let page = pageRef.findIndex((r) => r === pRef);
    if (page < 0) page = 0;
    fields.push({ name: f.getName(), type, page, x: Math.round(rect.x), y: Math.round(rect.y) });
  }
}

// --- Text items via pdfjs (positions) ---
const pdf = await getDocumentProxy(bytes);
const labelsByPage = {};
for (let p = 1; p <= pdf.numPages; p++) {
  const page = await pdf.getPage(p);
  const content = await page.getTextContent();
  labelsByPage[p - 1] = content.items
    .filter((it) => it.str && it.str.trim())
    .map((it) => ({
      x: Math.round(it.transform[4]),
      y: Math.round(it.transform[5]),
      str: it.str.trim(),
    }));
}

// For each amount field (right column, x > 430) on pages 0/1, print the nearest
// text labels on the same row (within 6pt of its y).
for (const pageIdx of [0, 1]) {
  console.log(`\n========== PAGE ${pageIdx + 1} — right-column amount fields ==========`);
  const amts = fields
    .filter((f) => f.page === pageIdx && f.type === 'PDFTextField' && f.x > 430)
    .sort((a, b) => b.y - a.y);
  for (const f of amts) {
    const row = (labelsByPage[pageIdx] || [])
      .filter((l) => Math.abs(l.y - f.y) <= 6 && l.x < 430)
      .sort((a, b) => a.x - b.x)
      .map((l) => l.str)
      .join(' ')
      .slice(0, 90);
    console.log(`${f.name.split('.').pop().padEnd(10)} y=${String(f.y).padEnd(4)} | ${row}`);
  }
}
