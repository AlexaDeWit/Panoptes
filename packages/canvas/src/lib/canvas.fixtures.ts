import { parseModel, type Model } from '@panoptes/model';
import { Either } from 'effect';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The parsed form of a fixture, for specs that need a Model. Throws where
 * the fixture stops parsing: a fixture that no longer parses is a broken
 * suite, not a case under test, and the message names the construct it lost.
 */
export function parsedFixture(input: unknown): Model {
  return Either.getOrThrowWith(
    parseModel(input),
    (failure) =>
      new Error(
        `Fixture does not parse: ${failure.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ')}`,
      ),
  );
}

/**
 * A model that draws every glyph and every badge tone: the six element
 * kinds, a trust boundary in both shapes, an out-of-scope element, a flow
 * with a waypoint and a flow with a free end, and open threats spread so
 * that one element carries the stacked pair of badges and another carries
 * the neutral badge alone. The mitigated threat is there to be left out of
 * every count.
 */
export const everyGlyphFixture = {
  metadata: {
    title: 'Every glyph',
    owner: 'Alexandra de Wit',
    description: 'Draws one of everything the canvas knows how to draw.',
    contributors: ['Alexandra de Wit'],
  },
  diagrams: [
    {
      id: 'diagram-main',
      title: 'Main data flow',
      elements: [
        {
          kind: 'trust-boundary',
          id: 'el-zone',
          name: 'Service perimeter',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          shape: {
            kind: 'box',
            position: { x: 0, y: 0 },
            size: { width: 640, height: 260 },
          },
        },
        {
          kind: 'trust-boundary',
          id: 'el-edge-zone',
          name: 'Edge zone',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          shape: {
            kind: 'curve',
            waypoints: [
              { x: 300, y: 300 },
              { x: 420, y: 340 },
              { x: 540, y: 300 },
            ],
          },
        },
        {
          kind: 'actor',
          id: 'el-client',
          name: 'Customer\nbrowser',
          description: 'Places orders.',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 40, y: 60 },
          size: { width: 160, height: 80 },
        },
        {
          kind: 'process',
          id: 'el-api',
          name: 'Order API',
          description: 'Accepts and validates orders.',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 280, y: 60 },
          size: { width: 120, height: 120 },
        },
        {
          kind: 'store',
          id: 'el-db',
          name: 'Order database',
          description: 'Persists orders.',
          outOfScope: true,
          reasonOutOfScope: 'Run by the cloud provider.',
          position: { x: 460, y: 60 },
          size: { width: 160, height: 80 },
        },
        {
          kind: 'text',
          id: 'el-note',
          name: 'Retention note',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 40, y: 320 },
          size: { width: 200, height: 90 },
          text: 'Orders are kept for seven years.',
        },
        {
          kind: 'flow',
          id: 'el-request',
          name: 'Submit order',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          source: { kind: 'attached', element: 'el-client' },
          target: { kind: 'attached', element: 'el-api' },
          waypoints: [{ x: 240, y: 100 }],
        },
        {
          kind: 'flow',
          id: 'el-probe',
          name: 'Nightly backup probe',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          source: { kind: 'free', position: { x: 620, y: 320 } },
          target: { kind: 'attached', element: 'el-db' },
          waypoints: [],
        },
      ],
    },
  ],
  threats: [
    {
      id: 'th-critical',
      number: 1,
      title: 'Session theft',
      category: { methodology: 'STRIDE', category: 'spoofing' },
      severity: 'critical',
      status: 'open',
      description: '',
      mitigation: '',
      elements: ['el-client'],
    },
    {
      id: 'th-mitigated',
      number: 2,
      title: 'Clickjacking',
      category: { methodology: 'STRIDE', category: 'tampering' },
      severity: 'high',
      status: 'mitigated',
      description: '',
      mitigation: 'Frame-ancestors is set.',
      elements: ['el-client'],
    },
    {
      id: 'th-high',
      number: 3,
      title: 'Unauthenticated write',
      category: { methodology: 'STRIDE', category: 'elevation-of-privilege' },
      severity: 'high',
      status: 'open',
      description: '',
      mitigation: '',
      elements: ['el-api'],
    },
    {
      id: 'th-undecided-api',
      number: 4,
      title: 'Request smuggling',
      category: { methodology: 'STRIDE', category: 'tampering' },
      severity: 'undecided',
      status: 'open',
      description: '',
      mitigation: '',
      elements: ['el-api'],
    },
    {
      id: 'th-medium',
      number: 5,
      title: 'Backup left unencrypted',
      category: {
        methodology: 'STRIDE',
        category: 'information-disclosure',
      },
      severity: 'medium',
      status: 'open',
      description: '',
      mitigation: '',
      elements: ['el-db'],
    },
    {
      id: 'th-low',
      number: 6,
      title: 'Order replay',
      category: { methodology: 'STRIDE', category: 'repudiation' },
      severity: 'low',
      status: 'open',
      description: '',
      mitigation: '',
      elements: ['el-request'],
    },
    {
      id: 'th-undecided-zone',
      number: 7,
      title: 'Perimeter drift',
      category: { methodology: 'STRIDE', category: 'denial-of-service' },
      severity: 'undecided',
      status: 'open',
      description: '',
      mitigation: '',
      elements: ['el-zone'],
    },
  ],
  lastIssuedThreatNumber: 7,
  mitigations: [],
  assumptions: [],
};

/** {@link everyGlyphFixture} parsed. */
export const everyGlyphModel: Model = parsedFixture(everyGlyphFixture);

/**
 * The Écluse model in the internal form, read from the file both the model
 * and format suites read, so the canvas draws the same corpus they check.
 */
export const ecluseModel: Model = parsedFixture(
  JSON.parse(
    readFileSync(
      join(import.meta.dirname, '../../../../test-data/ecluse.model.json'),
      'utf8',
    ),
  ),
);
