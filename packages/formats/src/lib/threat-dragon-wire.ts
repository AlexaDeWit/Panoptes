import { z } from 'zod';

const versionSchema = z.string().regex(/^2\.\d+\.\d+$/);

const pointSchema = z.object({ x: z.number(), y: z.number() });

const sizeSchema = z.object({ width: z.number(), height: z.number() });

const textSchema = z.object({ text: z.string() });

const markerSchema = z.union([z.object({ name: z.string() }), z.string()]);

const strokeSchema = z.object({
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  strokeDasharray: z.string().nullable().optional(),
  fill: z.string().optional(),
});

const lineSchema = strokeSchema.extend({
  sourceMarker: markerSchema.optional(),
  targetMarker: markerSchema.optional(),
});

const attrsSchema = z.object({
  label: textSchema.optional(),
  text: textSchema.optional(),
  body: strokeSchema.optional(),
  topLine: strokeSchema.optional(),
  bottomLine: strokeSchema.optional(),
  line: lineSchema.optional(),
});

const toolsSchema = z
  .object({
    name: z.string().nullable().optional(),
    items: z.array(z.string()).optional(),
  })
  .nullable();

const portSideSchema = z.enum(['top', 'right', 'bottom', 'left']);

const portGroupSchema = z.object({
  position: portSideSchema.optional(),
  attrs: z
    .object({
      circle: strokeSchema.extend({
        r: z.number().optional(),
        magnet: z.boolean().optional(),
        style: z.object({ visibility: z.string() }).optional(),
      }),
    })
    .optional(),
});

const portsSchema = z.object({
  groups: z
    .object({
      top: portGroupSchema.optional(),
      right: portGroupSchema.optional(),
      bottom: portGroupSchema.optional(),
      left: portGroupSchema.optional(),
    })
    .optional(),
  items: z
    .array(z.object({ group: portSideSchema, id: z.string() }))
    .optional(),
});

const labelPositionSchema = z.union([
  z.number(),
  z.object({
    distance: z.number().optional(),
    args: z
      .object({
        keepGradient: z.boolean().optional(),
        ensureLegibility: z.boolean().optional(),
      })
      .optional(),
  }),
]);

const labelSchema = z.union([
  z.string(),
  z.object({
    markup: z
      .array(z.object({ tagName: z.string(), selector: z.string() }))
      .optional(),
    attrs: z
      .object({
        label: textSchema.optional(),
        text: textSchema.optional(),
        labelText: textSchema
          .extend({
            textAnchor: z.string().optional(),
            textVerticalAnchor: z.string().optional(),
          })
          .optional(),
        labelBody: strokeSchema
          .extend({
            ref: z.string().optional(),
            refRx: z.string().optional(),
            refRy: z.string().optional(),
          })
          .optional(),
      })
      .optional(),
    position: labelPositionSchema.optional(),
  }),
]);

const anchorSchema = z.object({
  cell: z.string().min(1),
  port: z.string().optional(),
});

const endpointSchema = z.union([anchorSchema, pointSchema]);

const threatBaseSchema = z.object({
  id: z.string().min(1),
  number: z.int(),
  title: z.string(),
  status: z.enum(['NotApplicable', 'Open', 'Mitigated', 'Accepted']),
  severity: z.enum(['TBD', 'Low', 'Medium', 'High', 'Critical']),
  description: z.string(),
  mitigation: z.string(),
  score: z.string().optional(),
  new: z.boolean().optional(),
});

const strideThreatSchema = threatBaseSchema.extend({
  modelType: z.literal('STRIDE'),
  type: z.enum([
    'Spoofing',
    'Tampering',
    'Repudiation',
    'Information disclosure',
    'Denial of service',
    'Elevation of privilege',
  ]),
});

const linddunThreatSchema = threatBaseSchema.extend({
  modelType: z.literal('LINDDUN'),
  type: z.enum([
    'Linkability',
    'Identifiability',
    'Non-repudiation',
    'Detectability',
    'Disclosure of information',
    'Unawareness',
    'Non-compliance',
  ]),
});

const ciaThreatSchema = threatBaseSchema.extend({
  modelType: z.literal('CIA'),
  type: z.enum(['Confidentiality', 'Integrity', 'Availability']),
});

const ciaDieThreatSchema = threatBaseSchema.extend({
  modelType: z.literal('CIADIE'),
  type: z.enum([
    'Confidentiality',
    'Integrity',
    'Availability',
    'Distributed',
    'Immutable',
    'Ephemeral',
  ]),
});

const dieThreatSchema = threatBaseSchema.extend({
  modelType: z.literal('DIE'),
  type: z.enum(['Distributed', 'Immutable', 'Ephemeral']),
});

const plot4aiThreatSchema = threatBaseSchema.extend({
  modelType: z.literal('PLOT4ai'),
  type: z.enum([
    'Technique & Processes',
    'Accessibility',
    'Identifiability & Linkability',
    'Security',
    'Safety',
    'Unawareness',
    'Ethics & Human Rights',
    'Non-compliance',
  ]),
});

const genericThreatSchema = threatBaseSchema.extend({
  modelType: z.enum(['Generic', 'default']),
  type: z.string().min(1),
});

const threatSchema = z.discriminatedUnion('modelType', [
  strideThreatSchema,
  linddunThreatSchema,
  ciaThreatSchema,
  ciaDieThreatSchema,
  dieThreatSchema,
  plot4aiThreatSchema,
  genericThreatSchema,
]);

const dataBaseSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  isTrustBoundary: z.boolean().optional(),
  hasOpenThreats: z.boolean().optional(),
});

const elementDataSchema = dataBaseSchema.extend({
  outOfScope: z.boolean().optional(),
  reasonOutOfScope: z.string().optional(),
  threats: z.array(threatSchema).optional(),
  threatFrequency: z.record(z.string(), z.int()).optional(),
});

const boundaryDataSchema = dataBaseSchema.extend({
  containedElements: z.array(z.string()).optional(),
  crossingFlows: z.array(z.string()).optional(),
});

const actorDataSchema = elementDataSchema.extend({
  type: z.literal('tm.Actor'),
  providesAuthentication: z.boolean().optional(),
});

const processDataSchema = elementDataSchema.extend({
  type: z.literal('tm.Process'),
  handlesCardPayment: z.boolean().optional(),
  handlesGoodsOrServices: z.boolean().optional(),
  isWebApplication: z.boolean().optional(),
  privilegeLevel: z.string().optional(),
});

const storeDataSchema = elementDataSchema.extend({
  type: z.literal('tm.Store'),
  isALog: z.boolean().optional(),
  isEncrypted: z.boolean().optional(),
  isSigned: z.boolean().optional(),
  storesCredentials: z.boolean().optional(),
  storesInventory: z.boolean().optional(),
});

const flowDataSchema = elementDataSchema.extend({
  type: z.literal('tm.Flow'),
  isBidirectional: z.boolean().optional(),
  isEncrypted: z.boolean().optional(),
  isPublicNetwork: z.boolean().optional(),
  protocol: z.string().optional(),
  trustBoundaryIds: z.array(z.string()).optional(),
});

const boundaryBoxDataSchema = boundaryDataSchema.extend({
  type: z.literal('tm.BoundaryBox'),
});

const boundaryCurveDataSchema = boundaryDataSchema.extend({
  type: z.literal('tm.Boundary'),
});

const cellBaseSchema = z.object({
  id: z.string().min(1),
  zIndex: z.int().optional(),
  visible: z.boolean().optional(),
  attrs: attrsSchema.optional(),
  tools: toolsSchema.optional(),
});

const boxCellSchema = cellBaseSchema.extend({
  position: pointSchema,
  size: sizeSchema,
});

const nodeCellSchema = boxCellSchema.extend({
  angle: z.number().optional(),
  ports: portsSchema.optional(),
});

const edgeCellSchema = cellBaseSchema.extend({
  source: endpointSchema,
  target: endpointSchema,
  vertices: z.array(pointSchema).optional(),
  labels: z.array(labelSchema).optional(),
  connector: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

const curveCellSchema = edgeCellSchema.extend({
  data: boundaryCurveDataSchema,
  source: pointSchema,
  target: pointSchema,
});

const cellSchema = z.discriminatedUnion('shape', [
  nodeCellSchema.extend({ shape: z.literal('actor'), data: actorDataSchema }),
  nodeCellSchema.extend({
    shape: z.literal('process'),
    data: processDataSchema,
  }),
  nodeCellSchema.extend({ shape: z.literal('store'), data: storeDataSchema }),
  edgeCellSchema.extend({ shape: z.literal('flow'), data: flowDataSchema }),
  boxCellSchema.extend({
    shape: z.literal('trust-boundary-box'),
    data: boundaryBoxDataSchema,
  }),
  curveCellSchema.extend({ shape: z.literal('trust-boundary-curve') }),
  curveCellSchema.extend({ shape: z.literal('trust-broundary-curve') }),
]);

const diagramSchema = z.object({
  id: z.int(),
  title: z.string(),
  diagramType: z.string().min(1),
  description: z.string().optional(),
  placeholder: z.string().optional(),
  thumbnail: z.string().optional(),
  version: versionSchema.optional(),
  cells: z.array(cellSchema).optional(),
});

/**
 * A Threat Dragon v2 file, whole. Every key the format carries is declared,
 * the parts Panoptes does not model included (ports, `attrs` styling,
 * `zIndex`, `tools`, `placeholder`, `thumbnail`, `diagramTop`), because a
 * write merges onto this document and only a declared key is there to leave
 * alone. Nothing is defaulted or transformed here: a key the file omits
 * stays omitted, and the read supplies the model's default instead, so the
 * document keeps saying what the file said.
 *
 * Plain `z.object`, so an undeclared key is dropped rather than refused:
 * Threat Dragon owns this shape and may add to it. The read reports each
 * dropped key as an `undeclared` divergence, which with the version pinned
 * is a report that this schema has fallen behind the format.
 *
 * `version` accepts `2.x.y` and nothing else: the format is stable within
 * the major, and a file from another major is refused whole rather than
 * read in part. Threat Dragon repeats the stamp on every diagram and
 * rewrites it on open, so a diagram carries the same pin.
 *
 * The shape is Threat Dragon's `data` payload wrapped around AntV X6's own
 * cell serialization, which is why the styling, port, tool, and label
 * shapes are here at all: Threat Dragon saves whatever X6 hands it. It also
 * shows up as drift from the schema Threat Dragon publishes, which declares
 * `threats` on the cell rather than under `data`, names a threat's id
 * `threatId`, and omits `ports`, `tools`, `labels`, `threatFrequency`, and
 * the boundary bookkeeping. This schema follows what Threat Dragon 2.6.2
 * writes, not what it publishes.
 *
 * Threat Dragon's own vocabularies are bounded unions, and a threat is
 * discriminated on `modelType` so each methodology declares the categories
 * it admits. `diagramType` is not among them: its generic value is the
 * word "Generic" in the author's own locale, and it decides nothing on the
 * way in. What belongs to the drawing library rather than to Threat Dragon
 * (stroke colours, dash arrays, marker and connector names, port
 * visibility) stays plain text for the same reason.
 *
 * Two things Threat Dragon 2.6 writes are absent, and a file carrying
 * either is refused rather than read in part. `td-text-block` cells, whose
 * `tm.Text` annotation the internal model has no element for. And `EOP`
 * threats, which store a null `type` and identify their card in
 * `eopGameId`, `cardSuit`, and `cardNumber`, so they have no category the
 * model can hold. `trust-broundary-curve` is here on purpose: Threat Dragon
 * registers that misspelling itself, for the many models that carry it.
 */
export const threatDragonWireSchema = z.object({
  version: versionSchema,
  summary: z.object({
    title: z.string(),
    owner: z.string().optional(),
    description: z.string().optional(),
    id: z.union([z.int(), z.string()]).optional(),
    tags: z.array(z.string()).optional(),
  }),
  detail: z.object({
    contributors: z.array(z.object({ name: z.string().optional() })).optional(),
    diagrams: z.array(diagramSchema),
    diagramTop: z.int().optional(),
    reviewer: z.string().optional(),
    threatTop: z.int().optional(),
  }),
});

/** A whole Threat Dragon v2 document. */
export type ThreatDragonDocument = z.infer<typeof threatDragonWireSchema>;

/** One diagram of a Threat Dragon document. */
export type ThreatDragonDiagram = z.infer<typeof diagramSchema>;

/** One cell of a Threat Dragon diagram. */
export type ThreatDragonCell = z.infer<typeof cellSchema>;

/** One threat, as Threat Dragon nests it under the cell it concerns. */
export type ThreatDragonThreat = z.infer<typeof threatSchema>;

/** Where a Threat Dragon edge starts or ends. */
export type ThreatDragonEndpoint = z.infer<typeof endpointSchema>;
