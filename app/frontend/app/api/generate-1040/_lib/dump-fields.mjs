// One-off discovery tool. Lists every AcroForm field with its IRS-provided
// tooltip (the `TU` entry, e.g. "Line 1a. Total amount from Form(s) W-2..."),
// which is how we map opaque field names (f1_47[0]) to 1040 line numbers.
// Run from app/frontend:  node app/api/generate-1040/_lib/dump-fields.mjs
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, PDFHexString, PDFName, PDFString } from 'pdf-lib';

const here = dirname(fileURLToPath(import.meta.url));
const doc = await PDFDocument.load(await readFile(join(here, '..', 'f1040-2025.pdf')));
const form = doc.getForm();

const decode = (v) => (v instanceof PDFString || v instanceof PDFHexString ? v.decodeText() : '');

for (const f of form.getFields()) {
  const tu = decode(f.acroField.dict.get(PDFName.of('TU')));
  console.log(`${f.constructor.name.padEnd(14)} | ${f.getName()} | ${tu}`);
}
