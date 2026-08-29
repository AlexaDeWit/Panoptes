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

describe('elementIdSchema', () => {
  it('passes a Threat Dragon cell id through unchanged', () => {
    const foreign = '4e565871-45cc-4987-abba-24859ee2cf60';
    expect(elementIdSchema.parse(foreign)).toBe(foreign);
  });

  it('accepts an id that is not a UUID', () => {
    expect(elementIdSchema.safeParse('store::metadata-cache').success).toBe(
      true,
    );
  });

  it('rejects the empty string', () => {
    expect(elementIdSchema.safeParse('').success).toBe(false);
  });
});

describe('diagramIdSchema', () => {
  it('accepts any non-empty string', () => {
    expect(diagramIdSchema.safeParse('high-level').success).toBe(true);
  });

  it('rejects the empty string', () => {
    expect(diagramIdSchema.safeParse('').success).toBe(false);
  });
});

describe('threatIdSchema', () => {
  it('passes an Écluse threat id through unchanged', () => {
    const foreign = 'c87367bd-fc3f-4792-94b6-8db459011823';
    expect(threatIdSchema.parse(foreign)).toBe(foreign);
  });

  it('rejects the empty string', () => {
    expect(threatIdSchema.safeParse('').success).toBe(false);
  });
});

describe('mitigationIdSchema', () => {
  it('accepts any non-empty string', () => {
    expect(mitigationIdSchema.safeParse('dredger-consent-tag').success).toBe(
      true,
    );
  });

  it('rejects the empty string', () => {
    expect(mitigationIdSchema.safeParse('').success).toBe(false);
  });
});

describe('assumptionIdSchema', () => {
  it('accepts any non-empty string', () => {
    expect(assumptionIdSchema.safeParse('osv-is-trusted').success).toBe(true);
  });

  it('rejects the empty string', () => {
    expect(assumptionIdSchema.safeParse('').success).toBe(false);
  });
});

describe('generateElementId', () => {
  it('produces an id the schema accepts', () => {
    expect(elementIdSchema.safeParse(generateElementId()).success).toBe(true);
  });
});

describe('generateDiagramId', () => {
  it('produces an id the schema accepts', () => {
    expect(diagramIdSchema.safeParse(generateDiagramId()).success).toBe(true);
  });
});

describe('generateThreatId', () => {
  it('produces an id the schema accepts', () => {
    expect(threatIdSchema.safeParse(generateThreatId()).success).toBe(true);
  });
});

describe('generateMitigationId', () => {
  it('produces an id the schema accepts', () => {
    expect(mitigationIdSchema.safeParse(generateMitigationId()).success).toBe(
      true,
    );
  });
});

describe('generateAssumptionId', () => {
  it('produces an id the schema accepts', () => {
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
