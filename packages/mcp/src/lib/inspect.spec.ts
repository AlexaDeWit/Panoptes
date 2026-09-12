import { Either } from 'effect';
import { inspect, renderInspection } from './inspect.js';
import { workspaceTree } from './workspace.fixtures.js';
import { openWorkspace } from './workspace.js';

const tree = workspaceTree();

const workspace = Either.getOrThrow(openWorkspace({ root: tree.root }));

const rendered = (file?: string): readonly string[] =>
  Either.match(inspect(workspace, { file }), {
    onLeft: (refusal) => refusal,
    onRight: renderInspection,
  });

describe('what an inspection reads as', () => {
  it('states the file, the format, the handle and the counts', () => {
    expect(rendered('small.yaml')).toEqual([
      'file: small.yaml',
      'format: saerskriven-yaml',
      expect.stringMatching(/^revision: sha256:[0-9a-f]{64}$/u),
      'title: Small',
      'owner: Owner',
      'totals: diagrams 0, elements 0, threats 1, mitigations 0, assumptions 0',
      'diagrams:',
      'divergences:',
      'No divergence recorded.',
    ]);
  });

  it('offers the candidates where no file was named and none is default', () => {
    expect(rendered()[0]).toEqual(
      'No file was named and this server carries no default, so these are the model files under the root:',
    );
  });

  it('reads the default file where a call names none', () => {
    const withDefault = Either.getOrThrow(
      openWorkspace({ root: tree.root, file: 'small.yaml' }),
    );
    expect(
      Either.map(
        inspect(withDefault, {}),
        (inspection) => inspection.result.kind,
      ),
    ).toEqual(Either.right('inspected'));
  });
});
