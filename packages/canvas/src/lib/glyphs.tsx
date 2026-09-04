import type { Point } from '@panoptes/model';
import type { ReactElement } from 'react';
import { badgeExtent, ThreatBadgeGlyph, type ThreatBadge } from './badges.js';
import { WrappedText } from './labels.js';
import type { CanvasEdge, CanvasNode } from './layout.js';
import { svgNumber } from './numbers.js';
import { arrowheadPath, polylinePath, smoothPath, translate } from './paths.js';
import { canvasClassNames, wrappedTextStyles } from './stylesheet.js';
import {
  flowLabelClearance,
  innerWidth,
  lineHeight,
  looseLabelWidth,
  textExtent,
  textPadding,
  wrapText,
  type TextExtent,
} from './typography.js';

type NodeOf<Kind extends CanvasNode['kind']> = Extract<
  CanvasNode,
  { kind: Kind }
>;

type Segment = { readonly from: Point; readonly to: Point };

/**
 * One element's glyph in the element's own coordinates, its origin at the
 * element's position. React Flow places a node itself; the headless render
 * places it with {@link PlacedElementGlyph}.
 */
export function ElementGlyph({
  node,
}: {
  readonly node: CanvasNode;
}): ReactElement {
  return (
    <g className={groupClass(node.outOfScope)}>
      {shapeOf(node)}
      {node.badge === undefined ? null : (
        <ThreatBadgeGlyph
          badge={node.badge}
          at={{ x: node.size.width, y: 0 }}
        />
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
 * at the target, and its name beside the midpoint of its longest segment,
 * with its badge on the other side of the line.
 *
 * Both are offset along that segment's own unit normal rather than down the
 * y axis, by {@link flowLabelClearance} plus their own extent projected onto
 * that normal, so a vertical or diagonal flow carries its name beside its
 * line instead of along it. Of the two normals the one with a non-negative y
 * is taken, and where that y is zero the one with a positive x, so the side
 * a name takes is fixed by the segment and not by which end the flow runs
 * from.
 */
export function FlowGlyph({
  edge,
}: {
  readonly edge: CanvasEdge;
}): ReactElement {
  const points = [edge.source, ...edge.waypoints, edge.target];
  const segment = longestSegment(points);
  const midpoint = midpointOf(segment);
  const normal = labelNormal(segment);
  const fontSize = wrappedTextStyles.flowLabel.fontSize;
  const extent = textExtent(
    wrapText(edge.name, fontSize, looseLabelWidth),
    fontSize,
  );
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
      <WrappedText
        text={edge.name}
        at={offsetBy(
          midpoint,
          normal,
          flowLabelClearance + projectedHalfExtent(extent, normal),
        )}
        anchor="centre"
        width={looseLabelWidth}
        textStyle="flowLabel"
      />
      {edge.badge === undefined ? null : (
        <ThreatBadgeGlyph
          badge={edge.badge}
          at={offsetBy(
            midpoint,
            negated(normal),
            flowLabelClearance + badgeReach(edge.badge, normal),
          )}
        />
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

function shapeOf(node: CanvasNode): ReactElement {
  if (node.kind === 'actor') {
    return actorShape(node);
  }
  if (node.kind === 'process') {
    return processShape(node);
  }
  if (node.kind === 'store') {
    return storeShape(node);
  }
  if (node.kind === 'text') {
    return noteShape(node);
  }
  if (node.kind === 'boundary-box') {
    return boundaryBoxShape(node);
  }
  return boundaryCurveShape(node);
}

function actorShape(node: NodeOf<'actor'>): ReactElement {
  return (
    <>
      <rect
        className={shapeClass(canvasClassNames.actor)}
        width={svgNumber(node.size.width)}
        height={svgNumber(node.size.height)}
      />
      {nameLabel(node.name, boxCentre(node), innerWidth(node.size.width))}
    </>
  );
}

function processShape(node: NodeOf<'process'>): ReactElement {
  const diameter = Math.min(node.size.width, node.size.height);
  return (
    <>
      <circle
        className={shapeClass(canvasClassNames.process)}
        cx={svgNumber(node.size.width / 2)}
        cy={svgNumber(node.size.height / 2)}
        r={svgNumber(diameter / 2)}
      />
      {nameLabel(
        node.name,
        boxCentre(node),
        innerWidth(diameter * Math.SQRT1_2),
      )}
    </>
  );
}

function storeShape(node: NodeOf<'store'>): ReactElement {
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
      {nameLabel(node.name, boxCentre(node), innerWidth(node.size.width))}
    </>
  );
}

function noteShape(node: NodeOf<'text'>): ReactElement {
  return (
    <WrappedText
      text={node.text}
      at={boxCentre(node)}
      anchor="centre"
      width={innerWidth(node.size.width)}
      textStyle="note"
    />
  );
}

function boundaryBoxShape(node: NodeOf<'boundary-box'>): ReactElement {
  return (
    <>
      <rect
        className={shapeClass(canvasClassNames.boundaryBox)}
        width={svgNumber(node.size.width)}
        height={svgNumber(node.size.height)}
      />
      <WrappedText
        text={node.name}
        at={{
          x: node.size.width / 2,
          y: textPadding + wrappedTextStyles.label.fontSize / 2,
        }}
        anchor="top"
        width={innerWidth(node.size.width)}
        textStyle="label"
      />
    </>
  );
}

function boundaryCurveShape(node: NodeOf<'boundary-curve'>): ReactElement {
  const middle = node.waypoints[Math.floor(node.waypoints.length / 2)];
  return (
    <>
      <path
        className={shapeClass(canvasClassNames.boundaryCurve)}
        d={smoothPath(node.waypoints)}
      />
      {nameLabel(
        node.name,
        {
          x: middle.x,
          y: middle.y - lineHeight(wrappedTextStyles.label.fontSize),
        },
        looseLabelWidth,
      )}
    </>
  );
}

function nameLabel(name: string, at: Point, width: number): ReactElement {
  return (
    <WrappedText
      text={name}
      at={at}
      anchor="centre"
      width={width}
      textStyle="label"
    />
  );
}

function boxCentre(node: CanvasNode): Point {
  return { x: node.size.width / 2, y: node.size.height / 2 };
}

function longestSegment(points: readonly Point[]): Segment {
  let longest = 0;
  let at = 0;
  for (let index = 0; index + 1 < points.length; index += 1) {
    const run =
      (points[index + 1].x - points[index].x) ** 2 +
      (points[index + 1].y - points[index].y) ** 2;
    if (run > longest) {
      longest = run;
      at = index;
    }
  }
  return { from: points[at], to: points[at + 1] };
}

function midpointOf(segment: Segment): Point {
  return {
    x: (segment.from.x + segment.to.x) / 2,
    y: (segment.from.y + segment.to.y) / 2,
  };
}

function labelNormal(segment: Segment): Point {
  const run = {
    x: segment.to.x - segment.from.x,
    y: segment.to.y - segment.from.y,
  };
  const length = Math.hypot(run.x, run.y);
  const along =
    length === 0 ? { x: 1, y: 0 } : { x: run.x / length, y: run.y / length };
  const normal = { x: -along.y, y: along.x };
  return normal.y < 0 || (normal.y === 0 && normal.x < 0)
    ? negated(normal)
    : normal;
}

function negated(point: Point): Point {
  return { x: -point.x, y: -point.y };
}

function offsetBy(at: Point, direction: Point, distance: number): Point {
  return {
    x: at.x + direction.x * distance,
    y: at.y + direction.y * distance,
  };
}

function projectedHalfExtent(extent: TextExtent, normal: Point): number {
  return (
    (extent.width / 2) * Math.abs(normal.x) +
    (extent.height / 2) * Math.abs(normal.y)
  );
}

function badgeReach(badge: ThreatBadge, normal: Point): number {
  const extent = badgeExtent(badge);
  return extent.radius * Math.abs(normal.x) + extent.depth * normal.y;
}
