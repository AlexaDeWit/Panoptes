import type { Element, Model, Threat, ThreatId } from '@panoptes/model';
import type {
  ThreatDragonDocument,
  ThreatDragonThreat,
} from '@panoptes/wire-threat-dragon';
import type { Divergence } from './divergence.js';
import { equivalent } from './equivalence.js';
import {
  allCells,
  hostsThreats,
  indexById,
  threatsOf,
  type ThreatDragonHost,
} from './threat-dragon-document.js';
import {
  fromSeverity,
  fromThreatCategory,
  fromThreatStatus,
  toSeverity,
  toThreatCategory,
  toThreatStatus,
  type ThreatDragonCategoryFields,
} from './threat-dragon-vocabulary.js';

/**
 * A mark a file carries so a number already in use is not handed out again,
 * and why this write moved it: `issued` where the write put a number in the
 * file that the file did not already carry, `unreachable` where the model
 * has issued above every number the file holds, which is the gap a removed
 * threat left. Both can happen in one write. What is exclusive is which one
 * sets the value: a number this write issues is written into the file and so
 * is reachable from it, which puts it below a mark that is not, so
 * `unreachable` names the cause wherever it applies.
 */
export type HighWaterMark = {
  readonly value: number;
  readonly cause: 'issued' | 'unreachable';
};

/**
 * Where every threat of the model goes: the wire threat to nest under each
 * cell that hosts it, keyed by cell id; the `threatTop` the file needs; and
 * what the format could not hold of them.
 */
export type ThreatPlan = {
  readonly byCell: ReadonlyMap<string, readonly ThreatDragonThreat[]>;
  readonly threatTop: HighWaterMark;
  readonly divergences: readonly Divergence[];
};

/**
 * The model's threats as Threat Dragon nests them. Ours attach to any
 * number of elements and Threat Dragon nests each under one cell, so a
 * threat naming several is written under each of them, and one naming a
 * trust boundary, a note, or nothing at all is reported as unrepresentable,
 * since those are not cells a threat attaches to.
 *
 * `split` is reported for the record this write is the one to divide. A
 * source that already nests the threat under every cell the model names was
 * split before this write ran, and nothing became several here, so a merge
 * of an unedited model onto that document reports nothing.
 *
 * A threat the source already holds under a cell is merged onto that copy
 * and the cell's own order is kept, so a threat nobody touched leaves the
 * file exactly as it was. Its status, severity and category stay as the
 * source spelled them wherever that spelling still reads back as the model's
 * value, because Threat Dragon writes a category in its author's own
 * language and reads two spellings of the undecided severity.
 *
 * The {@link HighWaterMark} the plan carries is floored on what the file
 * declared, since a mark the file already carries is its own claim, and on
 * what the file holds where it declared none, since a zero written onto a
 * file holding a threat numbered 4 would have Threat Dragon hand 1 to 4 out
 * again. Above that floor it covers every number this write put in the file
 * that the file did not already carry, and the model's own mark where the
 * file's numbers fall short of it.
 */
export function planThreats(
  model: Model,
  source: ThreatDragonDocument | undefined,
): ThreatPlan {
  const kinds = elementKinds(model);
  const hosts = indexById(source ? allCells(source).filter(hostsThreats) : []);
  const nested = new Map(
    [...hosts].map(([id, host]) => [id, indexById(threatsOf(host))]),
  );
  const carried = new Set<number>(
    [...hosts.values()]
      .flatMap(threatsOf)
      .flatMap((threat) =>
        threat.number === undefined ? [] : [threat.number],
      ),
  );
  const byCell = new Map<string, ThreatDragonThreat[]>();
  const divergences: Divergence[] = [];
  const issued: number[] = [];
  const written: number[] = [];
  for (const threat of model.threats) {
    const placed: string[] = [];
    for (const id of threat.elements) {
      if (canHost(kinds, id)) {
        placed.push(id);
      } else {
        divergences.push(strayAttachment(threat.id, id, kinds.get(id)));
      }
    }
    if (placed.length === 0) {
      divergences.push(unplaceable(threat.id));
      continue;
    }
    if (
      placed.length > 1 &&
      !placed.every((id) => nested.get(id)?.has(threat.id) === true)
    ) {
      divergences.push(split(threat.id, placed.length));
    }
    written.push(threat.number);
    if (!carried.has(threat.number)) {
      issued.push(threat.number);
    }
    const category = fromThreatCategory(threat.category);
    if (!equivalent(toThreatCategory(category).value, threat.category)) {
      divergences.push(unnamedCategory(threat));
    }
    for (const id of placed) {
      const list = byCell.get(id) ?? [];
      list.push(
        projectThreat(threat, nested.get(id)?.get(threat.id), category),
      );
      byCell.set(id, list);
    }
  }
  return {
    byCell: new Map(
      [...byCell].map(([id, list]) => [id, inSourceOrder(list, hosts.get(id))]),
    ),
    threatTop: highWaterMark(model, source, written, issued),
    divergences,
  };
}

function elementKinds(model: Model): ReadonlyMap<string, Element['kind']> {
  return new Map(
    model.diagrams.flatMap((diagram) =>
      diagram.elements.map((element): [string, Element['kind']] => [
        element.id,
        element.kind,
      ]),
    ),
  );
}

function canHost(
  kinds: ReadonlyMap<string, Element['kind']>,
  id: string,
): boolean {
  const kind = kinds.get(id);
  return (
    kind === 'actor' ||
    kind === 'process' ||
    kind === 'store' ||
    kind === 'flow'
  );
}

function highWaterMark(
  model: Model,
  source: ThreatDragonDocument | undefined,
  written: readonly number[],
  issued: readonly number[],
): HighWaterMark {
  const held = Math.max(0, ...written);
  const floor = source?.detail.threatTop ?? held;
  const unreachable =
    Math.max(floor, held) < model.lastIssuedThreatNumber
      ? model.lastIssuedThreatNumber
      : 0;
  return {
    value: Math.max(floor, ...issued, unreachable),
    cause: unreachable > 0 ? 'unreachable' : 'issued',
  };
}

function inSourceOrder(
  threats: readonly ThreatDragonThreat[],
  host: ThreatDragonHost | undefined,
): readonly ThreatDragonThreat[] {
  if (host === undefined) {
    return threats;
  }
  const written = indexById(threats);
  const held = new Set<string>(threatsOf(host).map((threat) => threat.id));
  return [
    ...threatsOf(host).flatMap((threat) => {
      const kept = written.get(threat.id);
      return kept === undefined ? [] : [kept];
    }),
    ...threats.filter((threat) => !held.has(threat.id)),
  ];
}

function projectThreat(
  threat: Threat,
  held: ThreatDragonThreat | undefined,
  category: ThreatDragonCategoryFields,
): ThreatDragonThreat {
  const named =
    held !== undefined &&
    equivalent(toThreatCategory(held).value, threat.category);
  return {
    ...held,
    ...(named ? {} : category),
    id: threat.id,
    number: threat.number,
    title: threat.title,
    status:
      held !== undefined && toThreatStatus(held.status).value === threat.status
        ? held.status
        : fromThreatStatus(threat.status),
    severity:
      held !== undefined && toSeverity(held.severity).value === threat.severity
        ? held.severity
        : fromSeverity(threat.severity),
    description: threat.description,
    mitigation: threat.mitigation,
  };
}

function strayAttachment(
  threat: ThreatId,
  element: string,
  kind: Element['kind'] | undefined,
): Divergence {
  return {
    subject: { kind: 'threat', id: threat },
    detail: `the attachment to the ${kind ?? 'unknown'} "${element}", which the format nests a threat under an actor, a process, a store, or a flow alone`,
    reason: 'unrepresentable',
  };
}

function unplaceable(threat: ThreatId): Divergence {
  return {
    subject: { kind: 'threat', id: threat },
    detail:
      'the threat itself, which the format holds nowhere but under a cell and this one names none it can nest under',
    reason: 'unrepresentable',
  };
}

function split(threat: ThreatId, count: number): Divergence {
  return {
    subject: { kind: 'threat', id: threat },
    detail: `the one record, written once under each of the ${count} elements it names`,
    reason: 'split',
  };
}

function unnamedCategory(threat: Threat): Divergence {
  return {
    subject: { kind: 'threat', id: threat.id },
    detail: `the ${threat.category.methodology} category "${threat.category.category}", which Threat Dragon's own labels do not name`,
    reason: 'narrowed',
  };
}
