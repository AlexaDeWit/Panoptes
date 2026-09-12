import { Either } from 'effect';
import {
  assumptionIdSchema,
  diagramIdSchema,
  elementIdSchema,
  mitigationIdSchema,
  threatIdSchema,
  type AssumptionId,
  type DiagramId,
  type ElementId,
  type MitigationId,
  type ThreatId,
} from './lib/ids.js';
import { parseModel, type Model } from './lib/parse.js';

export { validModelFixture } from './lib/fixtures.js';
export {
  securityModelFixture,
  securityPropertyFixtures,
} from './lib/security.fixtures.js';

/** Parses a spec's literal string into a branded element id. */
export const elementId = (value: string): ElementId =>
  elementIdSchema.parse(value);

/** Parses a spec's literal string into a branded diagram id. */
export const diagramId = (value: string): DiagramId =>
  diagramIdSchema.parse(value);

/** Parses a spec's literal string into a branded threat id. */
export const threatId = (value: string): ThreatId =>
  threatIdSchema.parse(value);

/** Parses a spec's literal string into a branded mitigation id. */
export const mitigationId = (value: string): MitigationId =>
  mitigationIdSchema.parse(value);

/** Parses a spec's literal string into a branded assumption id. */
export const assumptionId = (value: string): AssumptionId =>
  assumptionIdSchema.parse(value);

/** A broken fixture throws with the model's path-bearing issues. */
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
