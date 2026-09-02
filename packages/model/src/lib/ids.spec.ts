import type { DiagramId, ElementId, ThreatId } from './ids.js';
import {
  assumptionIdSchema,
  diagramIdSchema,
  elementIdSchema,
  generateAssumptionId,
  generateDiagramId,
  generateElementId,
  generateMitigationId,
  generateThreatId,
  mitigationIdSchema,
  threatIdSchema,
} from './ids.js';

const twoCharacterMinimum = [
  ['element', elementIdSchema],
  ['threat', threatIdSchema],
  ['mitigation', mitigationIdSchema],
  ['assumption', assumptionIdSchema],
] as const;

describe('id schemas', () => {
  it('pass a foreign id through unchanged', () => {
    const cell = '4e565871-45cc-4987-abba-24859ee2cf60';
    expect(elementIdSchema.parse(cell)).toBe(cell);
    const threat = 'c87367bd-fc3f-4792-94b6-8db459011823';
    expect(threatIdSchema.parse(threat)).toBe(threat);
  });

  it('accept an id that is not a UUID', () => {
    expect(elementIdSchema.safeParse('store::metadata-cache').success).toBe(
      true,
    );
    expect(mitigationIdSchema.safeParse('dredger-consent-tag').success).toBe(
      true,
    );
  });

  it.each(twoCharacterMinimum)(
    'refuse a one-character %s id, which Threat Dragon cannot hold',
    (_kind, schema) => {
      expect(schema.safeParse('7').success).toBe(false);
      expect(schema.safeParse('07').success).toBe(true);
    },
  );

  it('let a diagram id be one character, as Threat Dragon numbers diagrams from zero', () => {
    expect(diagramIdSchema.safeParse('0').success).toBe(true);
    expect(diagramIdSchema.safeParse('').success).toBe(false);
  });
});

describe('id generators', () => {
  it('produce ids their schemas accept', () => {
    expect(elementIdSchema.safeParse(generateElementId()).success).toBe(true);
    expect(diagramIdSchema.safeParse(generateDiagramId()).success).toBe(true);
    expect(threatIdSchema.safeParse(generateThreatId()).success).toBe(true);
    expect(mitigationIdSchema.safeParse(generateMitigationId()).success).toBe(
      true,
    );
    expect(assumptionIdSchema.safeParse(generateAssumptionId()).success).toBe(
      true,
    );
  });
});

describe('id brands', () => {
  it('keeps element and diagram ids apart at compile time', () => {
    const elementId: ElementId = generateElementId();
    // @ts-expect-error an ElementId is not assignable to a DiagramId
    const misfiled: DiagramId = elementId;
    expect(misfiled).toBe(elementId);
  });

  it('keeps element and threat ids apart at compile time', () => {
    const elementId: ElementId = generateElementId();
    // @ts-expect-error an ElementId is not assignable to a ThreatId
    const misfiled: ThreatId = elementId;
    expect(misfiled).toBe(elementId);
  });
});
