import { Either } from 'effect';
import { promptProseOf } from '../fixtures.js';
import { dataNotInstructions } from './preface.js';
import { promptResult } from './prompt-result.js';
import {
  answerOf,
  ecluseWorkspace,
  refusalOf,
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
    const pass = answerOf(stridePass(ecluse, { element: 'Écluse proxy' }));
    const [data, brief] = promptProseOf(promptResult(Either.right(pass))).prose;
    expect(data?.split('\n')[0]).toEqual(dataNotInstructions);
    expect(brief).toEqual(strideBrief('process').join('\n'));
    expect(section(pass.data, 'flows:').length).toBeGreaterThan(0);
  });

  it("renders on the repository's own model, alike by id and by name", () => {
    const byId = answerOf(stridePass(saerskriven, { element: 'el-read' }));
    expect(
      answerOf(stridePass(saerskriven, { element: 'Codec read' })),
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
    const store = answerOf(stridePass(saerskriven, { element: 'el-model' }));
    const flow = answerOf(stridePass(saerskriven, { element: 'fl-open' }));
    expect(store.brief).toEqual(strideBrief('store'));
    expect(flow.brief).toEqual(strideBrief('flow'));
    expect(section(flow.data, 'stores the flows reach:')).toEqual([
      'el-model-file',
    ]);
    expect(strideByKind.process).toHaveLength(6);
  });
});

describe('what stride_pass refuses', () => {
  it('refuses an element the model does not hold', () => {
    expect(refusalOf(stridePass(ecluse, { element: 'Nothing' }))[0]).toContain(
      'holds no element "Nothing"',
    );
  });

  it('asks for an id where a name is shared', () => {
    const shared = treeHolding(
      saerskrivenYaml().replace('name: Codec write', 'name: Codec read'),
    );
    const refused = refusalOf(stridePass(shared, { element: 'Codec read' }));
    expect(refused.slice(1).map((line) => line.trim().split(' ')[0])).toEqual([
      '"el-read"',
      '"el-write"',
    ]);
  });

  it('refuses a trust boundary', () => {
    expect(
      refusalOf(stridePass(saerskriven, { element: 'tb-foreign' }))[0],
    ).toContain('is a trust-boundary');
  });

  it('refuses a model outside the root, opened by the data line', () => {
    const result = promptResult(
      stridePass(rootWorkspace(), { file: '../outside.yaml', element: 'x' }),
    );
    expect(result.messages).toHaveLength(1);
    expect(promptProseOf(result).prose[0]?.split('\n')).toEqual([
      dataNotInstructions,
      ...refusalOf(
        stridePass(rootWorkspace(), { file: '../outside.yaml', element: 'x' }),
      ),
    ]);
  });
});
