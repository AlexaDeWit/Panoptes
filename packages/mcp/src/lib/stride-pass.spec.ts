import { Either } from 'effect';
import { promptProseOf } from '../fixtures.js';
import { dataNotInstructions } from './preface.js';
import { PromptFailure, promptMessages } from './prompt-result.js';
import {
  ecluseWorkspace,
  rootWorkspace,
  saerskrivenWorkspace,
  saerskrivenYaml,
  treeHolding,
} from './read-tools.fixtures.js';
import { strideBrief, strideByKind, stridePass } from './stride-pass.js';

const ecluse = ecluseWorkspace();

const saerskriven = saerskrivenWorkspace();

const section = (data: readonly string[], heading: string) => {
  const start = data.indexOf(heading) + 1;
  const end = data.findIndex(
    (line, index) => index >= start && !line.startsWith(' '),
  );
  return data
    .slice(start, end === -1 ? undefined : end)
    .filter((line) => /^ {2}\S/.test(line))
    .map((line) => line.trim().split(' ')[0]);
};

describe('what stride_pass renders', () => {
  it('renders on the Écluse fixture for an element named by its name', () => {
    const pass = Either.getOrThrow(
      stridePass(ecluse, { element: 'Écluse proxy' }),
    );
    const [data, brief] = promptProseOf(promptMessages(pass)).prose;
    expect(data?.split('\n')[0]).toEqual(dataNotInstructions);
    expect(brief).toEqual(strideBrief('process').join('\n'));
    expect(section(pass.data, 'flows:').length).toBeGreaterThan(0);
  });

  it("renders on the repository's own model, alike by id and by name", () => {
    const byId = Either.getOrThrow(
      stridePass(saerskriven, { element: 'el-read' }),
    );
    expect(
      Either.getOrThrow(stridePass(saerskriven, { element: 'Codec read' })),
    ).toEqual(byId);
    expect({
      element: section(byId.data, 'element:'),
      flows: section(byId.data, 'flows:'),
      stores: section(byId.data, 'stores the flows reach:'),
    }).toEqual({
      element: ['el-read'],
      flows: ['fl-open', 'fl-mapped'],
      stores: ['el-model-file', 'el-model'],
    });
  });

  it('asks the questions of the kind, and the brief carries nothing from the model', () => {
    const store = Either.getOrThrow(
      stridePass(saerskriven, { element: 'el-model' }),
    );
    const flow = Either.getOrThrow(
      stridePass(saerskriven, { element: 'fl-open' }),
    );
    expect(store.brief).toEqual(strideBrief('store'));
    expect(flow.brief).toEqual(strideBrief('flow'));
    expect(section(flow.data, 'stores the flows reach:')).toEqual([
      'el-model-file',
    ]);
    expect(strideByKind.process).toHaveLength(6);
  });
});

describe('why stride_pass has no prompt', () => {
  it('fails on an element the model does not hold', () => {
    expect(stridePass(ecluse, { element: 'Nothing' })).toEqual(
      Either.left(PromptFailure.NoSuchElement()),
    );
  });

  it('fails on a name several elements share', () => {
    const shared = treeHolding(
      saerskrivenYaml().replace('name: Codec write', 'name: Codec read'),
    );
    expect(stridePass(shared, { element: 'Codec read' })).toEqual(
      Either.left(PromptFailure.SharedName()),
    );
  });

  it('fails on a trust boundary', () => {
    expect(stridePass(saerskriven, { element: 'tb-foreign' })).toEqual(
      Either.left(PromptFailure.UncoveredKind()),
    );
  });

  it('fails with no model on a file outside the root', () => {
    expect(
      stridePass(rootWorkspace(), { file: '../outside.yaml', element: 'x' }),
    ).toEqual(Either.left(PromptFailure.NoModel()));
  });
});
