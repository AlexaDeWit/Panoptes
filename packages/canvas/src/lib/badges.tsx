import {
  openThreatsBySeverity,
  severitySchema,
  type ElementId,
  type Model,
  type Point,
  type Severity,
} from '@panoptes/model';
import type { ReactElement } from 'react';
import { svgNumber } from './numbers.js';
import { translate } from './paths.js';
import { canvasClassNames, severityToneClass } from './stylesheet.js';

const primaryRadius = 11;

const secondaryRadius = 8;

const badgeGap = 3;

/**
 * Order of the severities, worst last. `undecided` ranks zero because it is
 * the absence of an assessment, so the rank also says whether a severity has
 * been assessed at all.
 */
export const severityRank = {
  undecided: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
} as const satisfies Record<Severity, number>;

/**
 * What an element's badge says. `count` is how many open threats name it and
 * `severity` the worst assessed among them, or `undecided` where none has
 * been assessed, which is the neutral badge. `secondary` is a rendering
 * decision rather than a plain count: it is what the second badge carries,
 * how many of those open threats are undecided, and it is zero where every
 * one of them is, since a second badge would then only repeat the first.
 */
export type ThreatBadge = {
  readonly count: number;
  readonly severity: Severity;
  readonly secondary: number;
};

/**
 * The badge each element earns, keyed by element id, over the whole model.
 * Open is the model's own definition, taken from `openThreatsBySeverity`, so
 * a badge, the register and the CLI count one set of threats. An element no
 * open threat names has no entry.
 */
export function badgesByElement(model: Model): Map<ElementId, ThreatBadge> {
  const counted = new Map<ElementId, Map<Severity, number>>();
  const open = openThreatsBySeverity(model);
  for (const severity of severitySchema.options) {
    for (const threat of open[severity]) {
      for (const element of new Set(threat.elements)) {
        const bySeverity = counted.get(element) ?? new Map<Severity, number>();
        bySeverity.set(severity, (bySeverity.get(severity) ?? 0) + 1);
        counted.set(element, bySeverity);
      }
    }
  }
  return new Map(
    [...counted].map(([element, bySeverity]) => [element, badgeOf(bySeverity)]),
  );
}

/** How far a badge reaches from the point it hangs on. */
export type BadgeExtent = {
  readonly radius: number;
  readonly depth: number;
};

/**
 * How far a badge reaches from the point it hangs on: `radius` to either
 * side and above, `depth` below, where a secondary badge sits. A caller
 * placing one clear of something measures it with this.
 */
export function badgeExtent(badge: ThreatBadge): BadgeExtent {
  return {
    radius: primaryRadius,
    depth:
      badge.secondary === 0
        ? primaryRadius
        : primaryRadius + badgeGap + secondaryRadius * 2,
  };
}

/**
 * The stacked pair of threat badges, its primary centred on `at`. The
 * secondary sits beneath the primary and is left out where the model gives
 * the two nothing to say apart.
 */
export function ThreatBadgeGlyph({
  badge,
  at,
}: {
  readonly badge: ThreatBadge;
  readonly at: Point;
}): ReactElement {
  return (
    <g className={canvasClassNames.badge} transform={translate(at)}>
      <g className={canvasClassNames.badgePrimary}>
        <circle
          className={severityToneClass[badge.severity]}
          r={svgNumber(primaryRadius)}
        />
        <text className={canvasClassNames.badgeCount}>{badge.count}</text>
      </g>
      {badge.secondary === 0 ? null : (
        <g
          className={canvasClassNames.badgeSecondary}
          transform={translate({
            x: 0,
            y: primaryRadius + badgeGap + secondaryRadius,
          })}
        >
          <circle
            className={severityToneClass.undecided}
            r={svgNumber(secondaryRadius)}
          />
          <text className={canvasClassNames.badgeCount}>{badge.secondary}</text>
        </g>
      )}
    </g>
  );
}

function badgeOf(bySeverity: ReadonlyMap<Severity, number>): ThreatBadge {
  let count = 0;
  let worst: Severity = 'undecided';
  for (const [severity, held] of bySeverity) {
    count += held;
    if (severityRank[severity] > severityRank[worst]) {
      worst = severity;
    }
  }
  const undecided = bySeverity.get('undecided') ?? 0;
  return {
    count,
    severity: worst,
    secondary: undecided === count ? 0 : undecided,
  };
}
