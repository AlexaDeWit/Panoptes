import {
  generateThreatId,
  nextThreatNumber,
  threatSchema,
  type Element,
  type ElementId,
  type Threat,
  type ThreatId,
} from '@panoptes/model';
import { Action } from '../store/actions.js';
import type { State } from '../store/state.js';

const threatFields = threatSchema.keyof().options;

const kindWords = {
  actor: 'actor',
  process: 'process',
  store: 'store',
  text: 'text',
  flow: 'flow',
  'trust-boundary': 'trust boundary',
} as const satisfies Record<Element['kind'], string>;

/**
 * The element the panel edits, which is the one the canvas has selected, and
 * nothing at all while nothing is selected. A flow is an element like any
 * other here: it carries threats, so it opens the panel as a box does. The
 * canvas has a selector of its own over the same field, which returns the id
 * it draws the selection from rather than the record this one reads.
 */
export function panelElement(state: State): Element | undefined {
  const selected = state.selection;
  return selected === undefined
    ? undefined
    : state.present.diagrams
        .flatMap((diagram) => diagram.elements)
        .find((element) => element.id === selected);
}

/**
 * Every threat naming the selected element, in register order, and none while
 * nothing is selected. Status plays no part: the panel lists what has been
 * recorded against the element, where the canvas badge counts what is still
 * open. The array is rebuilt on every call, so a component reading it
 * subscribes through zustand's `useShallow`.
 */
export function attachedThreats(state: State): readonly Threat[] {
  const selected = state.selection;
  return selected === undefined
    ? []
    : state.present.threats.filter((threat) =>
        threat.elements.includes(selected),
      );
}

/** What the panel calls an element: its name, or what kind it is while it has none. */
export function elementLabel(element: Element): string {
  return element.name === '' ? `the ${kindWords[element.kind]}` : element.name;
}

/** The number the next threat added here takes, which the model issues. */
export function nextNumber(state: State): number {
  return nextThreatNumber(state.present);
}

/**
 * The threat an add starts from, attached to the element the panel is bound
 * to and carrying the number the model issued for it. The model defines no
 * defaults, so the panel chooses the ones that claim least: `undecided` is
 * the severity the model offers for a threat nobody has assessed, `open` the
 * status for one nobody has dispositioned, and STRIDE's first category stands
 * until the person picks the case, the category union having no member for
 * "not yet decided".
 */
export function freshThreat(number: number, elementId: ElementId): Threat {
  return {
    id: generateThreatId(),
    number,
    title: 'New threat',
    category: { methodology: 'STRIDE', category: 'spoofing' },
    severity: 'undecided',
    status: 'open',
    description: '',
    mitigation: '',
    elements: [elementId],
  };
}

/**
 * Which threat the panel focuses once `deleted` is gone: the one that takes
 * its place in the list, the one before it where it was last, and nothing at
 * all where it was the only one, which is the panel's word for the add
 * control.
 */
export function threatAfterDeleting(
  threats: readonly Threat[],
  deleted: ThreatId,
): ThreatId | undefined {
  const index = threats.findIndex((threat) => threat.id === deleted);
  if (index < 0) {
    return undefined;
  }
  const next =
    threats.at(index + 1) ?? (index > 0 ? threats.at(index - 1) : undefined);
  return next?.id;
}

/**
 * The panel's commit handler, bound to one threat. A field hands it what it
 * changed and the change leaves as one `ReplaceThreat`, so every field of the
 * panel commits the same way and one edit is one undo step. A patch that
 * leaves every field as it was dispatches nothing: a model operation returns
 * a new model whatever it was asked to do, so the store would push an undo
 * entry and mark the file dirty over an edit nobody made. Fields are compared
 * by identity, which is exact for the threat's scalars and reads a rebuilt
 * category or element list as a change.
 */
export function threatCommitter(
  send: (action: Action) => void,
  threat: Threat | undefined,
): (patch: Partial<Threat>) => void {
  return (patch) => {
    if (threat === undefined) {
      return;
    }
    const edited = { ...threat, ...patch };
    if (threatFields.some((field) => edited[field] !== threat[field])) {
      send(Action.ReplaceThreat({ threat: edited }));
    }
  };
}
