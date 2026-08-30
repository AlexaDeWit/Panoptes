import {
  elementsWithoutThreats,
  openThreatsBySeverity,
  threatCountByElement,
} from './coverage.js';
import type { Element } from './elements.js';
import { parsedFixture, threatRegisterFixture } from './fixtures.js';
import { elementIdSchema } from './ids.js';
import type { Threat } from './threats.js';

const base = parsedFixture(threatRegisterFixture);
const emptyRegister = parsedFixture({
  ...threatRegisterFixture,
  threats: [],
  mitigations: [],
  assumptions: [],
});

const elementId = (value: string) => elementIdSchema.parse(value);

const idsOfElements = (elements: Element[]): string[] =>
  elements.map((element) => element.id);

const idsOfThreats = (threats: Threat[]): string[] =>
  threats.map((threat) => threat.id);

describe('elementsWithoutThreats', () => {
  it('returns the elements no threat references, across every diagram', () => {
    expect(idsOfElements(elementsWithoutThreats(base))).toEqual([
      'element-ledger',
    ]);
  });

  it('returns whole element records', () => {
    expect(elementsWithoutThreats(base)[0]).toMatchObject({
      kind: 'process',
      name: 'Ledger',
    });
  });

  it('returns every element when the register is empty', () => {
    expect(idsOfElements(elementsWithoutThreats(emptyRegister))).toEqual([
      'element-shopper',
      'element-checkout',
      'element-pay-flow',
      'element-ledger',
      'element-vault',
    ]);
  });
});

describe('openThreatsBySeverity', () => {
  it('groups the open threats under a key for every severity', () => {
    const grouped = openThreatsBySeverity(base);
    expect(
      Object.entries(grouped).map(([severity, threats]) => [
        severity,
        idsOfThreats(threats),
      ]),
    ).toEqual([
      ['low', ['threat-flood-checkout']],
      ['medium', []],
      ['high', ['threat-spoof-shopper']],
      ['critical', ['threat-tamper-payment']],
      ['tbd', []],
    ]);
  });

  it('returns whole threat records', () => {
    expect(openThreatsBySeverity(base).high[0]).toMatchObject({
      number: 2,
      title: 'Shopper impersonation',
      status: 'open',
    });
  });
});

describe('threatCountByElement', () => {
  it('counts the threats on every element of the model', () => {
    expect([...threatCountByElement(base)]).toEqual([
      ['element-shopper', 1],
      ['element-checkout', 2],
      ['element-pay-flow', 1],
      ['element-ledger', 0],
      ['element-vault', 1],
    ]);
  });

  it('counts a threat once where it links the same element twice', () => {
    const doubled = structuredClone(threatRegisterFixture);
    doubled.threats[0].elements.push('element-shopper');
    expect(
      threatCountByElement(parsedFixture(doubled)).get(
        elementId('element-shopper'),
      ),
    ).toBe(1);
  });
});
