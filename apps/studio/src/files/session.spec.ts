import {
  ReadFailure,
  hasDiverged,
  panoptesYamlCodec,
  threatDragonCodec,
  type Divergence,
} from '@panoptes/formats';
import { Action } from '../store/actions.js';
import { FileLifecycle } from '../store/state.js';
import {
  foreignSource,
  nativeSource,
  sampleModel,
} from '../store/store.fixtures.js';
import { OpenOutcome, SaveOutcome } from './bridge.js';
import {
  formatOf,
  nameOf,
  openedBy,
  otherFormat,
  proposedName,
  reportLines,
  saveTarget,
  savedBy,
  writeThrough,
} from './session.js';

type OutcomesByTag<Outcome extends { readonly _tag: string }> = {
  readonly [Tag in Outcome['_tag']]: Extract<Outcome, { readonly _tag: Tag }>;
};

const nativeText = panoptesYamlCodec.write(sampleModel).output;

const foreignText = threatDragonCodec.write(sampleModel).output;

const openOutcomes: OutcomesByTag<OpenOutcome> = {
  Chosen: OpenOutcome.Chosen({ name: 'model.yaml', text: nativeText }),
  TooLarge: OpenOutcome.TooLarge({
    name: 'huge.json',
    bound: 4,
    observed: 40,
  }),
  Unreadable: OpenOutcome.Unreadable({ reason: 'The file was moved.' }),
  Cancelled: OpenOutcome.Cancelled(),
  NoPicker: OpenOutcome.NoPicker(),
};

const saveOutcomes: OutcomesByTag<SaveOutcome> = {
  Written: SaveOutcome.Written({ name: 'model.yaml' }),
  Cancelled: SaveOutcome.Cancelled(),
  Refused: SaveOutcome.Refused({ reason: 'The folder is read only.' }),
};

const openedNative = FileLifecycle.Opened({
  name: 'model.yaml',
  source: nativeSource,
});

const openedForeign = FileLifecycle.Opened({
  name: 'model.json',
  source: foreignSource,
});

describe('openedBy', () => {
  it('opens a text the native codec claims, keeping the document it read', () => {
    const action = openedBy(openOutcomes.Chosen);

    expect(action?._tag).toBe('Opened');
    expect(action).toMatchObject({
      name: 'model.yaml',
      source: { format: 'panoptes-yaml' },
    });
  });

  it('opens a text the Threat Dragon codec claims as that format', () => {
    const action = openedBy(
      OpenOutcome.Chosen({ name: 'model.json', text: foreignText }),
    );

    expect(action).toMatchObject({
      _tag: 'Opened',
      source: { format: 'threat-dragon' },
    });
  });

  it('retains the document a read produced, so a save has something to merge onto', () => {
    const action = openedBy(
      OpenOutcome.Chosen({ name: 'model.json', text: foreignText }),
    );

    expect(
      action?._tag === 'Opened' ? action.source.document : undefined,
    ).toBeDefined();
  });

  it('reports a text no format claimed, naming what was tried', () => {
    const action = openedBy(
      OpenOutcome.Chosen({ name: 'notes.txt', text: 'nothing to read here' }),
    );

    expect(action).toMatchObject({
      _tag: 'ReadFailed',
      name: 'notes.txt',
      failure: { _tag: 'NoFormatClaimed' },
    });
  });

  it('reports where a claimed file broke, with the path into it', () => {
    const broken = JSON.stringify({
      version: '2.0',
      summary: { title: 'Broken' },
      detail: { diagrams: [{ id: 0 }] },
    });

    const action = openedBy(
      OpenOutcome.Chosen({ name: 'broken.json', text: broken }),
    );

    expect(action).toMatchObject({
      _tag: 'ReadFailed',
      failure: { _tag: 'InvalidWireDocument' },
    });
  });

  it('reports a file past the bound as the codecs report one', () => {
    expect(openedBy(openOutcomes.TooLarge)).toEqual(
      Action.ReadFailed({
        name: 'huge.json',
        failure: ReadFailure.ExceededReadLimit({
          limit: 'maxTextBytes',
          bound: 4,
          observed: 40,
        }),
      }),
    );
  });

  it('reports a file the platform would not hand over', () => {
    expect(openedBy(openOutcomes.Unreadable)).toEqual(
      Action.FileRefused({ reason: 'The file was moved.' }),
    );
  });

  it('dispatches nothing where there is nothing to record', () => {
    expect(openedBy(openOutcomes.Cancelled)).toBeUndefined();
    expect(openedBy(openOutcomes.NoPicker)).toBeUndefined();
  });
});

describe('savedBy', () => {
  it('names the file the text reached rather than the one proposed', () => {
    expect(savedBy(saveOutcomes.Written, nativeSource)).toEqual(
      Action.Saved({ name: 'model.yaml', source: nativeSource }),
    );
  });

  it('dispatches nothing where the person dismissed the picker', () => {
    expect(savedBy(saveOutcomes.Cancelled, nativeSource)).toBeUndefined();
  });

  it('reports a write the platform refused', () => {
    expect(savedBy(saveOutcomes.Refused, nativeSource)).toEqual(
      Action.FileRefused({ reason: 'The folder is read only.' }),
    );
  });
});

describe('saveTarget', () => {
  it('proposes a file in the native format while the model is in none', () => {
    expect(saveTarget(FileLifecycle.NoFile(), 'panoptes-yaml')).toEqual({
      name: 'threat-model.yaml',
      source: nativeSource,
    });
  });

  it('writes back to the open file, merging onto what its read retained', () => {
    expect(saveTarget(openedNative, 'panoptes-yaml')).toEqual({
      name: 'model.yaml',
      source: nativeSource,
    });
  });

  it('has nothing to merge onto when the target is another format', () => {
    expect(saveTarget(openedForeign, 'panoptes-yaml')).toEqual({
      name: 'model.yaml',
      source: nativeSource,
    });
  });
});

describe('naming', () => {
  it('carries the extension of the format it targets', () => {
    expect(proposedName('model.json', 'panoptes-yaml')).toBe('model.yaml');
    expect(proposedName('model.yaml', 'threat-dragon')).toBe('model.json');
  });

  it('names a file that would otherwise be all extension', () => {
    expect(proposedName('.yaml', 'panoptes-yaml')).toBe('threat-model.yaml');
  });

  it('offers the format the file is not in', () => {
    expect(otherFormat('panoptes-yaml')).toBe('threat-dragon');
    expect(otherFormat('threat-dragon')).toBe('panoptes-yaml');
  });

  it('reads the format and the name of the file the model lives in', () => {
    expect(formatOf(FileLifecycle.NoFile())).toBe('panoptes-yaml');
    expect(formatOf(openedForeign)).toBe('threat-dragon');
    expect(nameOf(FileLifecycle.NoFile())).toBe('No file');
    expect(nameOf(openedForeign)).toBe('model.json');
  });
});

describe('writeThrough', () => {
  it('writes the format the source names', () => {
    expect(writeThrough(sampleModel, nativeSource).output).toBe(nativeText);
    expect(writeThrough(sampleModel, foreignSource).output).toBe(foreignText);
  });

  it('reports what a format with no place for the model could not hold', () => {
    expect(
      hasDiverged(writeThrough(sampleModel, nativeSource).divergences),
    ).toBe(false);
    expect(
      hasDiverged(writeThrough(sampleModel, foreignSource).divergences),
    ).toBe(true);
  });
});

describe('reportLines', () => {
  it('says nothing at all where nothing diverged', () => {
    expect(reportLines([])).toEqual([]);
  });

  it('renders one line an entry, naming the entity and the reason', () => {
    const divergences: readonly Divergence[] = [
      {
        subject: { kind: 'model' },
        detail: 'A mitigation has no place in the format',
        reason: 'unrepresentable',
      },
    ];

    expect(reportLines(divergences)).toEqual([
      'model: A mitigation has no place in the format (no place in the format)',
    ]);
  });
});
