import { Either } from 'effect';
import { readFailureIssues } from './codec.js';
import { readPanoptesYaml } from './panoptes-yaml-read.js';

const minimalDocument = [
  'formatVersion: 1',
  'metadata:',
  '  title: Minimal',
  '  owner: ""',
  '  description: ""',
  '  contributors: []',
  'diagrams: []',
  'threats: []',
  'lastIssuedThreatNumber: 0',
  'mitigations: []',
  'assumptions: []',
  '',
].join('\n');

const oneThreatDocument = [
  'formatVersion: 1',
  'metadata:',
  '  title: One threat',
  '  owner: ""',
  '  description: ""',
  '  contributors: []',
  'diagrams:',
  '  - id: diagram-1',
  '    title: Only',
  '    elements:',
  '      - kind: process',
  '        id: element-1',
  '        name: Gateway',
  '        description: ""',
  '        outOfScope: false',
  '        reasonOutOfScope: ""',
  '        position:',
  '          x: 0',
  '          y: 0',
  '        size:',
  '          width: 10',
  '          height: 10',
  'threats:',
  '  - id: threat-1',
  '    number: 1',
  '    title: Spoofed caller',
  '    category:',
  '      methodology: STRIDE',
  '      category: spoofing',
  '    severity: high',
  '    status: open',
  '    description: ""',
  '    mitigation: ""',
  '    elements:',
  '      - element-1',
  'lastIssuedThreatNumber: 1',
  'mitigations: []',
  'assumptions: []',
  '',
].join('\n');

const withExtras = `${oneThreatDocument.replace(
  '    number: 1',
  '    number: 1\n    likelihood: high',
)}notes: kept nowhere\n`;

function readingOf(text: string) {
  const result = readPanoptesYaml(text);
  return Either.isRight(result) ? result.right : undefined;
}

function failureOf(text: string) {
  const result = readPanoptesYaml(text);
  return Either.isLeft(result) ? result.left : undefined;
}

function issuePathsOf(text: string) {
  const failure = failureOf(text);
  return failure === undefined
    ? []
    : readFailureIssues(failure).map((issue) => issue.path);
}

describe('a Panoptes YAML read', () => {
  it('refuses a file with no formatVersion at that path', () => {
    const without = minimalDocument.replace('formatVersion: 1\n', '');
    expect(failureOf(without)?._tag).toBe('InvalidWireDocument');
    expect(issuePathsOf(without)).toEqual([['formatVersion']]);
  });

  it('refuses a file stamped with another release at that path', () => {
    const later = minimalDocument.replace(
      'formatVersion: 1',
      'formatVersion: 2',
    );
    expect(failureOf(later)?._tag).toBe('InvalidWireDocument');
    expect(issuePathsOf(later)).toEqual([['formatVersion']]);
  });

  it('refuses text that is not YAML without throwing out of the read', () => {
    expect(failureOf('formatVersion: [1')?._tag).toBe('MalformedText');
  });

  it('refuses a document that is not a mapping', () => {
    expect(failureOf('a plain scalar')?._tag).toBe('InvalidWireDocument');
  });

  it('refuses an alias that closes a cycle rather than following it', () => {
    expect(
      failureOf(
        ['formatVersion: 1', 'metadata: &loop', '  title: *loop', ''].join(
          '\n',
        ),
      )?._tag,
    ).toBe('ExceededReadLimit');
  });

  it('refuses a document the model refuses, with a path into the model', () => {
    const dangling = oneThreatDocument.replace(
      '      - element-1',
      '      - element-9',
    );
    expect(failureOf(dangling)?._tag).toBe('InvalidModel');
    expect(issuePathsOf(dangling)).toEqual([['threats', 0, 'elements', 0]]);
  });

  it('refuses a title carrying a character the model refuses, pathed into the model', () => {
    const overridden = minimalDocument.replace(
      '  title: Minimal',
      '  title: "Minimal\u202E"',
    );
    expect(failureOf(overridden)?._tag).toBe('InvalidModel');
    expect(issuePathsOf(overridden)).toEqual([['metadata', 'title']]);
  });

  it('reads a valid file with nothing to report', () => {
    expect(readingOf(minimalDocument)?.divergences).toEqual([]);
  });
});

describe('a key the wire schema does not declare', () => {
  it('is dropped from the model rather than refusing the file', () => {
    expect(readingOf(withExtras)?.model).toEqual(
      readingOf(oneThreatDocument)?.model,
    );
  });

  it('is reported as undeclared, naming its path in the file', () => {
    expect(readingOf(withExtras)?.divergences).toEqual([
      {
        subject: { kind: 'model' },
        detail: 'the key threats.0.likelihood',
        reason: 'undeclared',
      },
      {
        subject: { kind: 'model' },
        detail: 'the key notes',
        reason: 'undeclared',
      },
    ]);
  });
});
