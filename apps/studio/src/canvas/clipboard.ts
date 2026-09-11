import { gridSpacing } from '@saerskriven/canvas';
import { saerskrivenYamlCodec, withinTextLimit } from '@saerskriven/formats';
import {
  generateElementId,
  remapFragment,
  selectionFragment,
  type Model,
} from '@saerskriven/model';
import { Data, Effect, Either } from 'effect';
import { Action } from '../store/actions.js';
import { sameSelection } from '../store/selection.js';
import { activeDiagramId } from '../store/selectors.js';
import { FileLifecycle, type State } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import { announce } from './announcements.js';
import { focusElement, removeSelected } from './edits.js';

const marker = '# Saerskriven selection v1\n';
let lastPaste = '';
let pasteCount = 0;

type ClipboardFailure = Data.TaggedEnum<{
  Refused: { readonly reason: string };
}>;
const ClipboardFailure = Data.taggedEnum<ClipboardFailure>();

function selectedCopy(
  state: State,
): Either.Either<
  { readonly fragment: Model; readonly text: string; readonly report: string },
  ClipboardFailure
> {
  const diagramId = activeDiagramId(state);
  if (diagramId === undefined || state.selection.length === 0) {
    return Either.left(
      ClipboardFailure.Refused({ reason: 'Select elements to copy.' }),
    );
  }
  return Either.flatMap(
    Either.mapLeft(
      selectionFragment(state.present, diagramId, state.selection),
      (failure) =>
        ClipboardFailure.Refused({ reason: `Copy refused: ${failure._tag}.` }),
    ),
    (fragment) => {
      const text = marker + saerskrivenYamlCodec.write(fragment).output;
      const limit = withinTextLimit(text);
      if (Either.isLeft(limit)) {
        return Either.left(
          ClipboardFailure.Refused({
            reason: 'The selection exceeds the clipboard size limit.',
          }),
        );
      }
      const copiedIds = new Set(
        fragment.diagrams.flatMap((item) =>
          item.elements.map((element) => element.id),
        ),
      );
      const copiedThreats = new Set(
        fragment.threats.map((threat) => threat.id),
      );
      const externalLinks =
        state.present.threats
          .filter((item) => copiedThreats.has(item.id))
          .reduce(
            (count, item) =>
              count + item.elements.filter((id) => !copiedIds.has(id)).length,
            0,
          ) +
        state.present.mitigations
          .filter((item) =>
            fragment.mitigations.some((copy) => copy.id === item.id),
          )
          .reduce(
            (count, item) =>
              count +
              item.threats.filter((id) => !copiedThreats.has(id)).length,
            0,
          ) +
        state.present.assumptions
          .filter((item) =>
            fragment.assumptions.some((copy) => copy.id === item.id),
          )
          .reduce(
            (count, item) =>
              count +
              item.elements.filter((id) => !copiedIds.has(id)).length +
              item.threats.filter((id) => !copiedThreats.has(id)).length,
            0,
          );
      const extras =
        FileLifecycle.$is('Opened')(state.file) &&
        state.file.source.format === 'threat-dragon'
          ? ' Source-format fields outside the model are not copied.'
          : '';
      return Either.right({
        fragment,
        text,
        report: `${String(copiedIds.size)} elements and ${String(fragment.threats.length)} threats. ${String(externalLinks)} external links excluded.${extras}`,
      });
    },
  );
}

/** Copies the selection to the system clipboard and cuts only after a successful write. */
export async function copySelected(cut = false): Promise<void> {
  const state = modelStore.getState();
  const copy = selectedCopy(state);
  if (Either.isLeft(copy)) {
    announce(copy.left.reason);
    return;
  }
  const written = await Effect.runPromise(
    Effect.either(
      Effect.tryPromise({
        try: async () => {
          await navigator.clipboard.writeText(copy.right.text);
        },
        catch: () =>
          ClipboardFailure.Refused({
            reason:
              'Clipboard write failed. Nothing was cut. Check browser clipboard permission.',
          }),
      }),
    ),
  );
  if (Either.isLeft(written)) {
    announce(written.left.reason);
    return;
  }
  if (
    cut &&
    modelStore.getState().present === state.present &&
    sameSelection(modelStore.getState().selection, state.selection)
  ) {
    removeSelected();
    announce(
      `Cut selection. Copied ${copy.right.report} Original threats remain in the register. Other attached flows retain free endpoints.`,
    );
    document.querySelector<HTMLElement>('.react-flow')?.focus();
  } else {
    announce(
      `Copied ${copy.right.report}${cut ? ' The selection changed while copying. Nothing was cut.' : ''}`,
    );
  }
}

/** Duplicates through the same copy rules without changing the system clipboard. */
export function duplicateSelected(): void {
  const copy = selectedCopy(modelStore.getState());
  if (Either.isLeft(copy)) {
    announce(copy.left.reason);
    return;
  }
  insertCopy(
    copy.right.fragment,
    gridSpacing,
    `Duplicated ${copy.right.report}`,
  );
}

/** Reads a bounded native selection from the system clipboard before one atomic insert. */
export async function pasteSelected(): Promise<void> {
  const state = modelStore.getState();
  const read = await Effect.runPromise(
    Effect.either(
      Effect.tryPromise({
        try: () => navigator.clipboard.readText(),
        catch: () =>
          ClipboardFailure.Refused({
            reason:
              'Clipboard read failed. Check browser clipboard permission.',
          }),
      }),
    ),
  );
  if (Either.isLeft(read)) {
    announce(read.left.reason);
    return;
  }
  if (
    modelStore.getState().present !== state.present ||
    modelStore.getState().file !== state.file
  ) {
    announce('The document changed while reading the clipboard. Paste again.');
    return;
  }
  const text = read.right;
  if (!text.startsWith(marker)) {
    announce('The clipboard contains no Saerskriven selection.');
    return;
  }
  const parsed = saerskrivenYamlCodec.read(text);
  if (
    Either.isLeft(parsed) ||
    parsed.right.divergences.length > 0 ||
    parsed.right.model.diagrams.length !== 1
  ) {
    announce(
      'The clipboard selection is invalid, unsupported, or exceeds a read limit.',
    );
    return;
  }
  const count = text === lastPaste ? pasteCount + 1 : 1;
  if (
    insertCopy(
      parsed.right.model,
      gridSpacing * count,
      'Pasted selection with new element and threat IDs.',
    )
  ) {
    lastPaste = text;
    pasteCount = count;
  }
}

function insertCopy(
  fragment: Model,
  distance: number,
  message: string,
): boolean {
  const state = modelStore.getState();
  const diagramId = activeDiagramId(state);
  if (diagramId === undefined) {
    announce('There is no diagram to paste into.');
    return false;
  }
  const remapped = remapFragment(fragment, generateElementId(), {
    x: distance,
    y: distance,
  });
  if (Either.isLeft(remapped)) {
    announce('The copied graph could not be remapped.');
    return false;
  }
  dispatch(Action.InsertFragment({ diagramId, fragment: remapped.right }));
  if (modelStore.getState().present === state.present) {
    return false;
  }
  const ids = remapped.right.diagrams.flatMap((item) =>
    item.elements.map((element) => element.id),
  );
  dispatch(Action.Select({ elementIds: ids }));
  const first = ids[0];
  if (first !== undefined) {
    focusElement(first);
  }
  announce(message);
  return true;
}
