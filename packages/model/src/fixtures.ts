import { Either } from 'effect';
import {
  diagramIdSchema,
  elementIdSchema,
  threatIdSchema,
  type DiagramId,
  type ElementId,
  type ThreatId,
} from './lib/ids.js';
import { parseModel, type Model } from './lib/parse.js';

/** Parses a spec's literal string into a branded element id. */
export const elementId = (value: string): ElementId =>
  elementIdSchema.parse(value);

/** Parses a spec's literal string into a branded diagram id. */
export const diagramId = (value: string): DiagramId =>
  diagramIdSchema.parse(value);

/** Parses a spec's literal string into a branded threat id. */
export const threatId = (value: string): ThreatId =>
  threatIdSchema.parse(value);

/**
 * The parsed form of a fixture, for a spec that needs a Model. The input is
 * unknown because a fixture is as often a file read off disk as a literal
 * written in the spec. Throws where the fixture stops parsing: a fixture
 * that no longer parses is a broken suite, not a case under test. The
 * message carries parseModel's issues, so the failure names the construct
 * the fixture lost.
 */
export function parsedFixture(input: unknown): Model {
  return Either.getOrThrowWith(
    parseModel(input),
    (failure) =>
      new Error(
        `Fixture does not parse: ${failure.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ')}`,
      ),
  );
}
