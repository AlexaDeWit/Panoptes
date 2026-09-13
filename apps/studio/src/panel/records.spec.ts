import { mitigationId } from '@saerskriven/model/fixtures';
import {
  firstThreat,
  recordedModel,
  secondThreat,
} from '../store/store.fixtures.js';
import {
  assumptionKind,
  editedRecord,
  linkableRecords,
  mitigationKind,
  otherThreats,
  recordFieldIn,
  recordFieldName,
  recordLabel,
  recordsOn,
} from './records.js';

const [mitigation] = recordedModel.mitigations;

describe('record kinds', () => {
  it('start a mitigation proposed and an assumption unconfirmed, each on the threat alone', () => {
    expect(mitigationKind.fresh(firstThreat)).toMatchObject({
      status: 'proposed',
      threats: [firstThreat],
    });
    expect(assumptionKind.fresh(firstThreat)).toMatchObject({
      status: 'unconfirmed',
      threats: [firstThreat],
    });
  });
});

describe('recordsOn and linkableRecords', () => {
  const shared = {
    ...mitigation,
    id: mitigationId('mitigation-shared'),
    title: 'Read-only share links',
    threats: [firstThreat, secondThreat],
  };
  const records = [mitigation, shared];

  it('split one register into what the threat holds and what it could link', () => {
    expect(recordsOn(records, secondThreat)).toEqual([shared]);
    expect(
      linkableRecords(records, secondThreat).map(({ record }) => record),
    ).toEqual([mitigation]);
  });

  it('labels a record with no text by its id', () => {
    const blank = { ...mitigation, title: '', prose: '\n' };
    expect(linkableRecords([blank], secondThreat)[0].label).toContain(
      mitigation.id,
    );
  });

  it('counts the other threats a record is on', () => {
    expect(otherThreats(shared, firstThreat)).toBe(1);
    expect(otherThreats(mitigation, firstThreat)).toBe(0);
  });
});

describe('editedRecord', () => {
  it('is nothing for text the record already holds', () => {
    expect(
      editedRecord(mitigationKind, mitigation, 'title', mitigation.title),
    ).toBeUndefined();
  });

  it('replaces only the part edited', () => {
    expect(
      editedRecord(mitigationKind, mitigation, 'prose', 'Links carry a scope.'),
    ).toEqual({ ...mitigation, prose: 'Links carry a scope.' });
  });
});

describe('record field names', () => {
  it('give back the record of their own kind, and whether it was a pending row', () => {
    const name = recordFieldName({
      noun: 'mitigation',
      part: 'title',
      recordId: 'mitigation/odd id',
      pending: true,
    });
    expect(recordFieldIn(name, 'mitigation')).toEqual({
      noun: 'mitigation',
      part: 'title',
      recordId: 'mitigation/odd id',
      pending: true,
    });
    expect(recordFieldIn(name, 'assumption')).toBeUndefined();
    expect(recordFieldIn('Description', 'mitigation')).toBeUndefined();
  });
});

describe('recordLabel', () => {
  it('is the title, else the first line of text, else the id', () => {
    expect(recordLabel(mitigation)).toBe(mitigation.title);
    expect(recordLabel({ ...mitigation, title: '', prose: 'One\nTwo' })).toBe(
      'One',
    );
    expect(recordLabel({ ...mitigation, title: '', prose: '' })).toBe(
      mitigation.id,
    );
  });
});
