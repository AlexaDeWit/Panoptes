import { Either } from 'effect';
import { realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { namedPipeIn, workspaceTree } from './workspace.fixtures.js';
import {
  WorkspaceFailure,
  candidateFiles,
  openWorkspace,
  readModelFile,
  renderWorkspaceFailure,
  type ModelWorkspace,
} from './workspace.js';

const tree = workspaceTree();

const opened = (file?: string): ModelWorkspace => {
  const workspace = openWorkspace({ root: tree.root, file });
  if (Either.isLeft(workspace)) {
    throw new Error(renderWorkspaceFailure(workspace.left).join('\n'));
  }
  return workspace.right;
};

const workspace = opened();

const failureOf = (requested: string): WorkspaceFailure => {
  const read = readModelFile(workspace, requested);
  if (Either.isRight(read)) {
    throw new Error(`${requested} was read, and this expects a refusal`);
  }
  return read.left;
};

describe('the root a server is confined to', () => {
  it('resolves the root through its own symbolic links', () => {
    expect(workspace.root).toEqual(realpathSync(tree.root));
  });

  it('refuses a root that is not there, naming it', () => {
    const missing = join(tree.root, 'nowhere');
    const refused = openWorkspace({ root: missing });
    expect(
      Either.isLeft(refused)
        ? renderWorkspaceFailure(refused.left).join('\n')
        : 'the root was accepted',
    ).toContain(`The root "${missing}" cannot be used: ENOENT`);
  });

  it('takes a default file inside the root and resolves it', () => {
    expect(opened('small.yaml').defaultFile).toEqual(
      join(workspace.root, 'small.yaml'),
    );
  });

  it('refuses a default file outside the root', () => {
    expect(
      Either.isLeft(
        openWorkspace({ root: tree.root, file: '../outside.yaml' }),
      ),
    ).toBe(true);
  });
});

describe('a path a tool call names', () => {
  it('reads a file under the root', () => {
    const read = readModelFile(workspace, 'small.yaml');
    expect(Either.isRight(read)).toBe(true);
  });

  it('refuses a path that climbs out of the root, with where it resolved', () => {
    const failure = failureOf('../outside.yaml');
    expect(failure).toEqual(
      WorkspaceFailure.OutsideRoot({
        requested: '../outside.yaml',
        resolved: realpathSync(tree.outside),
        root: workspace.root,
      }),
    );
  });

  it('refuses a link inside the root that points outside it', () => {
    expect(renderWorkspaceFailure(failureOf('link.yaml'))).toEqual([
      'The file "link.yaml" is outside the root this server may read.',
      `It resolves to "${realpathSync(tree.outside)}", and the root is "${workspace.root}".`,
    ]);
  });

  it('refuses an absolute path outside the root', () => {
    expect(WorkspaceFailure.$is('OutsideRoot')(failureOf(tree.outside))).toBe(
      true,
    );
  });

  it('refuses a sibling directory whose name starts with the root', () => {
    expect(
      renderWorkspaceFailure(failureOf('../root-evil/secret.yaml')),
    ).toEqual([
      'The file "../root-evil/secret.yaml" is outside the root this server may read.',
      `It resolves to "${realpathSync(tree.sibling)}", and the root is "${workspace.root}".`,
    ]);
  });

  it('reports a file that is not there as unreadable', () => {
    expect(WorkspaceFailure.$is('Unreadable')(failureOf('absent.yaml'))).toBe(
      true,
    );
  });

  it('refuses a named pipe rather than blocking on the read', () => {
    const pipe = namedPipeIn(workspace.root, 'wedge.yaml');
    try {
      expect(renderWorkspaceFailure(failureOf('wedge.yaml'))).toEqual([
        'The file "wedge.yaml" cannot be read: it is not a regular file.',
      ]);
    } finally {
      rmSync(pipe);
    }
  });

  it('refuses a directory the same way', () => {
    expect(renderWorkspaceFailure(failureOf('nested'))).toEqual([
      'The file "nested" cannot be read: it is not a regular file.',
    ]);
  });

  it('carries the codec wording for a text no format claimed', () => {
    expect(renderWorkspaceFailure(failureOf('unclaimed.yaml'))).toEqual([
      'The file "unclaimed.yaml" was not read.',
      'No format claimed the file. Saerskriven tried threat-dragon, saerskriven-yaml.',
    ]);
  });
});

describe('the candidate files under a root', () => {
  it('lists model extensions from the root and below, and no link', () => {
    expect(candidateFiles(workspace)).toEqual({
      files: [join('nested', 'deeper.yaml'), 'small.yaml', 'unclaimed.yaml'],
      truncated: false,
    });
  });
});
