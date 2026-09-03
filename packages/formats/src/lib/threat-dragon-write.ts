import { diagramIdSchema, threatIdSchema, type Model } from '@panoptes/model';
import type {
  ThreatDragonCell,
  ThreatDragonDiagram,
  ThreatDragonDocument,
  ThreatDragonThreat,
} from '@panoptes/wire-threat-dragon';
import type { WriteResult } from './codec.js';
import type { Divergence } from './divergence.js';
import { equivalent } from './equivalence.js';
import {
  diagramsById,
  mergeDiagram,
  numberDiagrams,
} from './threat-dragon-diagrams.js';
import { allCells, indexById, threatsOf } from './threat-dragon-document.js';
import { preservedText } from './threat-dragon-preservation.js';
import { planThreats, type HighWaterMark } from './threat-dragon-threats.js';

const writtenVersion = '2.6.2';

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
 * `detail.threatTop` and `detail.diagramTop` rise to cover a number this
 * write put in the file that the file did not already carry, so Threat
 * Dragon does not hand that number out again, and neither ever falls. A
 * file that declared no mark of its own is given one that covers the
 * numbers it holds rather than a zero it would reissue from. Each entry
 * says which of the two reasons in {@link HighWaterMark} moved the mark,
 * since one claims a number went into the file and the other claims the
 * model has issued past everything in it. Issuing the number is not itself
 * a divergence: the file gains a fact rather than losing one.
 *
 * What the format cannot hold is reported rather than dropped in silence,
 * and a record the source held that an edit has since removed is reported
 * with what it was carrying: a diagram, a cell, a threat, and the copy of a
 * threat nested under a cell the model no longer attaches it to, which is a
 * loss the surviving copies elsewhere would otherwise hide. Each names its
 * own record, and an id the model's own schema would refuse names the model
 * instead, rather than a write stopping over a file it can still produce.
 * Nothing throws.
 */
export function writeThreatDragon(
  model: Model,
  source?: ThreatDragonDocument,
): WriteResult {
  const held = diagramsById(source);
  const numbering = numberDiagrams(model, held, source?.detail.diagramTop);
  const plan = planThreats(model, source);
  const merged = model.diagrams.map((diagram, index) => ({
    ...mergeDiagram(
      diagram,
      held.get(diagram.id),
      numbering.numbers[index],
      plan.byCell,
    ),
    stamp: restamped(held.get(diagram.id)?.version, {
      kind: 'diagram',
      id: diagram.id,
    }),
  }));
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
      diagrams: merged.map((entry) => ({
        ...entry.diagram,
        version: writtenVersion,
      })),
      diagramTop: numbering.diagramTop.value,
      reviewer: source?.detail.reviewer ?? '',
      threatTop: plan.threatTop.value,
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
      ...merged.flatMap((entry) => [...entry.stamp, ...entry.divergences]),
      ...plan.divergences,
      ...unrecorded(model),
      ...discarded(model, source),
    ],
  };
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
  mark: HighWaterMark,
): readonly Divergence[] {
  return from === undefined || from === mark.value
    ? []
    : [
        {
          subject: { kind: 'model' },
          detail:
            mark.cause === 'issued'
              ? `the ${name} ${from}, raised to ${mark.value} to cover a number this write issued`
              : `the ${name} ${from}, raised to ${mark.value}, the highest number the model has issued and no number in the file reaches`,
          reason: 'overridden',
        },
      ];
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
  const attached = new Map<string, ReadonlySet<string>>(
    model.threats.map((threat) => [
      threat.id,
      new Set<string>(threat.elements),
    ]),
  );
  const nested = allCells(source)
    .filter((cell) => elements.has(cell.id))
    .flatMap((cell) => threatsOf(cell).map((threat) => ({ cell, threat })));
  return [
    ...source.detail.diagrams
      .filter((diagram) => !kept.has(String(diagram.id)))
      .map(discardedDiagram),
    ...[...indexById(nested.map((held) => held.threat)).values()]
      .filter((threat) => !attached.has(threat.id))
      .map(discardedThreat),
    ...nested
      .filter(
        (held) => attached.get(held.threat.id)?.has(held.cell.id) === false,
      )
      .map((held) => detachedThreat(held.threat, held.cell)),
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

function detachedThreat(
  threat: ThreatDragonThreat,
  cell: ThreatDragonCell,
): Divergence {
  return {
    subject: threatSubject(threat),
    detail: `the copy the source document nested under the cell "${cell.id}", which the model no longer attaches it to`,
    reason: 'discarded-by-edit',
  };
}

function discardedThreat(threat: ThreatDragonThreat): Divergence {
  return {
    subject: threatSubject(threat),
    detail: `the threat "${threat.title}" the source document nested under a cell the model kept`,
    reason: 'discarded-by-edit',
  };
}

function threatSubject(threat: ThreatDragonThreat): Divergence['subject'] {
  const id = threatIdSchema.safeParse(threat.id);
  return id.success ? { kind: 'threat', id: id.data } : { kind: 'model' };
}
