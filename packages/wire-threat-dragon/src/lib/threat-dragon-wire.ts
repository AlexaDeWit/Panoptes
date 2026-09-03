import { z } from 'zod';

const idSchema = z.string().min(2);

const versionSchema = z.string().regex(/^2(\.\d+){0,2}$/);

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
  cell: idSchema,
  port: z.string().optional(),
});

const endpointSchema = z.union([anchorSchema, pointSchema]);

const threatSchema = z.object({
  id: idSchema,
  number: z.int().optional(),
  title: z.string(),
  type: z.string().nullable().optional(),
  modelType: z.string().optional(),
  status: z.string(),
  severity: z.string(),
  description: z.string(),
  mitigation: z.string(),
  score: z.string().optional(),
  new: z.boolean().optional(),
  eopGameId: z.string().nullable().optional(),
  cardSuit: z.string().nullable().optional(),
  cardNumber: z.string().nullable().optional(),
});

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

const textDataSchema = dataBaseSchema.extend({
  type: z.literal('tm.Text'),
});

const cellBaseSchema = z.object({
  id: idSchema,
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
  nodeCellSchema.extend({
    shape: z.literal('td-text-block'),
    data: textDataSchema,
  }),
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
 * A Threat Dragon v2 file, whole, and the whole of what this package
 * declares. Every key the format carries is here, the parts Panoptes does
 * not model included (text blocks, ports, `attrs` styling, `zIndex`,
 * `tools`, `placeholder`, `thumbnail`, `diagramTop`), because a write
 * merges onto this document and only a declared key is there to leave
 * alone. Nothing is defaulted and nothing is transformed: a key the file
 * omits stays omitted, so the document keeps saying what the file said.
 *
 * What this schema declares, it demands, and it demands nothing else. An
 * undeclared key is dropped rather than refused, since Threat Dragon owns
 * this shape and may add to it, and `@panoptes/formats` reports each
 * dropped key, so a schema that has fallen behind the format announces
 * itself rather than quietly shortening a file.
 *
 * A threat's `status`, `severity`, `type`, and `modelType` are plain text
 * because Threat Dragon stores each label in the author's own locale: a
 * German file holds `Manipulation` where an English one holds `Tampering`,
 * and its own schema types all four as strings. `number` is optional
 * because Threat Dragon requires only a threat's description, mitigation,
 * severity, status, title, and type, and most threats in its shipped demo
 * models carry no number at all. `diagramType` is text too, its generic
 * value being the word "Generic" translated, and so is what belongs to the
 * drawing library rather than to Threat Dragon: stroke colours, dash
 * arrays, marker and connector names, port visibility.
 *
 * A cell id, a threat id, and the cell an edge anchors to are two
 * characters or more. Threat Dragon's own schema puts that bound on a cell
 * id and on the `threatId` it names a threat by, and an anchor names a
 * cell, so one character there names no cell a file can hold.
 *
 * `version` accepts `2`, `2.x`, and `2.x.y`, and nothing else. Threat
 * Dragon's own test for a v2 file is that the version is present and does
 * not start with `1.`, and its models carry `2.0` as well as `2.6.2`, at
 * the root and on each diagram. A file from another major is refused whole
 * rather than read in part.
 *
 * The shape is Threat Dragon's `data` payload wrapped around AntV X6's own
 * cell serialization, which is why the styling, port, tool, and label
 * shapes are here at all: Threat Dragon saves whatever X6 hands it.
 * `trust-broundary-curve` is here on purpose, since Threat Dragon registers
 * that misspelling itself and one of the models it ships carries it. An `EOP`
 * threat's `eopGameId`, `cardSuit`, and `cardNumber` are read from the
 * threat editor's own bindings, where each is a string or null, and its
 * `type` is the null that editor writes.
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

/**
 * The `data` fields every cell carries, whatever it draws. A merge writes
 * onto these on a cell no threat can attach to, a trust boundary or a note.
 */
export type ThreatDragonBaseData = z.infer<typeof dataBaseSchema>;

/**
 * The `data` fields a cell a threat can attach to carries beyond the base:
 * the scoping pair and the nested threats. Every such cell's own data
 * extends this, so a merge writes the group once rather than per shape.
 */
export type ThreatDragonElementData = z.infer<typeof elementDataSchema>;

/** One threat, as Threat Dragon nests it under the cell it concerns. */
export type ThreatDragonThreat = z.infer<typeof threatSchema>;

/** Where a Threat Dragon edge starts or ends. */
export type ThreatDragonEndpoint = z.infer<typeof endpointSchema>;
