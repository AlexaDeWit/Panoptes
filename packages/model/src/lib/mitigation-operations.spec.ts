import { Either } from 'effect';
import { mitigationId, parsedFixture, threatId } from '../fixtures.js';
import { threatRegisterFixture } from './fixtures.js';
import {
  addMitigation,
  removeMitigation,
  replaceMitigation,
} from './mitigation-operations.js';
import { mitigationSchema, type Mitigation } from './mitigations.js';
import { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';

const base = parsedFixture(threatRegisterFixture);

const bindSession = mitigationId('mitigation-bind-session');

type Outcome = Either.Either<Model, OperationFailure>;

const modelOf = (result: Outcome): Model => {
  if (Either.isLeft(result)) {
    throw new Error(`Expected the operation to succeed: ${result.left._tag}`);
  }
  return result.right;
};

const errorOf = (result: Outcome): OperationFailure | undefined =>
  Either.isLeft(result) ? result.left : undefined;

const mitigationIds = (model: Model): string[] =>
  model.mitigations.map((mitigation) => mitigation.id);

const rateLimitInput = {
  id: 'mitigation-rate-limit',
  title: 'Rate limit the checkout',
  prose: 'Throttle basket submissions per session.',
  status: 'proposed',
  threats: ['threat-flood-checkout'],
};

const rateLimit = mitigationSchema.parse(rateLimitInput);

const editedBinding: Mitigation = mitigationSchema.parse({
  id: 'mitigation-bind-session',
  title: 'Bind sessions to a device fingerprint',
  prose: 'Reject a session cookie replayed from another device.',
  status: 'implemented',
  threats: ['threat-spoof-shopper'],
});

describe('addMitigation', () => {
  it('appends the mitigation to the register', () => {
    const next = modelOf(addMitigation(base, rateLimit));
    expect(mitigationIds(next)).toEqual([...mitigationIds(base), rateLimit.id]);
  });

  it('accepts a mitigation linked to no threat', () => {
    const unlinked = mitigationSchema.parse({ ...rateLimitInput, threats: [] });
    expect(modelOf(addMitigation(base, unlinked)).mitigations.at(-1)).toEqual(
      unlinked,
    );
  });

  it('leaves the input model alone', () => {
    const before = mitigationIds(base);
    modelOf(addMitigation(base, rateLimit));
    expect(mitigationIds(base)).toEqual(before);
  });

  it('fails on an id the register already holds', () => {
    const clash = mitigationSchema.parse({
      ...rateLimitInput,
      id: 'mitigation-bind-session',
    });
    expect(errorOf(addMitigation(base, clash))).toEqual(
      OperationFailure.DuplicateMitigationId({ mitigationId: bindSession }),
    );
  });

  it('fails on a link to an unknown threat', () => {
    const dangling = mitigationSchema.parse({
      ...rateLimitInput,
      threats: ['threat-ghost'],
    });
    expect(errorOf(addMitigation(base, dangling))).toEqual(
      OperationFailure.UnknownThreat({ threatId: threatId('threat-ghost') }),
    );
  });
});

describe('replaceMitigation', () => {
  it('swaps the whole record in, keeping its place in the register', () => {
    const next = modelOf(replaceMitigation(base, editedBinding));
    expect(next.mitigations[0]).toEqual(editedBinding);
    expect(mitigationIds(next)).toEqual(mitigationIds(base));
  });

  it('fails on an id the register does not hold', () => {
    expect(errorOf(replaceMitigation(base, rateLimit))).toEqual(
      OperationFailure.UnknownMitigation({
        mitigationId: mitigationId('mitigation-rate-limit'),
      }),
    );
  });

  it('fails on a link to an unknown threat', () => {
    const dangling = mitigationSchema.parse({
      ...editedBinding,
      threats: ['threat-ghost'],
    });
    expect(errorOf(replaceMitigation(base, dangling))).toEqual(
      OperationFailure.UnknownThreat({ threatId: threatId('threat-ghost') }),
    );
  });
});

describe('removeMitigation', () => {
  it('drops the mitigation from the register', () => {
    expect(mitigationIds(modelOf(removeMitigation(base, bindSession)))).toEqual(
      [],
    );
  });

  it('leaves the threats it addressed untouched', () => {
    const next = modelOf(removeMitigation(base, bindSession));
    expect(next.threats).toEqual(base.threats);
    expect(next.lastIssuedThreatNumber).toBe(base.lastIssuedThreatNumber);
  });

  it('fails on a mitigation the register does not hold', () => {
    const ghost = mitigationId('mitigation-ghost');
    expect(errorOf(removeMitigation(base, ghost))).toEqual(
      OperationFailure.UnknownMitigation({ mitigationId: ghost }),
    );
  });
});
