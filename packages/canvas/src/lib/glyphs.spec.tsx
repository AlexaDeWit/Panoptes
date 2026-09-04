import { elementIdSchema } from '@panoptes/model';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { everyGlyphModel } from './canvas.fixtures.js';
import { ElementGlyph, FlowGlyph, PlacedElementGlyph } from './glyphs.js';
import { layoutDiagram, type CanvasEdge, type CanvasNode } from './layout.js';
import {
  boundaryStrokeWidth,
  canvasClassNames,
  wrappedTextStyles,
} from './stylesheet.js';
import { badgeExtent, type ThreatBadge } from './badges.js';
import type { Point } from '@panoptes/model';
import { segmentMeetsBox, type Box } from './geometry.js';
import { flowLabelPlacements } from './label-placement.js';
import {
  flowLabelClearance,
  looseLabelWidth,
  textExtent,
} from './typography.js';

const id = (value: string) => elementIdSchema.parse(value);

const layout = layoutDiagram(everyGlyphModel.diagrams[0], everyGlyphModel);

const nodeNamed = (value: string): CanvasNode => {
  const found = layout.nodes.find((node) => node.id === id(value));
  if (found === undefined) {
    throw new Error(`No node ${value} in the layout`);
  }
  return found;
};

const edgeNamed = (value: string): CanvasEdge => {
  const found = layout.edges.find((edge) => edge.id === id(value));
  if (found === undefined) {
    throw new Error(`No edge ${value} in the layout`);
  }
  return found;
};

const glyphOf = (value: string): string =>
  renderToStaticMarkup(<ElementGlyph node={nodeNamed(value)} />);

const packageSource = join(import.meta.dirname, '..');

const sourceFiles = (from: string): string[] =>
  readdirSync(from, { withFileTypes: true }).flatMap((entry) => {
    const path = join(from, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return /\.tsx?$/u.test(entry.name) && !entry.name.includes('.spec.')
      ? [path]
      : [];
  });

const sources = sourceFiles(packageSource).map((path) => ({
  path,
  text: readFileSync(path, 'utf8'),
}));

describe('ElementGlyph, taking its extent from the model', () => {
  it('draws an actor as a rectangle of the model width and height', () => {
    const node = nodeNamed('el-client');
    expect(glyphOf('el-client')).toContain(
      `<rect class="${canvasClassNames.shape} ${canvasClassNames.actor}" ` +
        `width="${node.size.width}" height="${node.size.height}"`,
    );
  });

  it('draws a process as the circle inscribed in the model box', () => {
    const node = nodeNamed('el-api');
    expect(glyphOf('el-api')).toContain(
      `cx="${node.size.width / 2}" cy="${node.size.height / 2}" ` +
        `r="${Math.min(node.size.width, node.size.height) / 2}"`,
    );
  });

  it('draws a store as a pair of lines open at the sides', () => {
    const node = nodeNamed('el-db');
    const markup = glyphOf('el-db');
    expect(markup.match(/<line/gu)).toHaveLength(2);
    expect(markup).toContain(`x2="${node.size.width}" y2="0"`);
    expect(markup).toContain(`y1="${node.size.height}"`);
  });

  it('draws a text element as prose with no outline of its own', () => {
    const markup = glyphOf('el-note');
    expect(markup).toContain(canvasClassNames.note);
    expect(markup).not.toContain('<rect');
    expect(markup).not.toContain(canvasClassNames.shape);
  });

  it('draws a box boundary as a rectangle of the shape width and height', () => {
    const node = nodeNamed('el-zone');
    expect(glyphOf('el-zone')).toContain(
      `<rect class="${canvasClassNames.shape} ${canvasClassNames.boundaryBox}" ` +
        `width="${node.size.width}" height="${node.size.height}"`,
    );
  });

  it('draws a curve boundary as one smooth path through its waypoints', () => {
    const markup = glyphOf('el-edge-zone');
    expect(markup).toContain(canvasClassNames.boundaryCurve);
    expect(markup).toContain(
      `d="M ${boundaryStrokeWidth} ${boundaryStrokeWidth} C `,
    );
  });

  it('dims an out-of-scope element', () => {
    expect(glyphOf('el-db')).toContain(canvasClassNames.outOfScope);
    expect(glyphOf('el-api')).not.toContain(canvasClassNames.outOfScope);
  });

  it('badges an element the open threats name and no other', () => {
    expect(glyphOf('el-client')).toContain(canvasClassNames.badge);
    expect(glyphOf('el-note')).not.toContain(canvasClassNames.badge);
  });

  it('follows the model when a size changes', () => {
    const widened: CanvasNode = {
      ...nodeNamed('el-client'),
      size: { width: 999, height: 111 },
    };
    expect(renderToStaticMarkup(<ElementGlyph node={widened} />)).toContain(
      'width="999" height="111"',
    );
  });
});

describe('PlacedElementGlyph', () => {
  it('moves the glyph to the model position', () => {
    const node = nodeNamed('el-client');
    expect(renderToStaticMarkup(<PlacedElementGlyph node={node} />)).toContain(
      `transform="translate(${node.position.x}, ${node.position.y})"`,
    );
  });
});

describe('FlowGlyph', () => {
  it('runs straight segments from source through waypoints to target', () => {
    expect(
      renderToStaticMarkup(<FlowGlyph edge={edgeNamed('el-request')} />),
    ).toContain('d="M 200 100 L 240 100 L 280 120"');
  });

  it('marks the target with an arrowhead', () => {
    expect(
      renderToStaticMarkup(<FlowGlyph edge={edgeNamed('el-request')} />),
    ).toContain(`class="${canvasClassNames.flowArrow}"`);
  });

  it('names the flow near the midpoint of its longest segment', () => {
    expect(
      renderToStaticMarkup(<FlowGlyph edge={edgeNamed('el-probe')} />),
    ).toContain('Nightly backup probe');
  });

  it('badges a flow the open threats name', () => {
    expect(
      renderToStaticMarkup(<FlowGlyph edge={edgeNamed('el-request')} />),
    ).toContain(canvasClassNames.badge);
    expect(
      renderToStaticMarkup(<FlowGlyph edge={edgeNamed('el-probe')} />),
    ).not.toContain(canvasClassNames.badge);
  });
});

describe('the primitives, measuring nothing', () => {
  it('reads no glyph extent out of a layout engine', () => {
    const measuring = sources.filter((source) =>
      /getBBox|getComputedTextLength|measureText|getBoundingClientRect/u.test(
        source.text,
      ),
    );
    expect(measuring.map((source) => source.path)).toEqual([]);
  });

  it('walked the whole package, the barrel included', () => {
    expect(sources.map((source) => source.path)).toContain(
      join(packageSource, 'index.ts'),
    );
    expect(sources.length).toBeGreaterThan(10);
  });
});

const flowFontSize = wrappedTextStyles.flowLabel.fontSize;

const orientations = [
  ['horizontal', { x: 0, y: 0 }, { x: 400, y: 0 }],
  ['vertical, running down', { x: 0, y: 0 }, { x: 0, y: 400 }],
  ['vertical, running up', { x: 0, y: 400 }, { x: 0, y: 0 }],
  ['diagonal, falling', { x: -200, y: -200 }, { x: 200, y: 200 }],
  ['diagonal, rising', { x: -200, y: 200 }, { x: 200, y: -200 }],
] as const;

const wordyBadge: ThreatBadge = { count: 4, severity: 'high', secondary: 2 };

const probeName = 'a name long enough to wrap over several lines of its own';

const probeFlow = (
  from: Point,
  to: Point,
  badge: ThreatBadge | undefined,
): CanvasEdge => ({
  id: id('el-probe'),
  name: probeName,
  outOfScope: false,
  badge,
  source: from,
  target: to,
  sourceSide: undefined,
  targetSide: undefined,
  sourceElement: undefined,
  targetElement: undefined,
  waypoints: [],
  label: flowLabelPlacements(
    [{ id: id('el-probe'), name: probeName, badge, points: [from, to] }],
    [],
  )[0],
});

const labelBoxOf = (markup: string): Box => {
  const found = /<text[^>]*x="([-\d.]+)" y="([-\d.]+)">(.*?)<\/text>/u.exec(
    markup,
  );
  if (found === null) {
    throw new Error('The flow drew no label to measure');
  }
  const lines = [...found[3].matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/gu)].map(
    (line) => line[1],
  );
  const extent = textExtent(lines, flowFontSize);
  const top = Number(found[2]) - flowFontSize / 2;
  const centre = Number(found[1]);
  return {
    minX: centre - extent.width / 2,
    maxX: centre + extent.width / 2,
    minY: top,
    maxY: top + extent.height,
  };
};

const badgeBoxOf = (markup: string, badge: ThreatBadge): Box => {
  const found =
    /class="pn-badge" transform="translate\(([-\d.]+), ([-\d.]+)\)"/u.exec(
      markup,
    );
  if (found === null) {
    throw new Error('The flow drew no badge to measure');
  }
  const extent = badgeExtent(badge);
  const at = { x: Number(found[1]), y: Number(found[2]) };
  return {
    minX: at.x - extent.radius,
    maxX: at.x + extent.radius,
    minY: at.y - extent.radius,
    maxY: at.y + extent.depth,
  };
};

describe('FlowGlyph, keeping its label off its own line', () => {
  it.each(orientations)(
    'draws the name clear of a %s segment',
    (_orientation, from, to) => {
      const markup = renderToStaticMarkup(
        <FlowGlyph edge={probeFlow(from, to, undefined)} />,
      );
      expect(markup.match(/<tspan/gu)?.length).toBeGreaterThanOrEqual(3);
      expect(segmentMeetsBox({ from, to }, labelBoxOf(markup))).toBe(false);
    },
  );

  it.each(orientations)(
    'draws the badge clear of a %s segment',
    (_orientation, from, to) => {
      const markup = renderToStaticMarkup(
        <FlowGlyph edge={probeFlow(from, to, wordyBadge)} />,
      );
      expect(
        segmentMeetsBox({ from, to }, badgeBoxOf(markup, wordyBadge)),
      ).toBe(false);
    },
  );

  it('puts the name and the badge on opposite sides of the line', () => {
    const [from, to] = [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
    ];
    const markup = renderToStaticMarkup(
      <FlowGlyph edge={probeFlow(from, to, wordyBadge)} />,
    );
    expect(labelBoxOf(markup).minY).toBeCloseTo(flowLabelClearance);
    expect(badgeBoxOf(markup, wordyBadge).maxY).toBeCloseTo(
      -flowLabelClearance,
    );
  });

  it('wraps the name to the width a flow carries no box for', () => {
    const box = labelBoxOf(
      renderToStaticMarkup(
        <FlowGlyph
          edge={probeFlow({ x: 0, y: 0 }, { x: 400, y: 0 }, undefined)}
        />,
      ),
    );
    expect(box.maxX - box.minX).toBeLessThanOrEqual(looseLabelWidth);
  });

  it('takes a side from the segment, not from the end it runs from', () => {
    const forwards = renderToStaticMarkup(
      <FlowGlyph
        edge={probeFlow({ x: 0, y: 0 }, { x: 0, y: 400 }, undefined)}
      />,
    );
    const backwards = renderToStaticMarkup(
      <FlowGlyph
        edge={probeFlow({ x: 0, y: 400 }, { x: 0, y: 0 }, undefined)}
      />,
    );
    expect(labelBoxOf(forwards).minX).toBe(labelBoxOf(backwards).minX);
    expect(labelBoxOf(forwards).minX).toBeGreaterThan(0);
  });

  it('draws a flow of no length beside where it sits', () => {
    const still = { x: 50, y: 50 };
    const markup = renderToStaticMarkup(
      <FlowGlyph edge={probeFlow(still, still, undefined)} />,
    );
    expect(labelBoxOf(markup).minY).toBeGreaterThan(still.y);
  });

  it('keeps the halo on the name', () => {
    expect(
      renderToStaticMarkup(
        <FlowGlyph
          edge={probeFlow(
            { x: 0, y: 0 },
            {
              x: 400,
              y: 0,
            },
            undefined,
          )}
        />,
      ),
    ).toContain(wrappedTextStyles.flowLabel.className);
  });
});
