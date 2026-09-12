import { Either } from 'effect';
import * as fc from 'fast-check';
import { modelInputArbitrary } from '../fixtures.js';
import { parseModel, type Model } from './parse.js';
import { threatFlags } from './threat-flags.js';

const generatedModel = modelInputArbitrary.map((input) =>
  Either.getOrThrow(parseModel(input)),
);

const threatsLinkedBy = (
  records: readonly { readonly threats: readonly string[] }[],
): ReadonlySet<string> => new Set(records.flatMap(({ threats }) => threats));

describe('threatFlags over generated models', () => {
  it('flags a mitigated threat exactly when no linked mitigation is implemented or verified', () => {
    fc.assert(
      fc.property(generatedModel, (model) => {
        const backed = threatsLinkedBy(
          model.mitigations.filter(
            ({ status }) => status === 'implemented' || status === 'verified',
          ),
        );
        for (const threat of model.threats) {
          expect(
            threatFlags(model, threat).includes(
              'mitigated-without-implemented-work',
            ),
          ).toBe(threat.status === 'mitigated' && !backed.has(threat.id));
        }
      }),
    );
  });

  it('flags a threat exactly when a linked assumption is invalidated', () => {
    fc.assert(
      fc.property(generatedModel, (model) => {
        const invalidated = threatsLinkedBy(
          model.assumptions.filter(({ status }) => status === 'invalidated'),
        );
        for (const threat of model.threats) {
          expect(
            threatFlags(model, threat).includes(
              'rests-on-invalidated-assumption',
            ),
          ).toBe(invalidated.has(threat.id));
        }
      }),
    );
  });

  it('changes no threat status, nor anything else of the model', () => {
    fc.assert(
      fc.property(generatedModel, (model: Model) => {
        const before = structuredClone(model);
        for (const threat of model.threats) {
          threatFlags(model, threat);
        }
        expect(model).toEqual(before);
      }),
    );
  });
});
