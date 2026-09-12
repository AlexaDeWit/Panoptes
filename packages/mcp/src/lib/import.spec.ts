import { readAnyFormat } from '@saerskriven/formats';
import { Either } from 'effect';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  editableTree,
  modelFile,
  otmFile,
  tmbomFile,
} from './edit.fixtures.js';
import {
  importArgumentsSchema,
  importIntoModel,
  renderImport,
} from './import.js';
import { openWorkspace } from './workspace.js';

const converted = (root: string, file: string, target: string) =>
  importIntoModel(
    Either.getOrThrow(openWorkspace({ root })),
    importArgumentsSchema.parse({ file, target }),
  );

describe('converting a foreign model', () => {
  it('writes the native format and names the format it read', () => {
    const tree = editableTree();
    const answer = converted(tree.root, otmFile, 'converted.yaml');
    const written = readAnyFormat(
      readFileSync(join(tree.root, 'converted.yaml'), 'utf8'),
    );
    expect({
      file: Either.getOrUndefined(answer)?.file,
      format: Either.getOrUndefined(answer)?.format,
      source: Either.getOrUndefined(answer)?.source,
      written: Either.getOrUndefined(written)?.format,
    }).toEqual({
      file: 'converted.yaml',
      format: 'saerskriven-yaml',
      source: { file: otmFile, format: 'otm' },
      written: 'saerskriven-yaml',
    });
  });

  it('carries what the conversion could not take over', () => {
    const tree = editableTree();
    const answer = converted(tree.root, otmFile, 'converted.yaml');
    expect(Either.getOrUndefined(answer)?.divergences.length).toBeGreaterThan(
      0,
    );
  });

  it('reads TM-BOM as well, and says which it read', () => {
    const tree = editableTree();
    const answer = converted(tree.root, tmbomFile, 'converted.yaml');
    expect(Either.getOrUndefined(answer)?.source.format).toEqual('tmbom');
  });

  it('reads as the lines a text result carries', () => {
    const tree = editableTree();
    const answer = converted(tree.root, otmFile, 'converted.yaml');
    expect(
      Either.match(answer, {
        onLeft: (lines) => lines,
        onRight: renderImport,
      })[0],
    ).toEqual(`converted: ${otmFile} (otm)`);
  });

  it('refuses a target already holding a file, leaving its bytes alone', () => {
    const tree = editableTree();
    const before = readFileSync(join(tree.root, modelFile));
    const refused = converted(tree.root, otmFile, modelFile);
    expect(readFileSync(join(tree.root, modelFile))).toEqual(before);
    expect(
      Either.isLeft(refused) ? refused.left.join('\n') : 'the file was written',
    ).toContain('is already there');
  });

  it('refuses a file that is neither OTM nor TM-BOM, writing nothing', () => {
    const tree = editableTree();
    const refused = converted(tree.root, modelFile, 'converted.yaml');
    expect(
      Either.isLeft(refused) ? refused.left.join('\n') : 'the file was written',
    ).toContain('was not converted');
  });
});
