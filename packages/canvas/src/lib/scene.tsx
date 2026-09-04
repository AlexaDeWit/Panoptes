import type { ReactElement } from 'react';
import { FlowGlyph, PlacedElementGlyph } from './glyphs.js';
import type { CanvasLayout } from './layout.js';

/**
 * Every glyph of one laid-out diagram, in painting order and in the
 * diagram's own coordinates, with no root element of its own. The headless
 * renderer puts this inside the `<svg>` it sizes and styles; the interactive
 * canvas does not use it, because React Flow places each node itself.
 */
export function DiagramGlyphs({
  layout,
}: {
  readonly layout: CanvasLayout;
}): ReactElement {
  return (
    <>
      {layout.nodes.map((node) => (
        <PlacedElementGlyph key={node.id} node={node} />
      ))}
      {layout.edges.map((edge) => (
        <FlowGlyph key={edge.id} edge={edge} />
      ))}
    </>
  );
}
