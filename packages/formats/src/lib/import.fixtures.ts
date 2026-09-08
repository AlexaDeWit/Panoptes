import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { otmWireSchema } from '@saerskriven/wire-otm';
import { tmbomWireSchema } from '@saerskriven/wire-tmbom';

/** The upstream examples retain unknown fields to exercise import reports. */
export const importTexts = {
  otm: readFileSync(
    join(import.meta.dirname, '../../../../test-data/otm/example.json'),
    'utf8',
  ),
  tmbom: readFileSync(
    join(import.meta.dirname, '../../../../test-data/tmbom/example.json'),
    'utf8',
  ),
};

/** A fresh OTM example for tests that change source facts. */
export const otmFixture = () =>
  otmWireSchema.parse(JSON.parse(importTexts.otm) as unknown);
/** A fresh TM-BOM example for tests that change source facts. */
export const tmbomFixture = () =>
  tmbomWireSchema.parse(JSON.parse(importTexts.tmbom) as unknown);
