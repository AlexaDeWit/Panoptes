import {
  diagramIdSchema,
  elementIdSchema,
  threatIdSchema,
  type Diagram,
  type DiagramId,
  type Model,
} from '@panoptes/model';
import type { WriteResult } from './codec.js';
import type { Divergence } from './divergence.js';
import { equivalent } from './equivalence.js';
import { mergeCell } from './threat-dragon-cells.js';
import {
  allCells,
  cellsOf,
  indexById,
  threatsOf,
} from './threat-dragon-document.js';
import { preservedText } from './threat-dragon-preservation.js';
import { planThreats } from './threat-dragon-threats.js';
import type {
  ThreatDragonCell,
  ThreatDragonDiagram,
  ThreatDragonDocument,
  ThreatDragonThreat,
} from './threat-dragon-wire.js';

/** The release this codec models, stamped on the file and every diagram. */
const writtenVersion = '2.6.2';

/**
 * What Threat Dragon writes for a diagram whose methodology nobody chose,
 * taken from the Generic diagram of the corpus vendored under `test-data`.
 * The internal model records a methodology per threat rather than per
 * diagram, so a projection has none to name.
 */
const genericDiagramType = 'Generic';

const genericThumbnail = './public/content/images/thumbnail.jpg';

type MergedDiagram = {
  readonly diagram: ThreatDragonDiagram;
  readonly divergences: readonly Divergence[];
};

type Numbering = {
  readonly numbers: readonly number[];
  readonly diagramTop: number;
  readonly divergences: readonly Divergence[];
};

/**
 * The model as a Threat Dragon v2 file, merged onto the document it was
 * read from where one is given and projected into Threat Dragon's own
 * canonical form where none is. The output is built through the wire
 * schema's own inferred types, so nothing this writes is a shape that
 * schema would refuse.
 *
 * The merge is what preserves the file. Everything the wire schema declares
 * and the model does not hold, ports and `attrs` styling and `zIndex` and
 * `tools` among them, reaches the output because the merge writes over the
 * mapped fields alone and leaves the rest of the document as it found it. A
 * mapped field is rewritten only where the source disagrees with the model,
 * on the terms `threat-dragon-preservation.ts` sets, because the mapping
 * from a file to the model is not injective and overwriting would report a
 * user's edit where there was none.
 *
 * Three decisions the codec makes on its own, each an `overridden`
 * divergence where the source said otherwise. The version stamp is the
 * release this codec writes rather than the one the file arrived with.
 * `detail.threatTop` rises to cover a number this write put in the file
 * that the file did not already carry, so Threat Dragon does not hand that
 * number out again, and it never falls. `detail.diagramTop` does the same
 * for a diagram number. Issuing the number is not itself a divergence: the
 * file gains a fact rather than losing one.
 *
 * What the format cannot hold is reported rather than dropped in silence,
 * and a record the source held that an edit has since removed is reported
 * with what it was carrying. Nothing throws.
 */
export function writeThreatDragon(
  model: Model,
  source?: ThreatDragonDocument,
): WriteResult {
  const held = diagramsById(source);
  const numbering = numberDiagrams(model, held, source?.detail.diagramTop);
  const plan = planThreats(model, source);
  const merged = model.diagrams.map((diagram, index) =>
    mergeDiagram(
      diagram,
      held.get(diagram.id),
      numbering.numbers[index],
      plan.byCell,
    ),
  );
  const document: ThreatDragonDocument = {
    version: writtenVersion,
    summary: {
      ...source?.summary,
      title: model.metadata.title,
      owner: preservedText(source?.summary.owner, model.metadata.owner),
      description: preservedText(
        source?.summary.description,
        model.metadata.description,
      ),
    },
    detail: {
      ...source?.detail,
      contributors: mergedContributors(model, source),
      diagrams: merged.map((entry) => entry.diagram),
      diagramTop: numbering.diagramTop,
      reviewer: source?.detail.reviewer ?? '',
      threatTop: plan.threatTop,
    },
  };
  return {
    output: `${JSON.stringify(document, null, 2)}\n`,
    divergences: [
      ...restamped(source?.version, { kind: 'model' }),
      ...overriddenMark(
        'threat high-water mark',
        source?.detail.threatTop,
        plan.threatTop,
      ),
      ...overriddenMark(
        'diagram high-water mark',
        source?.detail.diagramTop,
        numbering.diagramTop,
      ),
      ...numbering.divergences,
      ...merged.flatMap((entry) => entry.divergences),
      ...plan.divergences,
      ...unrecorded(model),
      ...discarded(model, source),
    ],
  };
}

/** The source document's diagrams under the ids the model gives them. */
function diagramsById(
  source: ThreatDragonDocument | undefined,
): ReadonlyMap<string, ThreatDragonDiagram> {
  return new Map(
    (source?.detail.diagrams ?? []).map((diagram) => [
      String(diagram.id),
      diagram,
    ]),
  );
}

function mergedContributors(
  model: Model,
  source: ThreatDragonDocument | undefined,
): NonNullable<ThreatDragonDocument['detail']['contributors']> {
  const held = source?.detail.contributors;
  const names = held?.map((contributor) => contributor.name ?? '') ?? [];
  return held !== undefined && equivalent(names, model.metadata.contributors)
    ? [...held]
    : model.metadata.contributors.map((name) => ({ name }));
}

/**
 * A Threat Dragon number for every diagram of the model. A diagram the
 * source document holds keeps the number that document gave it, and a
 * diagram whose own id reads as a free non-negative integer takes it, so a
 * projection of a model that came from this format numbers the diagrams as
 * the file did. Anything else is numbered from the mark upward and reported
 * as narrowed, since the format numbers a diagram where the model names it.
 */
function numberDiagrams(
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
  const assigned: number[] = [];
  let next = Math.max(declaredTop ?? 0, 0);
  const numbers = model.diagrams.map((diagram, index) => {
    const claim = claimed[index];
    if (claim !== undefined) {
      if (!held.has(diagram.id)) {
        assigned.push(claim);
      }
      return claim;
    }
    while (taken.has(next)) {
      next += 1;
    }
    taken.add(next);
    assigned.push(next);
    divergences.push(renumbered(diagram.id, next));
    return next;
  });
  return {
    numbers,
    diagramTop: Math.max(
      declaredTop ?? 0,
      ...assigned.map((number) => number + 1),
      0,
    ),
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
 * what Threat Dragon writes for a diagram of no methodology. A diagram that
 * draws nothing and declared no cell list keeps declaring none.
 */
function mergeDiagram(
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
      version: writtenVersion,
      cells:
        merged.length === 0 && held?.cells === undefined
          ? undefined
          : merged.map((entry) => entry.cell),
    },
    divergences: [
      ...restamped(held?.version, { kind: 'diagram', id: diagram.id }),
      ...merged.flatMap((entry) => entry.divergences),
      ...[...cells.values()]
        .filter((cell) => !kept.has(cell.id))
        .map(discardedCell),
    ],
  };
}

function restamped(
  from: string | undefined,
  subject: Divergence['subject'],
): readonly Divergence[] {
  return from === undefined || from === writtenVersion
    ? []
    : [
        {
          subject,
          detail: `the release "${from}" the source was written by, for the ${writtenVersion} this codec writes`,
          reason: 'overridden',
        },
      ];
}

function overriddenMark(
  name: string,
  from: number | undefined,
  written: number,
): readonly Divergence[] {
  return from === undefined || from === written
    ? []
    : [
        {
          subject: { kind: 'model' },
          detail: `the ${name} ${from}, raised to ${written} to cover a number this write issued`,
          reason: 'overridden',
        },
      ];
}

function renumbered(id: DiagramId, number: number): Divergence {
  return {
    subject: { kind: 'diagram', id },
    detail: `the identifier, which the format numbers rather than names, written as ${number}`,
    reason: 'narrowed',
  };
}

function unrecorded(model: Model): readonly Divergence[] {
  return [
    ...model.mitigations.map((mitigation): Divergence => ({
      subject: { kind: 'mitigation', id: mitigation.id },
      detail: `the mitigation "${mitigation.title}", which the format keeps no record of`,
      reason: 'unrepresentable',
    })),
    ...model.assumptions.map((assumption): Divergence => ({
      subject: { kind: 'assumption', id: assumption.id },
      detail: 'the assumption, which the format keeps no record of',
      reason: 'unrepresentable',
    })),
  ];
}

/**
 * What the source document held and the model no longer does: a diagram, a
 * cell of a diagram the model kept, and a threat nested under a cell the
 * model kept. Everything on such a record that the model never mapped goes
 * with it, which is what these entries report. Each names its own record,
 * and an id the model's own schema would refuse names the model instead,
 * rather than a write stopping over a file it can still produce.
 */
function discarded(
  model: Model,
  source: ThreatDragonDocument | undefined,
): readonly Divergence[] {
  if (source === undefined) {
    return [];
  }
  const kept = new Set<string>(model.diagrams.map((diagram) => diagram.id));
  const elements = new Set<string>(
    model.diagrams.flatMap((diagram) =>
      diagram.elements.map((element) => element.id),
    ),
  );
  const threats = new Set<string>(model.threats.map((threat) => threat.id));
  return [
    ...source.detail.diagrams
      .filter((diagram) => !kept.has(String(diagram.id)))
      .map(discardedDiagram),
    ...[
      ...indexById(
        allCells(source)
          .filter((cell) => elements.has(cell.id))
          .flatMap(threatsOf),
      ).values(),
    ]
      .filter((threat) => !threats.has(threat.id))
      .map(discardedThreat),
  ];
}

function discardedDiagram(diagram: ThreatDragonDiagram): Divergence {
  const id = diagramIdSchema.safeParse(String(diagram.id));
  return {
    subject: id.success ? { kind: 'diagram', id: id.data } : { kind: 'model' },
    detail: `the diagram "${diagram.title}" the source document held`,
    reason: 'discarded-by-edit',
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

function discardedThreat(threat: ThreatDragonThreat): Divergence {
  const id = threatIdSchema.safeParse(threat.id);
  return {
    subject: id.success ? { kind: 'threat', id: id.data } : { kind: 'model' },
    detail: `the threat "${threat.title}" the source document nested under a cell the model kept`,
    reason: 'discarded-by-edit',
  };
}
