import * as canvas from './index.js';

const exported = new Set(Object.keys(canvas));

describe('the package barrel', () => {
  it('carries every name the README hands its consumers', () => {
    const promised = [
      'layoutDiagram',
      'ElementGlyph',
      'PlacedElementGlyph',
      'FlowGlyph',
      'DiagramGlyphs',
      'WrappedText',
      'canvasStylesheet',
      'canvasClassNames',
      'wrappedTextStyles',
      'severityToneClass',
      'boundaryStrokeWidth',
      'badgesByElement',
      'badgeAnchor',
      'badgeExtent',
      'severityRank',
      'ThreatBadgeGlyph',
      'handleSides',
      'centreOf',
      'handlePositions',
      'nearestHandleSide',
      'translate',
      'polylinePath',
      'smoothPath',
      'smoothSegments',
      'arrowheadPath',
      'arrowheadPoints',
      'svgNumber',
      'wrapText',
      'xmlSafeText',
      'textExtent',
      'innerWidth',
      'lineHeight',
      'averageGlyphWidthRatio',
      'lineHeightRatio',
      'textPadding',
      'looseLabelWidth',
      'flowLabelClearance',
      'nodeTextPlacement',
      'flowLabelPlacement',
      'textPlacementCorners',
      'canvasNodeTypes',
      'canvasEdgeTypes',
      'CanvasNodeBody',
      'CanvasEdgeBody',
      'toReactFlowNodes',
      'PanoptesCanvas',
    ];
    expect(new Set(promised).size).toBe(promised.length);
    expect(promised.filter((name) => !exported.has(name))).toEqual([]);
  });

  it('keeps the spec fixtures out of what it exports', () => {
    expect(exported.has('everyGlyphModel')).toBe(false);
    expect(exported.has('parsedFixture')).toBe(false);
  });
});
