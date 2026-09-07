import type { Size } from '@saerskriven/model';
import type { ReactElement } from 'react';
import { badgeAnchor, ThreatBadgeGlyph } from './badges.js';
import { WrappedText } from './labels.js';
import { nodeTextPlacement, processCircle } from './label-placement.js';
import type { CanvasEdge, CanvasNode, CanvasNodeKind } from './layout.js';
import { svgNumber } from './numbers.js';
import { arrowheadPath, polylinePath, smoothPath, translate } from './paths.js';
import { canvasClassNames } from './stylesheet.js';
import { strokeWidths } from './tokens.js';

/** An element kind whose model geometry is a position and size. */
export type BoxElementKind = Exclude<CanvasNodeKind, 'boundary-curve' | 'text'>;

/** How far a box element's stroke reaches past its model box. */
export function boxElementStrokeInsets(kind: BoxElementKind): {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
} {
  const halfStroke =
    (kind === 'store' ? strokeWidths.store : strokeWidths.outline) / 2;
  return kind === 'store'
    ? { top: halfStroke, right: 0, bottom: halfStroke, left: 0 }
    : {
        top: halfStroke,
        right: halfStroke,
        bottom: halfStroke,
        left: halfStroke,
      };
}

/** One box element's outline in its own coordinates. */
export function BoxElementGlyph({
  kind,
  size,
}: {
  readonly kind: BoxElementKind;
  readonly size: Size;
}): ReactElement {
  if (kind === 'actor') {
    return actorOutline(size);
  }
  if (kind === 'process') {
    return processOutline(size);
  }
  if (kind === 'store') {
    return storeOutline(size);
  }
  return boundaryBoxOutline(size);
}

/**
 * One element's glyph in the element's own coordinates, its origin at the
 * element's position: its outline, its run of text, and its badge, in that
 * order. React Flow places a node itself; the headless render places it with
 * {@link PlacedElementGlyph}.
 */
export function ElementGlyph({
  node,
}: {
  readonly node: CanvasNode;
}): ReactElement {
  return (
    <g className={groupClass(node.outOfScope)}>
      {outlineOf(node)}
      <WrappedText {...nodeTextPlacement(node)} />
      {node.badge === undefined ? null : (
        <ThreatBadgeGlyph badge={node.badge} at={badgeAnchor(node.size)} />
      )}
    </g>
  );
}

/**
 * One element's glyph translated to the element's position, the form the
 * headless render composes into a standalone SVG.
 */
export function PlacedElementGlyph({
  node,
}: {
  readonly node: CanvasNode;
}): ReactElement {
  return (
    <g transform={translate(node.position)}>
      <ElementGlyph node={node} />
    </g>
  );
}

/**
 * One flow, in the diagram's own coordinates rather than a node's: straight
 * segments from its source through its waypoints to its target, an arrowhead
 * at the target, and its name and badge where the layout settled them, which
 * is also where a caller sizing a picture bounds them.
 */
export function FlowGlyph({
  edge,
}: {
  readonly edge: CanvasEdge;
}): ReactElement {
  const points = [edge.source, ...edge.waypoints, edge.target];
  return (
    <g className={groupClass(edge.outOfScope)}>
      <path
        className={shapeClass(canvasClassNames.flow)}
        d={polylinePath(points)}
      />
      <path
        className={canvasClassNames.flowArrow}
        d={arrowheadPath(edge.target, points[points.length - 2])}
      />
      <WrappedText {...edge.label.name} />
      {edge.badge === undefined || edge.label.badge === undefined ? null : (
        <ThreatBadgeGlyph badge={edge.badge} at={edge.label.badge} />
      )}
    </g>
  );
}

function groupClass(outOfScope: boolean): string {
  return outOfScope
    ? `${canvasClassNames.element} ${canvasClassNames.outOfScope}`
    : canvasClassNames.element;
}

function shapeClass(outline: string): string {
  return `${canvasClassNames.shape} ${outline}`;
}

function outlineOf(node: CanvasNode): ReactElement | null {
  if (node.kind === 'boundary-curve') {
    return boundaryCurveOutline(node);
  }
  return node.kind === 'text' ? null : (
    <BoxElementGlyph kind={node.kind} size={node.size} />
  );
}

function actorOutline(size: Size): ReactElement {
  return (
    <rect
      className={shapeClass(canvasClassNames.actor)}
      width={svgNumber(size.width)}
      height={svgNumber(size.height)}
    />
  );
}

function processOutline(size: Size): ReactElement {
  const circle = processCircle(size);
  return (
    <circle
      className={shapeClass(canvasClassNames.process)}
      cx={svgNumber(circle.centre.x)}
      cy={svgNumber(circle.centre.y)}
      r={svgNumber(circle.radius)}
    />
  );
}

function storeOutline(size: Size): ReactElement {
  const right = svgNumber(size.width);
  const bottom = svgNumber(size.height);
  return (
    <>
      <line
        className={shapeClass(canvasClassNames.store)}
        x1="0"
        y1="0"
        x2={right}
        y2="0"
      />
      <line
        className={shapeClass(canvasClassNames.store)}
        x1="0"
        y1={bottom}
        x2={right}
        y2={bottom}
      />
    </>
  );
}

function boundaryBoxOutline(size: Size): ReactElement {
  return (
    <rect
      className={shapeClass(canvasClassNames.boundaryBox)}
      width={svgNumber(size.width)}
      height={svgNumber(size.height)}
    />
  );
}

function boundaryCurveOutline(
  node: Extract<CanvasNode, { kind: 'boundary-curve' }>,
): ReactElement {
  return (
    <path
      className={shapeClass(canvasClassNames.boundaryCurve)}
      d={smoothPath(node.waypoints)}
    />
  );
}
