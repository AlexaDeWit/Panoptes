import {
  assumptionIdSchema,
  diagramIdSchema,
  elementIdSchema,
  mitigationIdSchema,
  threatIdSchema,
} from '@panoptes/model';
import {
  emptyLossReport,
  isLossless,
  renderLossReport,
  type LossEntry,
  type LossReason,
  type LossSubject,
} from './loss.js';

const entry = (
  subject: LossSubject,
  dropped: string,
  reason: LossReason,
): LossEntry => ({ subject, dropped, reason });

const threatSubject: LossSubject = {
  kind: 'threat',
  id: threatIdSchema.parse('threat-4'),
};

const splitThreat = entry(
  threatSubject,
  'one identity across the three elements it is attached to',
  'split',
);

describe('loss report', () => {
  it('is empty when nothing was lost', () => {
    expect(emptyLossReport).toEqual([]);
    expect(isLossless(emptyLossReport)).toBe(true);
  });

  it('shares the empty report without letting a caller append to it', () => {
    expect(Object.isFrozen(emptyLossReport)).toBe(true);
  });

  it('is no longer lossless once it carries an entry', () => {
    expect(isLossless([splitThreat])).toBe(false);
  });
});

describe('renderLossReport', () => {
  it('says so where the report is empty', () => {
    expect(renderLossReport(emptyLossReport)).toBe('No loss recorded.');
  });

  it('renders one line per entry, in the report order', () => {
    const report = [
      splitThreat,
      entry(
        { kind: 'element', id: elementIdSchema.parse('element-customer') },
        'the cell ports',
        'discarded-by-edit',
      ),
    ];
    expect(renderLossReport(report)).toBe(
      [
        'threat "threat-4": one identity across the three elements it is attached to (split by the format)',
        'element "element-customer": the cell ports (removed by an edit)',
      ].join('\n'),
    );
  });

  it('names the model as a whole where no record owns the loss', () => {
    expect(
      renderLossReport([
        entry(
          { kind: 'model' },
          'the last issued threat number',
          'unrepresentable',
        ),
      ]),
    ).toBe('model: the last issued threat number (no place in the format)');
  });

  it('names every other entity kind by its kind and id', () => {
    const subjects: LossSubject[] = [
      { kind: 'diagram', id: diagramIdSchema.parse('diagram-main') },
      { kind: 'element', id: elementIdSchema.parse('element-customer') },
      { kind: 'threat', id: threatIdSchema.parse('threat-4') },
      { kind: 'mitigation', id: mitigationIdSchema.parse('mitigation-1') },
      { kind: 'assumption', id: assumptionIdSchema.parse('assumption-1') },
    ];
    const report = subjects.map((subject) =>
      entry(subject, 'the record', 'unrepresentable'),
    );
    expect(renderLossReport(report).split('\n')).toEqual([
      'diagram "diagram-main": the record (no place in the format)',
      'element "element-customer": the record (no place in the format)',
      'threat "threat-4": the record (no place in the format)',
      'mitigation "mitigation-1": the record (no place in the format)',
      'assumption "assumption-1": the record (no place in the format)',
    ]);
  });

  it('words every reason', () => {
    const reasons: LossReason[] = [
      'unrepresentable',
      'narrowed',
      'split',
      'discarded-by-edit',
    ];
    const report = reasons.map((reason) =>
      entry({ kind: 'model' }, 'the thing', reason),
    );
    expect(renderLossReport(report).split('\n')).toEqual([
      'model: the thing (no place in the format)',
      'model: the thing (reduced to fit the format)',
      'model: the thing (split by the format)',
      'model: the thing (removed by an edit)',
    ]);
  });
});
