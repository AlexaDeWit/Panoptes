import {
  assumptionIdSchema,
  diagramIdSchema,
  elementIdSchema,
  mitigationIdSchema,
  threatIdSchema,
} from '@panoptes/model';
import {
  hasDiverged,
  noDivergence,
  renderDivergences,
  type Divergence,
  type DivergenceReason,
  type DivergenceSubject,
} from './divergence.js';

const escapeChar = String.fromCharCode(27);

const bellChar = String.fromCharCode(7);

const entry = (
  subject: DivergenceSubject,
  detail: string,
  reason: DivergenceReason,
): Divergence => ({ subject, detail, reason });

const threatSubject: DivergenceSubject = {
  kind: 'threat',
  id: threatIdSchema.parse('threat-4'),
};

const splitThreat = entry(
  threatSubject,
  'one identity across the three elements it is attached to',
  'split',
);

describe('divergences', () => {
  it('are empty where the file and the model correspond', () => {
    expect(noDivergence).toEqual([]);
    expect(hasDiverged(noDivergence)).toBe(false);
  });

  it('share the aligned value without letting a caller append to it', () => {
    expect(Object.isFrozen(noDivergence)).toBe(true);
  });

  it('count as diverged once one is recorded', () => {
    expect(hasDiverged([splitThreat])).toBe(true);
  });
});

describe('renderDivergences', () => {
  it('says so where nothing diverged', () => {
    expect(renderDivergences(noDivergence)).toBe('No divergence recorded.');
  });

  it('renders one line per entry, in the recorded order', () => {
    const divergences = [
      splitThreat,
      entry(
        { kind: 'element', id: elementIdSchema.parse('element-customer') },
        'the cell ports',
        'discarded-by-edit',
      ),
    ];
    expect(renderDivergences(divergences)).toBe(
      [
        'threat "threat-4": one identity across the three elements it is attached to (split by the format)',
        'element "element-customer": the cell ports (removed by an edit)',
      ].join('\n'),
    );
  });

  it('names the model as a whole where no record owns the divergence', () => {
    expect(
      renderDivergences([
        entry(
          { kind: 'model' },
          'the last issued threat number',
          'unrepresentable',
        ),
      ]),
    ).toBe('model: the last issued threat number (no place in the format)');
  });

  it('names every other entity kind by its kind and id', () => {
    const subjects: DivergenceSubject[] = [
      { kind: 'diagram', id: diagramIdSchema.parse('diagram-main') },
      { kind: 'element', id: elementIdSchema.parse('element-customer') },
      { kind: 'threat', id: threatIdSchema.parse('threat-4') },
      { kind: 'mitigation', id: mitigationIdSchema.parse('mitigation-1') },
      { kind: 'assumption', id: assumptionIdSchema.parse('assumption-1') },
    ];
    const divergences = subjects.map((subject) =>
      entry(subject, 'the record', 'unrepresentable'),
    );
    expect(renderDivergences(divergences).split('\n')).toEqual([
      'diagram "diagram-main": the record (no place in the format)',
      'element "element-customer": the record (no place in the format)',
      'threat "threat-4": the record (no place in the format)',
      'mitigation "mitigation-1": the record (no place in the format)',
      'assumption "assumption-1": the record (no place in the format)',
    ]);
  });

  it('words every reason', () => {
    const reasons: DivergenceReason[] = [
      'unrepresentable',
      'undeclared',
      'narrowed',
      'split',
      'overridden',
      'discarded-by-edit',
    ];
    const divergences = reasons.map((reason) =>
      entry({ kind: 'model' }, 'the thing', reason),
    );
    expect(renderDivergences(divergences).split('\n')).toEqual([
      'model: the thing (no place in the format)',
      'model: the thing (not declared by the wire schema)',
      'model: the thing (reduced to fit the format)',
      'model: the thing (split by the format)',
      'model: the thing (not repeated by the codec)',
      'model: the thing (removed by an edit)',
    ]);
  });

  it('escapes a backslash, so no id renders as another', () => {
    const rendered = (id: string): string =>
      renderDivergences([
        entry(
          { kind: 'element', id: elementIdSchema.parse(id) },
          'the ports',
          'unrepresentable',
        ),
      ]);
    expect(rendered('a\\u000ab')).toBe(
      'element "a\\\\u000ab": the ports (no place in the format)',
    );
    expect(rendered('a\nb')).not.toBe(rendered('a\\u000ab'));
  });

  it('escapes a quote inside the quotes it wraps an id in', () => {
    expect(
      renderDivergences([
        entry(
          { kind: 'element', id: elementIdSchema.parse('he said "no"') },
          'the ports',
          'unrepresentable',
        ),
      ]),
    ).toBe('element "he said \\"no\\"": the ports (no place in the format)');
  });

  it('escapes the control characters a foreign file carries into a terminal', () => {
    const divergences = [
      entry(
        { kind: 'element', id: elementIdSchema.parse('a\nb') },
        `the key summary${escapeChar}[31m${bellChar}`,
        'unrepresentable',
      ),
    ];
    expect(renderDivergences(divergences).split('\n')).toEqual([
      'element "a\\u000ab": the key summary\\u001b[31m\\u0007 (no place in the format)',
    ]);
  });
});
