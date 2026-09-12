import {
  answerOf,
  ecluseFile,
  ecluseWorkspace,
  invalidFile,
  refusalOf,
  rootWorkspace,
  unclaimedFile,
  unreadableTree,
} from './read-tools.fixtures.js';
import { validate } from './validate.js';

const ecluse = ecluseWorkspace();

const unreadable = unreadableTree();

describe('what saer_validate reports', () => {
  it('reads the Ecluse fixture as the format its content names', () => {
    const checked = answerOf(validate(ecluse, {}));
    expect({
      file: checked.file,
      format: checked.format,
      diverged: checked.diverged,
    }).toEqual({
      file: ecluseFile,
      format: 'threat-dragon',
      diverged: false,
    });
  });

  it('carries the revision handle a write has to quote back', () => {
    expect(answerOf(validate(ecluse, {})).revision).toMatch(
      /^sha256:[0-9a-f]{64}$/u,
    );
  });

  it('names every format tried where no codec claims the file', () => {
    expect(refusalOf(validate(unreadable, { file: unclaimedFile }))).toContain(
      'No format claimed the file. Saerskriven tried threat-dragon, saerskriven-yaml.',
    );
  });

  it('refuses a claimed file with the path of the issue inside it', () => {
    const refused = refusalOf(validate(unreadable, { file: invalidFile }));
    expect(refused.join('\n')).toContain('threats.0.severity');
  });

  it('refuses a call naming no file where the server carries no default', () => {
    expect(refusalOf(validate(rootWorkspace(), {}))[0]).toContain(
      'No file was named and this server carries no default',
    );
  });
});
