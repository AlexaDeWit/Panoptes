import { Either } from 'effect';
import {
  assumptionId,
  elementId,
  parsedFixture,
  threatId,
} from '../fixtures.js';
import {
  addAssumption,
  removeAssumption,
  replaceAssumption,
} from './assumption-operations.js';
import { assumptionSchema, type Assumption } from './assumptions.js';
import { threatRegisterFixture } from './fixtures.js';
import { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';

const base = parsedFixture(threatRegisterFixture);

const pciScope = assumptionId('assumption-pci-scope');

type Outcome = Either.Either<Model, OperationFailure>;

const modelOf = (result: Outcome): Model => {
  if (Either.isLeft(result)) {
    throw new Error(`Expected the operation to succeed: ${result.left._tag}`);
  }
  return result.right;
};

const errorOf = (result: Outcome): OperationFailure | undefined =>
  Either.isLeft(result) ? result.left : undefined;

const assumptionIds = (model: Model): string[] =>
  model.assumptions.map((assumption) => assumption.id);

const tlsInput = {
  id: 'assumption-tls-everywhere',
  prose: 'Every hop between the shopper and checkout runs over TLS.',
  status: 'valid',
  elements: ['element-pay-flow'],
  threats: ['threat-tamper-payment'],
};

const tlsEverywhere = assumptionSchema.parse(tlsInput);

const invalidatedScope: Assumption = assumptionSchema.parse({
  id: 'assumption-pci-scope',
  prose: 'The card vault is audited under PCI DSS every year.',
  status: 'invalidated',
  elements: ['element-vault', 'element-ledger'],
  threats: [],
});

describe('addAssumption', () => {
  it('appends the assumption to the register', () => {
    const next = modelOf(addAssumption(base, tlsEverywhere));
    expect(assumptionIds(next)).toEqual([
      ...assumptionIds(base),
      tlsEverywhere.id,
    ]);
  });

  it('accepts an assumption linked to nothing', () => {
    const unlinked = assumptionSchema.parse({
      ...tlsInput,
      elements: [],
      threats: [],
    });
    expect(modelOf(addAssumption(base, unlinked)).assumptions.at(-1)).toEqual(
      unlinked,
    );
  });

  it('leaves the input model alone', () => {
    const before = assumptionIds(base);
    modelOf(addAssumption(base, tlsEverywhere));
    expect(assumptionIds(base)).toEqual(before);
  });

  it('fails on an id the register already holds', () => {
    const clash = assumptionSchema.parse({
      ...tlsInput,
      id: 'assumption-pci-scope',
    });
    expect(errorOf(addAssumption(base, clash))).toEqual(
      OperationFailure.DuplicateAssumptionId({ assumptionId: pciScope }),
    );
  });

  it('fails on a link to an unknown element', () => {
    const dangling = assumptionSchema.parse({
      ...tlsInput,
      elements: ['element-ghost'],
    });
    expect(errorOf(addAssumption(base, dangling))).toEqual(
      OperationFailure.UnknownElement({
        elementId: elementId('element-ghost'),
      }),
    );
  });

  it('fails on a link to an unknown threat', () => {
    const dangling = assumptionSchema.parse({
      ...tlsInput,
      threats: ['threat-ghost'],
    });
    expect(errorOf(addAssumption(base, dangling))).toEqual(
      OperationFailure.UnknownThreat({ threatId: threatId('threat-ghost') }),
    );
  });
});

describe('replaceAssumption', () => {
  it('swaps the whole record in, keeping its place in the register', () => {
    const next = modelOf(replaceAssumption(base, invalidatedScope));
    expect(next.assumptions[0]).toEqual(invalidatedScope);
    expect(assumptionIds(next)).toEqual(assumptionIds(base));
  });

  it('fails on an id the register does not hold', () => {
    expect(errorOf(replaceAssumption(base, tlsEverywhere))).toEqual(
      OperationFailure.UnknownAssumption({
        assumptionId: assumptionId('assumption-tls-everywhere'),
      }),
    );
  });

  it('fails on a link to an unknown element', () => {
    const dangling = assumptionSchema.parse({
      ...invalidatedScope,
      elements: ['element-ghost'],
    });
    expect(errorOf(replaceAssumption(base, dangling))).toEqual(
      OperationFailure.UnknownElement({
        elementId: elementId('element-ghost'),
      }),
    );
  });

  it('fails on a link to an unknown threat', () => {
    const dangling = assumptionSchema.parse({
      ...invalidatedScope,
      threats: ['threat-ghost'],
    });
    expect(errorOf(replaceAssumption(base, dangling))).toEqual(
      OperationFailure.UnknownThreat({ threatId: threatId('threat-ghost') }),
    );
  });
});

describe('removeAssumption', () => {
  it('drops the assumption from the register', () => {
    expect(assumptionIds(modelOf(removeAssumption(base, pciScope)))).toEqual(
      [],
    );
  });

  it('leaves the elements and threats it rested on untouched', () => {
    const next = modelOf(removeAssumption(base, pciScope));
    expect(next.diagrams).toEqual(base.diagrams);
    expect(next.threats).toEqual(base.threats);
  });

  it('fails on an assumption the register does not hold', () => {
    const ghost = assumptionId('assumption-ghost');
    expect(errorOf(removeAssumption(base, ghost))).toEqual(
      OperationFailure.UnknownAssumption({ assumptionId: ghost }),
    );
  });
});
