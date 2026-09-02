import {
  elementIdSchema,
  type Diagram,
  type DiagramId,
  type Model,
} from '@panoptes/model';
import type { Divergence } from './divergence.js';
import { mergeCell } from './threat-dragon-cells.js';
import { cellsOf, indexById } from './threat-dragon-document.js';
import type { HighWaterMark } from './threat-dragon-threats.js';
import type {
  ThreatDragonCell,
  ThreatDragonDiagram,
  ThreatDragonDocument,
  ThreatDragonThreat,
} from './threat-dragon-wire.js';

const genericDiagramType = 'Generic';

const genericThumbnail = './public/content/images/thumbnail.jpg';

/** A diagram as a merge produced it, and what producing it cost. */
export type MergedDiagram = {
  readonly diagram: ThreatDragonDiagram;
  readonly divergences: readonly Divergence[];
};

/** A Threat Dragon number for every diagram of the model, and the mark. */
export type Numbering = {
  readonly numbers: readonly number[];
  readonly diagramTop: HighWaterMark;
  readonly divergences: readonly Divergence[];
};

/** The source document's diagrams under the ids the model gives them. */
export function diagramsById(
  source: ThreatDragonDocument | undefined,
): ReadonlyMap<string, ThreatDragonDiagram> {
  return new Map(
    (source?.detail.diagrams ?? []).map((diagram) => [
      String(diagram.id),
      diagram,
    ]),
  );
}

/**
 * A Threat Dragon number for every diagram of the model. A diagram the
 * source document holds keeps the number that document gave it, and a
 * diagram whose own id reads as a free non-negative integer takes it, so a
 * projection of a model that came from this format numbers the diagrams as
 * the file did. Anything else the format cannot hold: it numbers a diagram
 * where the model names one, so the name is dropped for a number from the
 * mark upward and reported.
 *
 * `diagramTop` follows the rule `threat-dragon-threats.ts` sets for the
 * threat mark. A file that declared one keeps it as its floor, and a file
 * that declared none is given one covering every number it holds, since
 * writing 0 onto a file whose diagrams are numbered 0 and 3 would have
 * Threat Dragon hand those numbers out again.
 */
export function numberDiagrams(
  model: Model,
  held: ReadonlyMap<string, ThreatDragonDiagram>,
  declaredTop: number | undefined,
): Numbering {
  const taken = new Set<number>(
    [...held.values()].map((diagram) => diagram.id),
  );
  const claimed = model.diagrams.map((diagram) =>
    claimNumber(diagram.id, held, taken),
  );
  const divergences: Divergence[] = [];
  const issued: number[] = [];
  let next = Math.max(
    declaredTop ?? 0,
    ...[...taken].map((number) => number + 1),
    0,
  );
  const numbers = model.diagrams.map((diagram, index) => {
    const claim = claimed[index];
    if (claim !== undefined) {
      if (!held.has(diagram.id)) {
        issued.push(claim);
      }
      return claim;
    }
    while (taken.has(next)) {
      next += 1;
    }
    taken.add(next);
    issued.push(next);
    divergences.push(unnamedDiagram(diagram.id, next));
    return next;
  });
  const floor =
    declaredTop ?? Math.max(0, ...numbers.map((number) => number + 1));
  return {
    numbers,
    diagramTop: {
      value: Math.max(floor, ...issued.map((number) => number + 1)),
      cause: 'issued',
    },
    divergences,
  };
}

function claimNumber(
  id: string,
  held: ReadonlyMap<string, ThreatDragonDiagram>,
  taken: Set<number>,
): number | undefined {
  const kept = held.get(id);
  if (kept !== undefined) {
    return kept.id;
  }
  const own = Number(id);
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(own) || taken.has(own)) {
    return undefined;
  }
  taken.add(own);
  return own;
}

/**
 * One diagram of the model as Threat Dragon draws it. `diagramType` and
 * `thumbnail` are Threat Dragon's own and no part of the model, so a
 * diagram the source holds keeps what it said and one an edit added takes
 * what Threat Dragon writes for a diagram of no methodology, read off the
 * Generic diagram of the corpus vendored under `test-data`. A diagram that
 * draws nothing and declared no cell list keeps declaring none. The release
 * stamp is the document's rather than the diagram's own decision, so
 * `writeThreatDragon` writes it.
 */
export function mergeDiagram(
  diagram: Diagram,
  held: ThreatDragonDiagram | undefined,
  id: number,
  byCell: ReadonlyMap<string, readonly ThreatDragonThreat[]>,
): MergedDiagram {
  const cells = indexById(held ? cellsOf(held) : []);
  const merged = diagram.elements.map((element, index) =>
    mergeCell(
      element,
      cells.get(element.id),
      byCell.get(element.id) ?? [],
      index,
    ),
  );
  const kept = new Set<string>(diagram.elements.map((element) => element.id));
  return {
    diagram: {
      ...held,
      id,
      title: diagram.title,
      diagramType: held?.diagramType ?? genericDiagramType,
      thumbnail: held?.thumbnail ?? genericThumbnail,
      cells:
        merged.length === 0 && held?.cells === undefined
          ? undefined
          : merged.map((entry) => entry.cell),
    },
    divergences: [
      ...merged.flatMap((entry) => entry.divergences),
      ...[...cells.values()]
        .filter((cell) => !kept.has(cell.id))
        .map(discardedCell),
    ],
  };
}

function unnamedDiagram(id: DiagramId, number: number): Divergence {
  return {
    subject: { kind: 'diagram', id },
    detail: `the name, which the format numbers a diagram rather than naming one, written as ${number}`,
    reason: 'unrepresentable',
  };
}

function discardedCell(cell: ThreatDragonCell): Divergence {
  const id = elementIdSchema.safeParse(cell.id);
  return {
    subject: id.success ? { kind: 'element', id: id.data } : { kind: 'model' },
    detail: `the ${cell.shape} cell the source document held`,
    reason: 'discarded-by-edit',
  };
}
