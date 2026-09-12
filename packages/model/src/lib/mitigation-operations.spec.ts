import { Either } from 'effect';
import { mitigationId, parsedFixture, threatId } from '../fixtures.js';
import { threatRegisterFixture } from './fixtures.js';
import {
  addMitigation,
  linkMitigation,
  removeMitigation,
  replaceMitigation,
  setMitigationStatus,
  unlinkMitigation,
} from './mitigation-operations.js';
import { mitigationSchema, type Mitigation } from './mitigations.js';
import { OperationFailure } from './operation-failures.js';
import { parseModel, type Model } from './parse.js';

const base = parsedFixture(threatRegisterFixture);

const bindSession = mitigationId('mitigation-bind-session');
const spoofShopper = threatId('threat-spoof-shopper');
const tamperPayment = threatId('threat-tamper-payment');
const floodCheckout = threatId('threat-flood-checkout');
const ghostThreat = threatId('threat-ghost');
const ghostMitigation = mitigationId('mitigation-ghost');

const unlinkedFromFile = parsedFixture({
  ...threatRegisterFixture,
  mitigations: [
    {
      id: 'mitigation-bind-session',
      title: 'Bind sessions to a device',
      prose: 'Reject a session cookie replayed from another device.',
      status: 'proposed',
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

  it('refuses a mitigation linked to no threat and leaves the model alone', () => {
    const unlinked = mitigationSchema.parse({ ...rateLimitInput, threats: [] });
    expect(errorOf(addMitigation(base, unlinked))).toEqual(
      OperationFailure.RecordWithoutThreat({
        record: { kind: 'mitigation', id: unlinked.id },
      }),
    );
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

describe('replaceMitigation and the last threat link', () => {
  it('culls a mitigation the replacement takes to no threat link', () => {
    const unlinked = mitigationSchema.parse({ ...editedBinding, threats: [] });
    expect(mitigationIds(modelOf(replaceMitigation(base, unlinked)))).toEqual(
      [],
    );
  });

  it('keeps a mitigation that had no threat link before the replacement', () => {
    const retitled = mitigationSchema.parse({
      ...unlinkedFromFile.mitigations[0],
      title: 'Retitled',
    });
    expect(
      modelOf(replaceMitigation(unlinkedFromFile, retitled)).mitigations,
    ).toEqual([retitled]);
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

describe('linkMitigation', () => {
  it('adds the threat to the mitigation links', () => {
    const next = modelOf(linkMitigation(base, bindSession, floodCheckout));
    expect(next.mitigations[0].threats).toEqual([
      spoofShopper,
      tamperPayment,
      floodCheckout,
    ]);
  });

  it('returns the model it was given for a threat already linked', () => {
    expect(modelOf(linkMitigation(base, bindSession, spoofShopper))).toBe(base);
  });

  it('refuses an unknown threat or an unknown mitigation', () => {
    expect(errorOf(linkMitigation(base, bindSession, ghostThreat))).toEqual(
      OperationFailure.UnknownThreat({ threatId: ghostThreat }),
    );
    expect(
      errorOf(linkMitigation(base, ghostMitigation, spoofShopper)),
    ).toEqual(
      OperationFailure.UnknownMitigation({ mitigationId: ghostMitigation }),
    );
  });
});

describe('unlinkMitigation', () => {
  it('keeps a mitigation that still links another threat', () => {
    const next = modelOf(unlinkMitigation(base, bindSession, spoofShopper));
    expect(next.mitigations[0].threats).toEqual([tamperPayment]);
  });

  it('culls the mitigation from the model when the threat was its last link', () => {
    const once = modelOf(unlinkMitigation(base, bindSession, spoofShopper));
    expect(
      mitigationIds(
        modelOf(unlinkMitigation(once, bindSession, tamperPayment)),
      ),
    ).toEqual([]);
  });

  it('returns the model it was given for a threat not linked', () => {
    expect(modelOf(unlinkMitigation(base, bindSession, floodCheckout))).toBe(
      base,
    );
  });

  it('refuses an unknown threat or an unknown mitigation', () => {
    expect(errorOf(unlinkMitigation(base, bindSession, ghostThreat))).toEqual(
      OperationFailure.UnknownThreat({ threatId: ghostThreat }),
    );
    expect(
      errorOf(unlinkMitigation(base, ghostMitigation, spoofShopper)),
    ).toEqual(
      OperationFailure.UnknownMitigation({ mitigationId: ghostMitigation }),
    );
  });
});

describe('setMitigationStatus', () => {
  it('changes only the status of that mitigation', () => {
    const next = modelOf(setMitigationStatus(base, bindSession, 'verified'));
    expect(next).toEqual({
      ...base,
      mitigations: [{ ...base.mitigations[0], status: 'verified' }],
    });
  });

  it('keeps a mitigation that has no threat link', () => {
    const next = modelOf(
      setMitigationStatus(unlinkedFromFile, bindSession, 'implemented'),
    );
    expect(next.mitigations).toEqual([
      { ...unlinkedFromFile.mitigations[0], status: 'implemented' },
    ]);
  });

  it('refuses an unknown mitigation', () => {
    expect(
      errorOf(setMitigationStatus(base, ghostMitigation, 'verified')),
    ).toEqual(
      OperationFailure.UnknownMitigation({ mitigationId: ghostMitigation }),
    );
  });
});

describe('mitigation operation purity', () => {
  it('leaves the input model untouched', () => {
    const pristine = structuredClone(base);
    addMitigation(base, rateLimit);
    replaceMitigation(base, editedBinding);
    removeMitigation(base, bindSession);
    linkMitigation(base, bindSession, floodCheckout);
    unlinkMitigation(base, bindSession, spoofShopper);
    setMitigationStatus(base, bindSession, 'verified');
    expect(base).toEqual(pristine);
  });
});

describe('mitigation operation outputs re-parse through parseModel', () => {
  const outputs: [string, Model][] = [
    ['addMitigation', modelOf(addMitigation(base, rateLimit))],
    ['replaceMitigation', modelOf(replaceMitigation(base, editedBinding))],
    ['removeMitigation', modelOf(removeMitigation(base, bindSession))],
    [
      'linkMitigation',
      modelOf(linkMitigation(base, bindSession, floodCheckout)),
    ],
    [
      'unlinkMitigation',
      modelOf(unlinkMitigation(base, bindSession, spoofShopper)),
    ],
    [
      'setMitigationStatus',
      modelOf(setMitigationStatus(base, bindSession, 'verified')),
    ],
  ];

  for (const [operation, model] of outputs) {
    it(`${operation} returns a model parseModel accepts`, () => {
      expect(Either.isRight(parseModel(model))).toBe(true);
    });
  }
});
