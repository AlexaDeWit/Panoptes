import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { vendored } from './studio.fixtures.js';

/** A committed render output as bytes. */
export const exportGolden = (name: string): Buffer =>
  readFileSync(vendored(`test-data/render/${name}`));

/** The digest shared by the CLI and browser PDF checks. */
export const expectedPdfDigest = readFileSync(
  vendored('test-data/render/ecluse.snapshot.pdf.sha256'),
  'utf8',
).trim();

/**
 * The SHA-256 digest of exported bytes, which is how a binary golden is
 * compared: a failed comparison of the buffers themselves is pretty-printed
 * and diffed element by element, which takes minutes on a picture and
 * reports nothing while it runs.
 */
export const digestOf = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

const pageTree = /\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/u;

/** The page count named by a PDF page tree. */
export const pdfPageCount = (pdf: Uint8Array): number => {
  const counted = pageTree.exec(Buffer.from(pdf).toString('latin1'));
  return counted === null ? 0 : Number(counted[1]);
};
