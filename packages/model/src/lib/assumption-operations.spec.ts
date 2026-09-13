import { Either } from 'effect';
import {
  assumptionId,
  elementId,
  parsedFixture,
  threatId,
} from '../fixtures.js';
import {
  addAssumption,
  linkAssumption,
  removeAssumption,
  replaceAssumption,
  setAssumptionStatus,
  unlinkAssumption,
} from './assumption-operations.js';
import { assumptionSchema, type Assumption } from './assumptions.js';
import { threatRegisterFixture } from './fixtures.js';
import { OperationFailure } from './operation-failures.js';
import { parseModel, type Model } from './parse.js';

const base = parsedFixture(threatRegisterFixture);

const pciScope = assumptionId('assumption-pci-scope');
const spoofShopper = threatId('threat-spoof-shopper');
const tamperPayment = threatId('threat-tamper-payment');
const ghostThreat = threatId('threat-ghost');
const ghostAssumption = assumptionId('assumption-ghost');

const unlinkedFromFile = parsedFixture({
  ...threatRegisterFixture,
  assumptions: [
    {
      id: 'assumption-pci-scope',
      prose: 'The card vault is audited under PCI DSS every year.',
      status: 'valid',
      elements: ['element-vault'],
      threats: [],
    },
  ],
});

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
  threats: ['threat-spoof-shopper'],
});

describe('addAssumption', () => {
  it('appends the assumption to the register', () => {
    const next = modelOf(addAssumption(base, tlsEverywhere));
    expect(assumptionIds(next)).toEqual([
      ...assumptionIds(base),
      tlsEverywhere.id,
    ]);
  });

  it('refuses an assumption linked to no threat, whatever elements it links', () => {
    const unlinked = assumptionSchema.parse({ ...tlsInput, threats: [] });
    expect(errorOf(addAssumption(base, unlinked))).toEqual(
      OperationFailure.RecordWithoutThreat({
        record: { kind: 'assumption', id: unlinked.id },
      }),
    );
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

describe('replaceAssumption and the last threat link', () => {
  it('culls an assumption the replacement takes to no threat link, element links or not', () => {
    const unlinked = assumptionSchema.parse({
      ...invalidatedScope,
      threats: [],
    });
    expect(assumptionIds(modelOf(replaceAssumption(base, unlinked)))).toEqual(
      [],
    );
  });

  it('keeps an assumption that had no threat link before the replacement', () => {
    const reworded = assumptionSchema.parse({
      ...unlinkedFromFile.assumptions[0],
      prose: 'Reworded.',
    });
    expect(
      modelOf(replaceAssumption(unlinkedFromFile, reworded)).assumptions,
    ).toEqual([reworded]);
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

describe('linkAssumption', () => {
  it('adds the threat to the assumption links', () => {
    const next = modelOf(linkAssumption(base, pciScope, tamperPayment));
    expect(next.assumptions[0].threats).toEqual([spoofShopper, tamperPayment]);
  });

  it('returns the model it was given for a threat already linked', () => {
    expect(modelOf(linkAssumption(base, pciScope, spoofShopper))).toBe(base);
  });

  it('refuses an unknown threat or an unknown assumption', () => {
    expect(errorOf(linkAssumption(base, pciScope, ghostThreat))).toEqual(
      OperationFailure.UnknownThreat({ threatId: ghostThreat }),
    );
    expect(
      errorOf(linkAssumption(base, ghostAssumption, spoofShopper)),
    ).toEqual(
      OperationFailure.UnknownAssumption({ assumptionId: ghostAssumption }),
    );
  });
});

describe('unlinkAssumption', () => {
  it('keeps an assumption that still links another threat', () => {
    const linked = modelOf(linkAssumption(base, pciScope, tamperPayment));
    const next = modelOf(unlinkAssumption(linked, pciScope, spoofShopper));
    expect(next.assumptions[0].threats).toEqual([tamperPayment]);
  });

  it('culls the assumption when the threat was its last link, element links or not', () => {
    expect(
      assumptionIds(modelOf(unlinkAssumption(base, pciScope, spoofShopper))),
    ).toEqual([]);
  });

  it('returns the model it was given for a threat not linked', () => {
    expect(modelOf(unlinkAssumption(base, pciScope, tamperPayment))).toBe(base);
  });

  it('refuses an unknown threat or an unknown assumption', () => {
    expect(errorOf(unlinkAssumption(base, pciScope, ghostThreat))).toEqual(
      OperationFailure.UnknownThreat({ threatId: ghostThreat }),
    );
    expect(
      errorOf(unlinkAssumption(base, ghostAssumption, spoofShopper)),
    ).toEqual(
      OperationFailure.UnknownAssumption({ assumptionId: ghostAssumption }),
    );
  });
});

describe('setAssumptionStatus', () => {
  it('changes only the status of that assumption', () => {
    const next = modelOf(setAssumptionStatus(base, pciScope, 'invalidated'));
    expect(next).toEqual({
      ...base,
      assumptions: [{ ...base.assumptions[0], status: 'invalidated' }],
    });
  });

  it('keeps an assumption that has no threat link', () => {
    const next = modelOf(
      setAssumptionStatus(unlinkedFromFile, pciScope, 'invalidated'),
    );
    expect(next.assumptions).toEqual([
      { ...unlinkedFromFile.assumptions[0], status: 'invalidated' },
    ]);
  });

  it('refuses an unknown assumption', () => {
    expect(
      errorOf(setAssumptionStatus(base, ghostAssumption, 'invalidated')),
    ).toEqual(
      OperationFailure.UnknownAssumption({ assumptionId: ghostAssumption }),
    );
  });
});

describe('assumption operation purity', () => {
  it('leaves the input model untouched', () => {
    const pristine = structuredClone(base);
    addAssumption(base, tlsEverywhere);
    replaceAssumption(base, invalidatedScope);
    removeAssumption(base, pciScope);
    linkAssumption(base, pciScope, tamperPayment);
    unlinkAssumption(base, pciScope, spoofShopper);
    setAssumptionStatus(base, pciScope, 'invalidated');
    expect(base).toEqual(pristine);
  });
});

describe('assumption operation outputs re-parse through parseModel', () => {
  const outputs: [string, Model][] = [
    ['addAssumption', modelOf(addAssumption(base, tlsEverywhere))],
    ['replaceAssumption', modelOf(replaceAssumption(base, invalidatedScope))],
    ['removeAssumption', modelOf(removeAssumption(base, pciScope))],
    ['linkAssumption', modelOf(linkAssumption(base, pciScope, tamperPayment))],
    [
      'unlinkAssumption',
      modelOf(unlinkAssumption(base, pciScope, spoofShopper)),
    ],
    [
      'setAssumptionStatus',
      modelOf(setAssumptionStatus(base, pciScope, 'invalidated')),
    ],
  ];

  for (const [operation, model] of outputs) {
    it(`${operation} returns a model parseModel accepts`, () => {
      expect(Either.isRight(parseModel(model))).toBe(true);
    });
  }
});
