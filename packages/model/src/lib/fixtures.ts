import { z } from 'zod';
import { modelSchema } from './model.js';

/**
 * Hand-authored valid model exercising every record kind: the five element
 * kinds (the flow anchored at its source and free at its target), a threat
 * attached to two elements, a mitigation, and an assumption. Typed as the
 * schema's input, not as a Model: specs feed it through parseModel.
 */
export const validModelFixture: z.input<typeof modelSchema> = {
  metadata: {
    title: 'Order service',
    owner: 'Alexandra de Wit',
    description: 'Sample model exercising every record kind.',
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
