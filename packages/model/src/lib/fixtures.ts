import { Either } from 'effect';
import { z } from 'zod';
import {
  diagramIdSchema,
  elementIdSchema,
  threatIdSchema,
  type DiagramId,
  type ElementId,
  type ThreatId,
} from './ids.js';
import { modelSchema } from './model.js';
import { parseModel, type Model } from './parse.js';

/** Parses a spec's literal string into a branded element id. */
export const elementId = (value: string): ElementId =>
  elementIdSchema.parse(value);

/** Parses a spec's literal string into a branded diagram id. */
export const diagramId = (value: string): DiagramId =>
  diagramIdSchema.parse(value);

/** Parses a spec's literal string into a branded threat id. */
export const threatId = (value: string): ThreatId =>
  threatIdSchema.parse(value);

/**
 * The parsed form of a fixture, for specs that need a Model rather than the
 * schema's input. Throws where the fixture stops parsing: a fixture that no
 * longer parses is a broken suite, not a case under test. The message
 * carries parseModel's issues, so the failure names the construct the
 * fixture lost.
 */
export function parsedFixture(input: z.input<typeof modelSchema>): Model {
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
 * Hand-authored valid model exercising every record kind: the five element
 * kinds (the flow anchored at its source and free at its target, trust
 * boundaries in both shapes), a threat attached to two elements, a
 * mitigation, and an assumption. Typed as the schema's input, not as a
 * Model: specs feed it through parseModel.
 */
export const validModelFixture: z.input<typeof modelSchema> = {
  metadata: {
    title: 'Order service',
    owner: 'Alexandra de Wit',
    description: 'Sample model exercising every record kind.',
    contributors: ['Alexandra de Wit'],
  },
  diagrams: [
    {
      id: 'diagram-main',
      title: 'Main data flow',
      elements: [
        {
          kind: 'actor',
          id: 'element-customer',
          name: 'Customer',
          description: 'Places orders from a browser.',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 40, y: 120 },
          size: { width: 160, height: 80 },
        },
        {
          kind: 'process',
          id: 'element-api',
          name: 'Order API',
          description: 'Accepts and validates orders.',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 320, y: 120 },
          size: { width: 160, height: 80 },
        },
        {
          kind: 'store',
          id: 'element-db',
          name: 'Order database',
          description: 'Persists orders.',
          outOfScope: true,
          reasonOutOfScope: 'Managed by the cloud provider.',
          position: { x: 600, y: 120 },
          size: { width: 160, height: 80 },
        },
        {
          kind: 'flow',
          id: 'element-order-flow',
          name: 'Submit order',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          source: { kind: 'attached', element: 'element-customer' },
          target: { kind: 'free', position: { x: 280, y: 160 } },
          waypoints: [{ x: 200, y: 140 }],
        },
        {
          kind: 'trust-boundary',
          id: 'element-perimeter',
          name: 'Service perimeter',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          shape: {
            kind: 'box',
            position: { x: 280, y: 60 },
            size: { width: 520, height: 220 },
          },
        },
        {
          kind: 'trust-boundary',
          id: 'element-billing-zone',
          name: 'Billing zone',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          shape: {
            kind: 'curve',
            waypoints: [
              { x: 40, y: 320 },
              { x: 400, y: 300 },
              { x: 760, y: 340 },
            ],
          },
        },
      ],
    },
  ],
  threats: [
    {
      id: 'threat-tamper-order',
      number: 1,
      title: 'Order tampering in transit',
      category: { methodology: 'STRIDE', category: 'tampering' },
      severity: 'high',
      status: 'open',
      description: 'An order can be altered between the customer and the API.',
      mitigation: '',
      elements: ['element-api', 'element-order-flow'],
    },
  ],
  lastIssuedThreatNumber: 1,
  mitigations: [
    {
      id: 'mitigation-tls',
      title: 'TLS on the order flow',
      prose: 'Terminate TLS at the perimeter and pin the certificate.',
      status: 'proposed',
      threats: ['threat-tamper-order'],
    },
  ],
  assumptions: [
    {
      id: 'assumption-managed-db',
      prose: 'The order database encrypts its disks.',
      status: 'valid',
      elements: ['element-db'],
      threats: ['threat-tamper-order'],
    },
  ],
};

/**
 * Hand-authored valid model for the threat register: two diagrams, threats
 * numbered with gaps and spread over severities and statuses, an element
 * two threats reference, an element no threat references, and a threat
 * linked to no element. The last issued number sits above every number the
 * register still holds, the state a register reaches once its
 * highest-numbered threat is removed. The coverage query specs compute
 * their expected results from it by hand. Typed as the schema's input, not
 * as a Model: specs feed it through parseModel.
 */
export const threatRegisterFixture: z.input<typeof modelSchema> = {
  metadata: {
    title: 'Payment gateway',
    owner: 'Alexandra de Wit',
    description: 'Sample model with a threat register worth querying.',
    contributors: [],
  },
  diagrams: [
    {
      id: 'diagram-front',
      title: 'Front of house',
      elements: [
        {
          kind: 'actor',
          id: 'element-shopper',
          name: 'Shopper',
          description: 'Pays for a basket.',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 40, y: 40 },
          size: { width: 160, height: 80 },
        },
        {
          kind: 'process',
          id: 'element-checkout',
          name: 'Checkout',
          description: 'Takes payment details.',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 320, y: 40 },
          size: { width: 160, height: 80 },
        },
        {
          kind: 'flow',
          id: 'element-pay-flow',
          name: 'Pay',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          source: { kind: 'attached', element: 'element-shopper' },
          target: { kind: 'attached', element: 'element-checkout' },
          waypoints: [],
        },
      ],
    },
    {
      id: 'diagram-back',
      title: 'Back of house',
      elements: [
        {
          kind: 'process',
          id: 'element-ledger',
          name: 'Ledger',
          description: 'Records settled payments.',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 40, y: 240 },
          size: { width: 160, height: 80 },
        },
        {
          kind: 'store',
          id: 'element-vault',
          name: 'Card vault',
          description: 'Holds tokenized cards.',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 320, y: 240 },
          size: { width: 160, height: 80 },
        },
      ],
    },
  ],
  threats: [
    {
      id: 'threat-spoof-shopper',
      number: 2,
      title: 'Shopper impersonation',
      category: { methodology: 'STRIDE', category: 'spoofing' },
      severity: 'high',
      status: 'open',
      description: 'A stolen session cookie passes as the shopper.',
      mitigation: '',
      elements: ['element-shopper'],
    },
    {
      id: 'threat-tamper-payment',
      number: 5,
      title: 'Payment amount tampering',
      category: { methodology: 'STRIDE', category: 'tampering' },
      severity: 'critical',
      status: 'open',
      description: 'The basket total is altered on its way to checkout.',
      mitigation: '',
      elements: ['element-pay-flow', 'element-checkout'],
    },
    {
      id: 'threat-leak-vault',
      number: 9,
      title: 'Card vault disclosure',
      category: {
        methodology: 'STRIDE',
        category: 'information-disclosure',
      },
      severity: 'high',
      status: 'mitigated',
      description: 'A backup of the vault leaves the trust boundary.',
      mitigation: 'Backups are encrypted with a key held off the host.',
      elements: ['element-vault'],
    },
    {
      id: 'threat-flood-checkout',
      number: 4,
      title: 'Checkout flooding',
      category: { methodology: 'STRIDE', category: 'denial-of-service' },
      severity: 'low',
      status: 'open',
      description: 'Repeated basket submissions exhaust checkout capacity.',
      mitigation: '',
      elements: ['element-checkout'],
    },
    {
      id: 'threat-model-drift',
      number: 7,
      title: 'Model drift from the deployed system',
      category: {
        methodology: 'custom',
        methodologyName: 'Process',
        category: 'documentation',
      },
      severity: 'undecided',
      status: 'accepted-risk',
      description: 'The diagrams fall behind the system they describe.',
      mitigation: '',
      elements: [],
    },
  ],
  lastIssuedThreatNumber: 12,
  mitigations: [
    {
      id: 'mitigation-bind-session',
      title: 'Bind sessions to a device',
      prose: 'Reject a session cookie replayed from another device.',
      status: 'proposed',
      threats: ['threat-spoof-shopper', 'threat-tamper-payment'],
    },
  ],
  assumptions: [
    {
      id: 'assumption-pci-scope',
      prose: 'The card vault is audited under PCI DSS every year.',
      status: 'valid',
      elements: ['element-vault'],
      threats: ['threat-spoof-shopper'],
    },
  ],
};

/**
 * The threat register fixture before any analysis: its diagrams with no
 * threats, mitigations, or assumptions, and no threat number yet issued.
 * Typed as the schema's input, not as a Model: specs feed it through
 * parseModel.
 */
export const emptyRegisterFixture: z.input<typeof modelSchema> = {
  ...threatRegisterFixture,
  threats: [],
  lastIssuedThreatNumber: 0,
  mitigations: [],
  assumptions: [],
};
