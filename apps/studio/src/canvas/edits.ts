import type { ElementId, Model } from '@panoptes/model';
import { Action } from '../store/actions.js';
import { firstDiagramId } from '../store/selectors.js';
import type { State } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import { announce } from './announcements.js';
import {
  freePosition,
  freshElement,
  freshFlow,
  type PaletteKind,
} from './elements.js';
import { currentLayout } from './layout.js';
import { accessibleNames } from './names.js';

/**
 * What a removal takes with the element, counted before it happens. The model
 * keeps a flow whose end was attached and frees that end, and keeps a threat
 * whose link named the element and drops the link, so both are changes a
 * person watching the canvas has to be told about rather than losses.
 */
export type RemovalCascade = {
  readonly flows: number;
  readonly threats: number;
};

/**
 * Adds one element of `kind` to the diagram on screen, selects it, says so,
 * and moves focus to it. The add is one action and so one step of the undo
 * stack; the selection that follows is not, the store keeping selection out
 * of its history.
 */
export function addPaletteElement(kind: PaletteKind): void {
  const state = modelStore.getState();
  const diagramId = firstDiagramId(state);
  if (diagramId === undefined) {
    return;
  }
  const element = freshElement(kind, freePosition(currentLayout(state)));
  added(Action.AddElement({ diagramId, element }), element.id);
}

/**
 * Draws a flow from one element to another, on the same terms as
 * {@link addPaletteElement}: one action, then the selection and the focus.
 * Both ways of connecting land here, so a drag between handles and a choice
 * from the palette's listbox add the same flow.
 */
export function connectElements(source: ElementId, target: ElementId): void {
  const state = modelStore.getState();
  const diagramId = firstDiagramId(state);
  if (diagramId === undefined) {
    return;
  }
  const flow = freshFlow(source, target);
  added(Action.AddElement({ diagramId, element: flow }), flow.id);
}

/**
 * Removes the selected element, saying what went with it. Reports whether the
 * model moved, so the caller knows whether a key press did anything and where
 * focus has to go next. The cascade is the model's own: the reducer applies
 * it, the canvas draws the result because it derives from the store, and this
 * counts it beforehand only to be able to say it.
 */
export function removeSelected(): boolean {
  const state = modelStore.getState();
  const elementId = state.selection;
  if (elementId === undefined) {
    return false;
  }
  const name = spokenName(state, elementId);
  const cascade = removalCascade(state.present, elementId);
  if (!changedModel(Action.RemoveElement({ elementId }))) {
    return false;
  }
  announce(describeRemoval(name, cascade));
  return true;
}

/**
 * How many flows lose an end and how many threats lose a link when the
 * element named is removed. Flows are counted across the model because a
 * flow's ends name elements of its own diagram, so no flow elsewhere can
 * hold this one.
 */
export function removalCascade(
  model: Model,
  elementId: ElementId,
): RemovalCascade {
  const flows = model.diagrams
    .flatMap((diagram) => diagram.elements)
    .filter(
      (element) =>
        element.kind === 'flow' &&
        [element.source, element.target].some(
          (endpoint) =>
            endpoint.kind === 'attached' && endpoint.element === elementId,
        ),
    ).length;
  const threats = model.threats.filter((threat) =>
    threat.elements.includes(elementId),
  ).length;
  return { flows, threats };
}

/**
 * A removal in words: what went, and what the model changed around it. The
 * counts are always said, a zero among them included, so silence never has
 * to be read as either nothing happening or nothing being counted.
 */
export function describeRemoval(name: string, cascade: RemovalCascade): string {
  const flows = counted(cascade.flows, 'flow');
  const threats = counted(cascade.threats, 'threat link');
  return `Removed ${name}. ${flows} detached, ${threats} dropped.`;
}

function added(action: Action, elementId: ElementId): void {
  if (!changedModel(action)) {
    return;
  }
  dispatch(Action.Select({ elementId }));
  announce(`Added ${spokenName(modelStore.getState(), elementId)}.`);
  focusElement(elementId);
}

function changedModel(action: Action): boolean {
  const before = modelStore.getState().present;
  dispatch(action);
  return modelStore.getState().present !== before;
}

function spokenName(state: State, elementId: ElementId): string {
  return accessibleNames(currentLayout(state)).get(elementId) ?? elementId;
}

function counted(total: number, thing: string): string {
  if (total === 0) {
    return `no ${thing}s`;
  }
  return total === 1 ? `1 ${thing}` : `${String(total)} ${thing}s`;
}

const focusAttempts = 3;

function focusElement(elementId: ElementId, attempts = focusAttempts): void {
  const drawn = [
    ...document.querySelectorAll('.react-flow__node, .react-flow__edge'),
  ].find((candidate) => candidate.getAttribute('data-id') === elementId);
  if (drawn instanceof HTMLElement || drawn instanceof SVGElement) {
    drawn.focus();
    return;
  }
  if (attempts > 1) {
    requestAnimationFrame(() => {
      focusElement(elementId, attempts - 1);
    });
  }
}
