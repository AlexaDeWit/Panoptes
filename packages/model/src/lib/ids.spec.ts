import type { DiagramId, ElementId } from './ids.js';
import {
  diagramIdSchema,
  elementIdSchema,
  generateDiagramId,
  generateElementId,
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

describe('id brands', () => {
  it('keeps element and diagram ids apart at compile time', () => {
    const elementId: ElementId = generateElementId();
    // @ts-expect-error an ElementId is not assignable to a DiagramId
    const misfiled: DiagramId = elementId;
    expect(misfiled).toBe(elementId);
  });
});
