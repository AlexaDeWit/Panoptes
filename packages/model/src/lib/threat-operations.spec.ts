import { Either } from 'effect';
import { parsedFixture, threatRegisterFixture } from './fixtures.js';
import { elementIdSchema, threatIdSchema } from './ids.js';
import { OperationFailure } from './operation-failures.js';
import { parseModel, type Model } from './parse.js';
import {
  addThreat,
  attachThreat,
  detachThreat,
  nextThreatNumber,
  removeThreat,
  renumberThreats,
  replaceThreat,
} from './threat-operations.js';
import { threatSchema, type Threat } from './threats.js';

const base = parsedFixture(threatRegisterFixture);
const emptyRegister = parsedFixture({
  ...threatRegisterFixture,
  threats: [],
  mitigations: [],
  assumptions: [],
});

const elementId = (value: string) => elementIdSchema.parse(value);
const threatId = (value: string) => threatIdSchema.parse(value);
const shopper = elementId('element-shopper');
const ledger = elementId('element-ledger');
const spoofShopper = threatId('threat-spoof-shopper');
const floodCheckout = threatId('threat-flood-checkout');

type OperationOutcome = Either.Either<Model, OperationFailure>;

const modelOf = (result: OperationOutcome): Model => {
  if (Either.isLeft(result)) {
    throw new Error(`Expected the operation to succeed: ${result.left._tag}`);
  }
  return result.right;
};

const errorOf = (result: OperationOutcome): OperationFailure | undefined =>
  Either.isLeft(result) ? result.left : undefined;

const threatIn = (model: Model, id: string): Threat => {
  const threat = model.threats.find((candidate) => candidate.id === id);
  if (!threat) {
    throw new Error(`Threat ${id} is missing from the model.`);
  }
  return threat;
};

const threatIds = (model: Model): string[] =>
  model.threats.map((threat) => threat.id);

const threatNumbers = (model: Model): number[] =>
  model.threats.map((threat) => threat.number);

const replayInput = {
  id: 'threat-replay-payment',
  number: 10,
  title: 'Payment replay',
  category: { methodology: 'STRIDE', category: 'repudiation' },
  severity: 'medium',
  status: 'open',
  description: 'A captured payment request is submitted a second time.',
  mitigation: '',
  elements: ['element-pay-flow'],
};

const replay = threatSchema.parse(replayInput);

const editedFlood = threatSchema.parse({
  ...threatIn(base, 'threat-flood-checkout'),
  title: 'Checkout flooding from a botnet',
  severity: 'high',
  status: 'mitigated',
  elements: ['element-checkout', 'element-ledger'],
});

describe('addThreat', () => {
  it('appends the threat to the register', () => {
    const next = modelOf(addThreat(base, replay));
    expect(threatIds(next)).toEqual([...threatIds(base), replay.id]);
  });

  it('accepts a threat linked to no element', () => {
    const unlinked = threatSchema.parse({ ...replayInput, elements: [] });
    expect(
      threatIn(modelOf(addThreat(base, unlinked)), replay.id).elements,
    ).toEqual([]);
  });

  it('fails on an id the register already holds', () => {
    const clash = threatSchema.parse({
      ...replayInput,
      id: 'threat-spoof-shopper',
    });
    expect(errorOf(addThreat(base, clash))).toEqual(
      OperationFailure.DuplicateThreatId({ threatId: spoofShopper }),
    );
  });

  it('fails on a number the register already holds', () => {
    const clash = threatSchema.parse({ ...replayInput, number: 5 });
    expect(errorOf(addThreat(base, clash))).toEqual(
      OperationFailure.DuplicateThreatNumber({ number: 5 }),
    );
  });

  it('fails on a link to an unknown element', () => {
    const dangling = threatSchema.parse({
      ...replayInput,
      elements: ['element-ghost'],
    });
    expect(errorOf(addThreat(base, dangling))).toEqual(
      OperationFailure.UnknownElement({
        elementId: elementId('element-ghost'),
      }),
    );
  });
});

describe('removeThreat', () => {
  it('removes the threat from the register', () => {
    const next = modelOf(removeThreat(base, spoofShopper));
    expect(threatIds(next)).not.toContain('threat-spoof-shopper');
  });

  it('unlinks the removed threat from mitigations and assumptions', () => {
    const next = modelOf(removeThreat(base, spoofShopper));
    expect(next.mitigations[0]).toMatchObject({
      id: 'mitigation-bind-session',
      threats: ['threat-tamper-payment'],
    });
    expect(next.assumptions[0]).toMatchObject({
      id: 'assumption-pci-scope',
      threats: [],
      elements: ['element-vault'],
    });
  });

  it('leaves the surviving numbers as they were', () => {
    expect(threatNumbers(modelOf(removeThreat(base, spoofShopper)))).toEqual([
      5, 9, 4, 7,
    ]);
  });

  it('fails on a threat the register does not hold', () => {
    expect(errorOf(removeThreat(base, threatId('threat-ghost')))).toEqual(
      OperationFailure.UnknownThreat({ threatId: threatId('threat-ghost') }),
    );
  });
});

describe('replaceThreat', () => {
  it('swaps the whole record in, keeping its place in the register', () => {
    const next = modelOf(replaceThreat(base, editedFlood));
    expect(next.threats[3]).toEqual(editedFlood);
    expect(threatIds(next)).toEqual(threatIds(base));
  });

  it('accepts the number the replaced threat already holds', () => {
    const renamed = threatSchema.parse({
      ...threatIn(base, 'threat-flood-checkout'),
      title: 'Checkout flooding, restated',
    });
    expect(
      threatIn(modelOf(replaceThreat(base, renamed)), renamed.id).title,
    ).toBe('Checkout flooding, restated');
  });

  it('fails on an id the register does not hold', () => {
    expect(errorOf(replaceThreat(base, replay))).toEqual(
      OperationFailure.UnknownThreat({ threatId: replay.id }),
    );
  });

  it('fails on a number another threat holds', () => {
    const clash = threatSchema.parse({ ...editedFlood, number: 5 });
    expect(errorOf(replaceThreat(base, clash))).toEqual(
      OperationFailure.DuplicateThreatNumber({ number: 5 }),
    );
  });

  it('fails on a link to an unknown element', () => {
    const dangling = threatSchema.parse({
      ...editedFlood,
      elements: ['element-ghost'],
    });
    expect(errorOf(replaceThreat(base, dangling))).toEqual(
      OperationFailure.UnknownElement({
        elementId: elementId('element-ghost'),
      }),
    );
  });
});

describe('attachThreat', () => {
  it('links an element of any diagram to the threat', () => {
    const next = modelOf(attachThreat(base, floodCheckout, ledger));
    expect(threatIn(next, 'threat-flood-checkout').elements).toEqual([
      'element-checkout',
      'element-ledger',
    ]);
  });

  it('changes nothing when the element is already linked', () => {
    expect(modelOf(attachThreat(base, spoofShopper, shopper))).toEqual(base);
  });

  it('fails on an unknown threat', () => {
    expect(
      errorOf(attachThreat(base, threatId('threat-ghost'), shopper)),
    ).toEqual(
      OperationFailure.UnknownThreat({ threatId: threatId('threat-ghost') }),
    );
  });

  it('fails on an unknown element', () => {
    expect(
      errorOf(attachThreat(base, spoofShopper, elementId('element-ghost'))),
    ).toEqual(
      OperationFailure.UnknownElement({
        elementId: elementId('element-ghost'),
      }),
    );
  });
});

describe('detachThreat', () => {
  it('unlinks the element from the threat', () => {
    const next = modelOf(detachThreat(base, spoofShopper, shopper));
    expect(threatIn(next, 'threat-spoof-shopper').elements).toEqual([]);
  });

  it('changes nothing when the element is not linked', () => {
    expect(modelOf(detachThreat(base, spoofShopper, ledger))).toEqual(base);
  });

  it('fails on an unknown threat', () => {
    expect(
      errorOf(detachThreat(base, threatId('threat-ghost'), shopper)),
    ).toEqual(
      OperationFailure.UnknownThreat({ threatId: threatId('threat-ghost') }),
    );
  });

  it('fails on an unknown element', () => {
    expect(
      errorOf(detachThreat(base, spoofShopper, elementId('element-ghost'))),
    ).toEqual(
      OperationFailure.UnknownElement({
        elementId: elementId('element-ghost'),
      }),
    );
  });
});

describe('renumberThreats', () => {
  it('hands out 1 to n in ascending order of current number', () => {
    const next = renumberThreats(base);
    expect(threatNumbers(base)).toEqual([2, 5, 9, 4, 7]);
    expect(threatNumbers(next)).toEqual([1, 3, 5, 2, 4]);
    expect(threatIds(next)).toEqual(threatIds(base));
  });

  it('changes nothing when applied to its own output', () => {
    const once = renumberThreats(base);
    expect(renumberThreats(once)).toEqual(once);
  });

  it('accepts an empty register', () => {
    expect(renumberThreats(emptyRegister).threats).toEqual([]);
  });
});

describe('nextThreatNumber', () => {
  it('is one above the highest number in use', () => {
    expect(nextThreatNumber(base)).toBe(10);
  });

  it('is 1 for an empty register', () => {
    expect(nextThreatNumber(emptyRegister)).toBe(1);
  });
});

describe('threat operation purity', () => {
  it('leaves the input model untouched', () => {
    const pristine = structuredClone(base);
    addThreat(base, replay);
    removeThreat(base, spoofShopper);
    replaceThreat(base, editedFlood);
    attachThreat(base, floodCheckout, ledger);
    detachThreat(base, spoofShopper, shopper);
    renumberThreats(base);
    nextThreatNumber(base);
    expect(base).toEqual(pristine);
  });
});

describe('threat operation outputs re-parse through parseModel', () => {
  const outputs: [string, Model][] = [
    ['addThreat', modelOf(addThreat(base, replay))],
    ['removeThreat', modelOf(removeThreat(base, spoofShopper))],
    ['replaceThreat', modelOf(replaceThreat(base, editedFlood))],
    ['attachThreat', modelOf(attachThreat(base, floodCheckout, ledger))],
    ['detachThreat', modelOf(detachThreat(base, spoofShopper, shopper))],
    ['renumberThreats', renumberThreats(base)],
  ];

  for (const [operation, model] of outputs) {
    it(`${operation} returns a model parseModel accepts`, () => {
      expect(Either.isRight(parseModel(model))).toBe(true);
    });
  }
});
