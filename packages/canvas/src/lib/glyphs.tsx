import type { ReactElement } from 'react';
import { badgeAnchor, ThreatBadgeGlyph } from './badges.js';
import { WrappedText } from './labels.js';
import { flowLabelPlacement, nodeTextPlacement } from './label-placement.js';
import type { CanvasEdge, CanvasNode } from './layout.js';
import { svgNumber } from './numbers.js';
import { arrowheadPath, polylinePath, smoothPath, translate } from './paths.js';
import { canvasClassNames } from './stylesheet.js';

type NodeOf<Kind extends CanvasNode['kind']> = Extract<
  CanvasNode,
  { kind: Kind }
>;

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
 * at the target, and its name and badge where {@link flowLabelPlacement}
 * puts them, which is also where a caller sizing a picture bounds them.
 */
export function FlowGlyph({
  edge,
}: {
  readonly edge: CanvasEdge;
}): ReactElement {
  const points = [edge.source, ...edge.waypoints, edge.target];
  const placement = flowLabelPlacement(points, edge.name, edge.badge);
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
      <WrappedText {...placement.name} />
      {edge.badge === undefined || placement.badge === undefined ? null : (
        <ThreatBadgeGlyph badge={edge.badge} at={placement.badge} />
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
  if (node.kind === 'actor') {
    return actorOutline(node);
  }
  if (node.kind === 'process') {
    return processOutline(node);
  }
  if (node.kind === 'store') {
    return storeOutline(node);
  }
  if (node.kind === 'boundary-box') {
    return boundaryBoxOutline(node);
  }
  if (node.kind === 'boundary-curve') {
    return boundaryCurveOutline(node);
  }
  return null;
}

function actorOutline(node: NodeOf<'actor'>): ReactElement {
  return (
    <rect
      className={shapeClass(canvasClassNames.actor)}
      width={svgNumber(node.size.width)}
      height={svgNumber(node.size.height)}
    />
  );
}

function processOutline(node: NodeOf<'process'>): ReactElement {
  return (
    <circle
      className={shapeClass(canvasClassNames.process)}
      cx={svgNumber(node.size.width / 2)}
      cy={svgNumber(node.size.height / 2)}
      r={svgNumber(Math.min(node.size.width, node.size.height) / 2)}
    />
  );
}

function storeOutline(node: NodeOf<'store'>): ReactElement {
  const right = svgNumber(node.size.width);
  const bottom = svgNumber(node.size.height);
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

function boundaryBoxOutline(node: NodeOf<'boundary-box'>): ReactElement {
  return (
    <rect
      className={shapeClass(canvasClassNames.boundaryBox)}
      width={svgNumber(node.size.width)}
      height={svgNumber(node.size.height)}
    />
  );
}

function boundaryCurveOutline(node: NodeOf<'boundary-curve'>): ReactElement {
  return (
    <path
      className={shapeClass(canvasClassNames.boundaryCurve)}
      d={smoothPath(node.waypoints)}
    />
  );
}
