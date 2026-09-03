import { severitySchema } from '@panoptes/model';
import { renderToStaticMarkup } from 'react-dom/server';
import { everyGlyphModel } from './canvas.fixtures.js';
import { layoutDiagram } from './layout.js';
import { DiagramGlyphs } from './scene.js';
import {
  canvasClassNames,
  canvasStylesheet,
  severityToneClass,
  wrappedTextStyles,
} from './stylesheet.js';

const declared = new Set<string>(Object.values(canvasClassNames));

const selected = new Set<string>(
  (canvasStylesheet.match(/\.[A-Za-z][\w-]*/gu) ?? []).map((token) =>
    token.slice(1),
  ),
);

const emitted = new Set<string>(
  (
    renderToStaticMarkup(
      <DiagramGlyphs
        layout={layoutDiagram(everyGlyphModel.diagrams[0], everyGlyphModel)}
      />,
    ).match(/class="[^"]*"/gu) ?? []
  ).flatMap((attribute) => attribute.slice(7, -1).split(' ')),
);

describe('canvasStylesheet', () => {
  it('styles every class name the map declares', () => {
    expect(selected).toEqual(declared);
  });

  it('styles no class name the primitives never emit', () => {
    expect(selected).toEqual(emitted);
  });

  it('renders each run of text at the size its wrap estimates with', () => {
    const mismatched = Object.values(wrappedTextStyles).filter((rule) => {
      const block = canvasStylesheet.split(`.${rule.className} {`)[1] ?? '';
      return !block.split('}')[0].includes(`font-size: ${rule.fontSize}px`);
    });
    expect(mismatched.map((rule) => rule.className)).toEqual([]);
  });

  it('gives a flow name a halo, so converging names read in layers', () => {
    const block = canvasStylesheet
      .split(`.${wrappedTextStyles.flowLabel.className} {`)[1]
      .split('}')[0];
    expect(block).toContain('paint-order: stroke');
  });

  it('is styled with properties SVG applies, so it needs no HTML around it', () => {
    expect(canvasStylesheet).not.toContain('background');
    expect(canvasStylesheet).toContain('stroke');
  });
});

describe('canvasClassNames', () => {
  it('is emitted whole by the primitives', () => {
    expect(emitted).toEqual(declared);
  });
});

describe('severityToneClass', () => {
  it('gives a tone to every severity the model declares and no other', () => {
    expect(new Set(Object.keys(severityToneClass))).toEqual(
      new Set<string>(severitySchema.options),
    );
  });

  it('gives the undecided severity the neutral tone', () => {
    expect(severityToneClass.undecided).toBe(canvasClassNames.toneNeutral);
  });
});
