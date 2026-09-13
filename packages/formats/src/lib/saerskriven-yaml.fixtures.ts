import type { Model } from '@saerskriven/model';
import { Either } from 'effect';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readThreatDragon } from './threat-dragon-read.js';
import { ecluseText } from './threat-dragon.fixtures.js';

const repositoryRoot = join(import.meta.dirname, '../../../..');

/**
 * The Écluse model, read from the Threat Dragon file the repository
 * vendors, which is the only production-scale model the project has. The
 * Threat Dragon corpus spec is what gates that the file reads at all, so a
 * failure here needs no message of its own.
 */
export const ecluseModel: Model = Either.getOrThrow(
  readThreatDragon(ecluseText),
).model;

/**
 * The Écluse model as this format writes it, committed so a change to what
 * the format writes arrives as a diff on a file rather than as a test that
 * still passes.
 */
export const goldenPath: string = join(
  repositoryRoot,
  'test-data/saerskriven/ecluse.yaml',
);

/**
 * The Écluse model in the document shape v0.2.1 wrote, committed as data and
 * never regenerated, so a file from before a flow's `bidirectional` and an
 * attached endpoint's `side` still has a reader to answer to.
 */
export const frozenV021Path: string = join(
  repositoryRoot,
  'test-data/saerskriven/ecluse-v0.2.1.yaml',
);

const saerskrivenModelPath = join(
  repositoryRoot,
  'threat-modelling/saerskriven.yaml',
);

const saerskrivenModelJsonPath = join(
  repositoryRoot,
  'test-data/saerskriven.model.json',
);

/**
 * A Saerskriven YAML file this repository commits, with its committed bytes and,
 * where this suite is the producer of one, the path it writes the file's
 * internal model out to.
 */
export type NativeFixture = {
  readonly name: string;
  readonly path: string;
  readonly text: string;
  readonly modelJsonPath: string | undefined;
};

/** A {@link NativeFixture} whose internal model this suite writes out. */
export type EmittedModel = {
  readonly name: string;
  readonly text: string;
  readonly modelJsonPath: string;
};

/**
 * Every Saerskriven YAML file this repository commits as a fixed point of the
 * codec: what a read of the committed bytes writes back is those bytes
 * again. The suites that gate a native file read this list rather than a
 * path, so a third file joins all of them by being added here. The frozen
 * fixture at {@link frozenV021Path} is not one of them, because a write of
 * its model states the keys its shape predates.
 *
 * `modelJsonPath` is where a file's internal model is written out for
 * `packages/render` and `packages/canvas`, which gate on a model and cannot
 * import a codec. Écluse names none, because `packages/model` writes that
 * one from its own transcription of the Threat Dragon file and this suite
 * compares against it rather than producing it. A file this suite is the
 * only reader of names its own.
 */
export const nativeFixtures: readonly NativeFixture[] = [
  {
    name: 'Écluse model',
    path: goldenPath,
    text: readFileSync(goldenPath, 'utf8'),
    modelJsonPath: undefined,
  },
  {
    name: 'Saerskriven model',
    path: saerskrivenModelPath,
    text: readFileSync(saerskrivenModelPath, 'utf8'),
    modelJsonPath: saerskrivenModelJsonPath,
  },
];

/** The fixtures of {@link nativeFixtures} this suite writes a model out for. */
export const emittedModels: readonly EmittedModel[] = nativeFixtures.flatMap(
  (fixture) =>
    fixture.modelJsonPath === undefined
      ? []
      : [
          {
            name: fixture.name,
            text: fixture.text,
            modelJsonPath: fixture.modelJsonPath,
          },
        ],
);

/**
 * How long a property over `modelInputArbitrary` is given, past the root
 * `vitest.shared.mts` sets. fast-check runs a property a hundred times by
 * default, and each run parses a model, writes it and reads it back, which
 * ten runs of the whole workspace's suites on a contended host measured at
 * 9.5 seconds.
 */
export const propertyTimeout = 30_000;
