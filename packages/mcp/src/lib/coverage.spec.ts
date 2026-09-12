import {
  elementsWithoutThreats,
  openThreatsBySeverity,
  threatCountByElement,
} from '@saerskriven/model';
import { coverage, renderCoverage } from './coverage.js';
import { answerOf, ecluseWorkspace } from './read-tools.fixtures.js';
import { readNamed } from './reading.js';

const ecluse = ecluseWorkspace();

const reported = answerOf(coverage(ecluse, {}));

const model = answerOf(readNamed(ecluse, undefined)).model;

describe('what saer_coverage reports', () => {
  it('lists the elements the model coverage query calls unanalyzed', () => {
    expect(reported.unanalyzed.map((row) => row.id)).toEqual(
      elementsWithoutThreats(model).map((element) => element.id),
    );
  });

  it('groups the open threats by every severity the model knows', () => {
    const grouped = openThreatsBySeverity(model);
    expect(reported.open.map((group) => [group.severity, group.count])).toEqual(
      Object.entries(grouped).map(([severity, threats]) => [
        severity,
        threats.length,
      ]),
    );
  });

  it('counts the threats of every element across every diagram', () => {
    expect(
      new Map(reported.perElement.map((row) => [row.id, row.threats])),
    ).toEqual(threatCountByElement(model));
  });

  it('says of an unanalyzed element whether it is marked out of scope', () => {
    expect(
      reported.unanalyzed.every((row) => typeof row.outOfScope === 'boolean'),
    ).toBe(true);
  });

  it('opens its text with the file, the format and the revision', () => {
    expect(renderCoverage(reported).slice(0, 2)).toEqual([
      'file: test-data/ecluse.json',
      'format: threat-dragon',
    ]);
  });
});
