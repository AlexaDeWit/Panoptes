import { elementIdSchema, severitySchema } from '@panoptes/model';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  badgeExtent,
  badgesByElement,
  severityMark,
  severityRank,
  ThreatBadgeGlyph,
  type ThreatBadge,
} from './badges.js';
import { everyGlyphModel, parsedFixture } from './canvas.fixtures.js';
import { canvasClassNames, severityToneClass } from './stylesheet.js';

const id = (value: string) => elementIdSchema.parse(value);

const badges = badgesByElement(everyGlyphModel);

const threat = (
  number: number,
  severity: string,
  status: string,
  elements: string[],
) => ({
  id: `th-${number}`,
  number,
  title: `Threat ${number}`,
  category: { methodology: 'STRIDE', category: 'spoofing' },
  severity,
  status,
  description: '',
  mitigation: '',
  elements,
});

const modelWith = (threats: unknown[]) =>
  parsedFixture({
    metadata: { title: 't', owner: '', description: '', contributors: [] },
    diagrams: [
      {
        id: 'd',
        title: 'Diagram',
        elements: [
          {
            kind: 'actor',
            id: 'el-one',
            name: 'One',
            description: '',
            outOfScope: false,
            reasonOutOfScope: '',
            position: { x: 0, y: 0 },
            size: { width: 10, height: 10 },
          },
        ],
      },
    ],
    threats,
    lastIssuedThreatNumber: threats.length,
    mitigations: [],
    assumptions: [],
  });

const badgeOfOne = (threats: unknown[]): ThreatBadge | undefined =>
  badgesByElement(modelWith(threats)).get(id('el-one'));

describe('severityRank', () => {
  it('ranks every severity the model declares and no other', () => {
    expect(new Set(Object.keys(severityRank))).toEqual(
      new Set<string>(severitySchema.options),
    );
  });

  it('ranks the assessed severities worst last, undecided below them all', () => {
    expect(severityRank.undecided).toBe(0);
    expect(severityRank.low).toBeLessThan(severityRank.medium);
    expect(severityRank.medium).toBeLessThan(severityRank.high);
    expect(severityRank.high).toBeLessThan(severityRank.critical);
  });
});

describe('severityMark', () => {
  it('marks every severity the model declares and no other', () => {
    expect(new Set(Object.keys(severityMark))).toEqual(
      new Set<string>(severitySchema.options),
    );
  });

  it('gives each severity a mark of its own, so no two badges read alike', () => {
    expect(new Set(Object.values(severityMark)).size).toBe(
      severitySchema.options.length,
    );
  });
});

describe('badgesByElement', () => {
  it('colours the badge by the worst severity assessed among the open threats', () => {
    expect(
      badgeOfOne([
        threat(1, 'low', 'open', ['el-one']),
        threat(2, 'critical', 'open', ['el-one']),
        threat(3, 'medium', 'open', ['el-one']),
      ]),
    ).toEqual({ count: 3, severity: 'critical', secondary: 0 });
  });

  it('counts the undecided threats in a second badge beside the assessed', () => {
    expect(
      badgeOfOne([
        threat(1, 'high', 'open', ['el-one']),
        threat(2, 'undecided', 'open', ['el-one']),
        threat(3, 'undecided', 'open', ['el-one']),
      ]),
    ).toEqual({ count: 3, severity: 'high', secondary: 2 });
  });

  it('shows the neutral badge alone where every open threat is undecided', () => {
    expect(
      badgeOfOne([
        threat(1, 'undecided', 'open', ['el-one']),
        threat(2, 'undecided', 'open', ['el-one']),
      ]),
    ).toEqual({ count: 2, severity: 'undecided', secondary: 0 });
  });

  it('counts a threat in any status but open not at all', () => {
    expect(
      badgeOfOne([
        threat(1, 'critical', 'mitigated', ['el-one']),
        threat(2, 'high', 'accepted-risk', ['el-one']),
        threat(3, 'medium', 'open', ['el-one']),
      ]),
    ).toEqual({ count: 1, severity: 'medium', secondary: 0 });
  });

  it('gives an element with no open threat no badge at all', () => {
    expect(
      badgeOfOne([threat(1, 'critical', 'mitigated', ['el-one'])]),
    ).toBeUndefined();
  });

  it('counts a threat that names one element twice once', () => {
    expect(
      badgeOfOne([threat(1, 'low', 'open', ['el-one', 'el-one'])]),
    ).toEqual({ count: 1, severity: 'low', secondary: 0 });
  });

  it('badges a flow as it badges any other element', () => {
    expect(badges.get(id('el-request'))).toEqual({
      count: 1,
      severity: 'low',
      secondary: 0,
    });
  });
});

describe('badgeExtent', () => {
  it('reaches its own radius down where there is no second badge', () => {
    const extent = badgeExtent({ count: 1, severity: 'low', secondary: 0 });
    expect(extent.depth).toBe(extent.radius);
  });

  it('reaches past the second badge where one is drawn', () => {
    expect(
      badgeExtent({ count: 3, severity: 'low', secondary: 1 }).depth,
    ).toBeGreaterThan(
      badgeExtent({ count: 1, severity: 'low', secondary: 0 }).depth,
    );
  });

  it('reaches the same either side, whatever is stacked below', () => {
    expect(
      badgeExtent({ count: 3, severity: 'low', secondary: 1 }).radius,
    ).toBe(badgeExtent({ count: 1, severity: 'low', secondary: 0 }).radius);
  });
});

describe('ThreatBadgeGlyph', () => {
  it('draws the count in the tone of the badge severity', () => {
    const markup = renderToStaticMarkup(
      <ThreatBadgeGlyph
        badge={{ count: 4, severity: 'high', secondary: 0 }}
        at={{ x: 160, y: 0 }}
      />,
    );
    expect(markup).toContain('transform="translate(160, 0)"');
    expect(markup).toContain(`class="${severityToneClass.high}"`);
    expect(markup).toContain('>4</text>');
    expect(markup).not.toContain(canvasClassNames.badgeSecondary);
  });

  it('marks the severity in text, so the tone is not the only thing saying it', () => {
    const markup = renderToStaticMarkup(
      <ThreatBadgeGlyph
        badge={{ count: 4, severity: 'high', secondary: 0 }}
        at={{ x: 0, y: 0 }}
      />,
    );
    expect(markup).toContain(canvasClassNames.badgeMark);
    expect(markup).toContain(`>${severityMark.high}</text>`);
  });

  it('stacks the undecided count under the primary badge', () => {
    const markup = renderToStaticMarkup(
      <ThreatBadgeGlyph
        badge={{ count: 5, severity: 'critical', secondary: 2 }}
        at={{ x: 0, y: 0 }}
      />,
    );
    expect(markup).toContain(canvasClassNames.badgeSecondary);
    expect(markup).toContain(`class="${severityToneClass.undecided}"`);
    expect(markup).toContain('>2</text>');
  });
});
