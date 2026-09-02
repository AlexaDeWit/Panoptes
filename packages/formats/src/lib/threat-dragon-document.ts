import type {
  ThreatDragonCell,
  ThreatDragonDiagram,
  ThreatDragonDocument,
  ThreatDragonEndpoint,
  ThreatDragonThreat,
} from './threat-dragon-wire.js';

/** A cell drawn as a box on the canvas: an actor, a process, or a store. */
export type ThreatDragonNode = Extract<
  ThreatDragonCell,
  { shape: 'actor' | 'process' | 'store' }
>;

/** A data flow, the one cell drawn as an edge between two endpoints. */
export type ThreatDragonFlow = Extract<ThreatDragonCell, { shape: 'flow' }>;

/**
 * A trust boundary, in either shape and under either spelling of the curve.
 */
export type ThreatDragonBoundary = Extract<
  ThreatDragonCell,
  {
    shape:
      | 'trust-boundary-box'
      | 'trust-boundary-curve'
      | 'trust-broundary-curve';
  }
>;

/** A trust boundary drawn as a curve, under either spelling. */
export type ThreatDragonCurve = Extract<
  ThreatDragonCell,
  { shape: 'trust-boundary-curve' | 'trust-broundary-curve' }
>;

/** A note on the canvas, belonging to no other cell. */
export type ThreatDragonText = Extract<
  ThreatDragonCell,
  { shape: 'td-text-block' }
>;

/**
 * A cell Threat Dragon nests threats under. The boundary and text shapes
 * are not among them, so a threat the internal model attaches to one of
 * those has nowhere to go in this format.
 */
export type ThreatDragonHost = ThreatDragonNode | ThreatDragonFlow;

/**
 * Whether a cell is one Threat Dragon nests threats under. Narrowing here
 * rather than at each call site is what keeps the path from a document down
 * to `detail.diagrams[i].cells[j].data.threats[k]` free of casts.
 */
export function hostsThreats(cell: ThreatDragonCell): cell is ThreatDragonHost {
  return (
    cell.shape === 'actor' ||
    cell.shape === 'process' ||
    cell.shape === 'store' ||
    cell.shape === 'flow'
  );
}

/**
 * Whether an endpoint is fastened to a cell rather than left on empty
 * canvas. Membership is `Object.hasOwn`, so an endpoint from a foreign file
 * cannot take the wrong branch on a key it inherited.
 */
export function isAnchored(
  endpoint: ThreatDragonEndpoint,
): endpoint is Extract<ThreatDragonEndpoint, { cell: string }> {
  return Object.hasOwn(endpoint, 'cell');
}

/** The cells of one diagram, none where the diagram holds none. */
export function cellsOf(
  diagram: ThreatDragonDiagram,
): readonly ThreatDragonCell[] {
  return diagram.cells ?? [];
}

/** The threats nested under one cell, none where the cell hosts none. */
export function threatsOf(
  cell: ThreatDragonCell,
): readonly ThreatDragonThreat[] {
  return hostsThreats(cell) ? (cell.data.threats ?? []) : [];
}

/** Every cell of a document, in the order its diagrams hold them. */
export function allCells(
  document: ThreatDragonDocument,
): readonly ThreatDragonCell[] {
  return document.detail.diagrams.flatMap(cellsOf);
}

/** Every threat of a document, in the order its cells nest them. */
export function allThreats(
  document: ThreatDragonDocument,
): readonly ThreatDragonThreat[] {
  return allCells(document).flatMap(threatsOf);
}

/**
 * The records keyed by their own id, the first of a repeated id winning, as
 * a document Threat Dragon wrote holds cell and threat ids unique.
 */
export function indexById<Record extends { id: string }>(
  records: readonly Record[],
): ReadonlyMap<string, Record> {
  const held = new Map<string, Record>();
  for (const record of records) {
    if (!held.has(record.id)) {
      held.set(record.id, record);
    }
  }
  return held;
}
