import {
  hasDiverged,
  readAnyFormat,
  readLimits,
  renderDivergences,
  type Divergence,
  type FormatName,
} from '@panoptes/formats';
import { Ajv } from 'ajv';
import { Either } from 'effect';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Action } from '../store/actions.js';
import { isDirty } from '../store/selectors.js';
import {
  FileLifecycle,
  initialState,
  placeholderModel,
} from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import { specBridge, vendoredFile, type SpecBridge } from './files.fixtures.js';
import {
  formatOf,
  openedBy,
  saveTarget,
  savedBy,
  writeThrough,
} from './session.js';

type Gated = {
  readonly path: string;
  readonly format: FormatName;
};

const gated: readonly Gated[] = [
  { path: 'test-data/ecluse.json', format: 'threat-dragon' },
  { path: 'threat-modelling/panoptes.yaml', format: 'panoptes-yaml' },
];

/**
 * The JSON Schema Threat Dragon validates a v2 model against before it opens
 * one, run through the validator Threat Dragon itself runs, so what the
 * studio writes is gated by the tool that has to read it.
 */
const validate = new Ajv({ allowUnionTypes: true }).compile(
  JSON.parse(
    readFileSync(
      join(
        import.meta.dirname,
        '../../../../test-data/threat-dragon/schema/threat-dragon-v2.schema.json',
      ),
      'utf8',
    ),
  ),
);

/**
 * A written file as it is compared against the one it was read from. JSON
 * carries no meaning in its key order, so a Threat Dragon file is compared
 * as the document it parses to; the native format writes one file per model
 * and is compared as the bytes it is.
 */
const asDocument = (format: FormatName, text: string): unknown =>
  format === 'threat-dragon' ? JSON.parse(text) : text;

const applied = (action: Action | undefined): void => {
  if (action === undefined) {
    throw new Error('The file path produced no action to dispatch.');
  }
  dispatch(action);
};

const opened = async (bridge: SpecBridge): Promise<void> => {
  applied(openedBy(await bridge.open(readLimits.maxTextBytes)));
};

const saved = async (bridge: SpecBridge): Promise<readonly Divergence[]> => {
  const state = modelStore.getState();
  const target = saveTarget(state.file, formatOf(state.file));
  const written = writeThrough(state.present, target.source);
  applied(
    savedBy(await bridge.save(target.name, written.output), target.source),
  );
  return written.divergences;
};

describe.each(gated)('$path', ({ path, format }) => {
  beforeEach(() => {
    modelStore.setState(initialState(placeholderModel), true);
  });

  it('opens as the format its content declares', async () => {
    await opened(specBridge({ offers: vendoredFile(path) }));

    const state = modelStore.getState();
    expect(state.lastFailure).toBeUndefined();
    expect(FileLifecycle.$is('Opened')(state.file)).toBe(true);
    expect(formatOf(state.file)).toBe(format);
    expect(state.present.diagrams.length > 0).toBe(true);
    expect(isDirty(state)).toBe(false);
  });

  it('saves back with no edit, losing nothing and reporting nothing', async () => {
    const bridge = specBridge({ offers: vendoredFile(path) });
    await opened(bridge);
    const before = modelStore.getState().present;

    const divergences = await saved(bridge);

    expect(renderDivergences(divergences)).toBe('No divergence recorded.');
    expect(hasDiverged(divergences)).toBe(false);
    expect(isDirty(modelStore.getState())).toBe(false);
    expect(bridge.writes).toHaveLength(1);

    const reread = readAnyFormat(bridge.writes[0].text);
    expect(Either.isRight(reread)).toBe(true);
    expect(Either.getOrThrow(reread).model).toStrictEqual(before);
  });

  it('writes back everything the file said, the parts the model has no home for included', async () => {
    const bridge = specBridge({ offers: vendoredFile(path) });
    await opened(bridge);

    await saved(bridge);

    expect(asDocument(format, bridge.writes[0].text)).toStrictEqual(
      asDocument(format, await vendoredFile(path).text()),
    );
  });
});

describe('the Threat Dragon file the studio writes', () => {
  it('validates against the schema Threat Dragon opens a model with', async () => {
    modelStore.setState(initialState(placeholderModel), true);
    const bridge = specBridge({
      offers: vendoredFile('test-data/ecluse.json'),
    });
    await opened(bridge);
    await saved(bridge);

    const document: unknown = JSON.parse(bridge.writes[0].text);
    const valid = validate(document);

    expect(validate.errors ?? []).toEqual([]);
    expect(valid).toBe(true);
  });
});
