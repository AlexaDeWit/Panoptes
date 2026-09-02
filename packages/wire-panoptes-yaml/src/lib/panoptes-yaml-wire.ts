import { z } from 'zod';

const idSchema = z.string().min(1);

const pointSchema = z.object({ x: z.number(), y: z.number() });

const sizeSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
});

const waypointsSchema = z.array(pointSchema);

const elementBaseSchema = z.object({
  id: idSchema,
  name: z.string(),
  description: z.string(),
  outOfScope: z.boolean(),
  reasonOutOfScope: z.string(),
});

const nodeBaseSchema = elementBaseSchema.extend({
  position: pointSchema,
  size: sizeSchema,
});

const actorSchema = nodeBaseSchema.extend({ kind: z.literal('actor') });

const processSchema = nodeBaseSchema.extend({ kind: z.literal('process') });

const storeSchema = nodeBaseSchema.extend({ kind: z.literal('store') });

const attachedEndpointSchema = z.object({
  kind: z.literal('attached'),
  element: idSchema,
});

const freeEndpointSchema = z.object({
  kind: z.literal('free'),
  position: pointSchema,
});

const endpointSchema = z.discriminatedUnion('kind', [
  attachedEndpointSchema,
  freeEndpointSchema,
]);

const flowSchema = elementBaseSchema.extend({
  kind: z.literal('flow'),
  source: endpointSchema,
  target: endpointSchema,
  waypoints: waypointsSchema,
});

const boxBoundaryShapeSchema = z.object({
  kind: z.literal('box'),
  position: pointSchema,
  size: sizeSchema,
});

const curveBoundaryShapeSchema = z.object({
  kind: z.literal('curve'),
  waypoints: waypointsSchema.min(2),
});

const boundaryShapeSchema = z.discriminatedUnion('kind', [
  boxBoundaryShapeSchema,
  curveBoundaryShapeSchema,
]);

const trustBoundarySchema = elementBaseSchema.extend({
  kind: z.literal('trust-boundary'),
  shape: boundaryShapeSchema,
});

const textSchema = nodeBaseSchema.extend({
  kind: z.literal('text'),
  text: z.string(),
});

const elementSchema = z.discriminatedUnion('kind', [
  actorSchema,
  processSchema,
  storeSchema,
  flowSchema,
  trustBoundarySchema,
  textSchema,
]);

const strideCategorySchema = z.object({
  methodology: z.literal('STRIDE'),
  category: z.enum([
    'spoofing',
    'tampering',
    'repudiation',
    'information-disclosure',
    'denial-of-service',
    'elevation-of-privilege',
  ]),
});

const linddunCategorySchema = z.object({
  methodology: z.literal('LINDDUN'),
  category: z.enum([
    'linking',
    'identifying',
    'non-repudiation',
    'detecting',
    'data-disclosure',
    'unawareness',
    'non-compliance',
  ]),
});

const ciaCategorySchema = z.object({
  methodology: z.literal('CIA'),
  category: z.enum(['confidentiality', 'integrity', 'availability']),
});

const ciaDieCategorySchema = z.object({
  methodology: z.literal('CIA-DIE'),
  category: z.enum([
    'confidentiality',
    'integrity',
    'availability',
    'distributed',
    'immutable',
    'ephemeral',
  ]),
});

const plot4aiCategorySchema = z.object({
  methodology: z.literal('PLOT4ai'),
  category: z.enum([
    'accountability-and-human-oversight',
    'bias-fairness-and-discrimination',
    'cybersecurity',
    'data-and-data-governance',
    'ethics-and-human-rights',
    'privacy-and-data-protection',
    'safety-and-environmental-impact',
    'transparency-and-accessibility',
  ]),
});

const customCategorySchema = z.object({
  methodology: z.literal('custom'),
  methodologyName: z.string().min(1),
  category: z.string().min(1),
});

const categorySchema = z.discriminatedUnion('methodology', [
  strideCategorySchema,
  linddunCategorySchema,
  ciaCategorySchema,
  ciaDieCategorySchema,
  plot4aiCategorySchema,
  customCategorySchema,
]);

const severitySchema = z.enum([
  'low',
  'medium',
  'high',
  'critical',
  'undecided',
]);

const threatStatusSchema = z.enum([
  'open',
  'mitigated',
  'transferred',
  'avoided',
  'accepted-risk',
  'eliminated',
  'not-applicable',
]);

const mitigationStatusSchema = z.enum(['proposed', 'implemented', 'verified']);

const assumptionStatusSchema = z.enum(['valid', 'invalidated']);

const threatSchema = z.object({
  id: idSchema,
  number: z.int().positive(),
  title: z.string(),
  category: categorySchema,
  severity: severitySchema,
  status: threatStatusSchema,
  description: z.string(),
  mitigation: z.string(),
  elements: z.array(idSchema),
});

const mitigationSchema = z.object({
  id: idSchema,
  title: z.string(),
  prose: z.string(),
  status: mitigationStatusSchema,
  threats: z.array(idSchema),
});

const assumptionSchema = z.object({
  id: idSchema,
  prose: z.string(),
  status: assumptionStatusSchema,
  elements: z.array(idSchema),
  threats: z.array(idSchema),
});

const diagramSchema = z.object({
  id: idSchema,
  title: z.string(),
  elements: z.array(elementSchema),
});

const metadataSchema = z.object({
  title: z.string(),
  owner: z.string(),
  description: z.string(),
  contributors: z.array(z.string()),
});

/**
 * A Panoptes YAML file, whole, and the whole of what this package declares.
 *
 * The format is a contract with files people already have, so this schema is
 * the only authority on it. It states its own ids, its own vocabularies and
 * its own record shapes, and imports nothing but zod. Where a name here
 * matches one in the internal model, the two are the same today and are free
 * to stop being: a model changed for the sake of the editor must not change
 * what version 1 means, and only the mapping in `@panoptes/formats` knows
 * both sides.
 *
 * Nothing is optional, nothing is defaulted, and nothing is transformed. An
 * id is any non-empty string, unbranded: the model brands its ids at its own
 * parse boundary, and a file is not a model.
 *
 * `formatVersion` is a literal rather than a bounded number, so a file
 * stamped with any other release fails at that path rather than reaching the
 * mapping. It is also what tells a Panoptes file apart from a JSON format
 * without consulting the extension.
 *
 * A key this schema does not declare is dropped and reported by the codec as
 * an `undeclared` divergence rather than refused, so a file written by a
 * later release of version 1 still reads, minus what this release has no
 * home for.
 *
 * The root keys are declared in three tiers, and a write follows this order:
 * the header (`formatVersion`, then `metadata`), the content in alphabetical
 * order, and the bookkeeping the editor keeps for itself. A key added to the
 * format later has an obvious place rather than an argued one.
 */
export const panoptesYamlWireSchema = z.object({
  formatVersion: z.literal(1),
  metadata: metadataSchema,
  assumptions: z.array(assumptionSchema),
  diagrams: z.array(diagramSchema),
  mitigations: z.array(mitigationSchema),
  threats: z.array(threatSchema),
  lastIssuedThreatNumber: z.int().nonnegative(),
});

/** A whole Panoptes YAML document. */
export type PanoptesYamlDocument = z.infer<typeof panoptesYamlWireSchema>;

/** What a Panoptes YAML file says about the model as a whole. */
export type PanoptesYamlMetadata = z.infer<typeof metadataSchema>;

/** One diagram of a Panoptes YAML document. */
export type PanoptesYamlDiagram = z.infer<typeof diagramSchema>;

/** One element of a Panoptes YAML diagram. */
export type PanoptesYamlElement = z.infer<typeof elementSchema>;

/** Where a Panoptes YAML flow starts or ends. */
export type PanoptesYamlEndpoint = z.infer<typeof endpointSchema>;

/** The geometry of a Panoptes YAML trust boundary. */
export type PanoptesYamlBoundaryShape = z.infer<typeof boundaryShapeSchema>;

/** One threat of a Panoptes YAML document. */
export type PanoptesYamlThreat = z.infer<typeof threatSchema>;

/** One mitigation of a Panoptes YAML document. */
export type PanoptesYamlMitigation = z.infer<typeof mitigationSchema>;

/** One assumption of a Panoptes YAML document. */
export type PanoptesYamlAssumption = z.infer<typeof assumptionSchema>;

/** How bad a Panoptes YAML threat is if realized. */
export type PanoptesYamlSeverity = z.infer<typeof severitySchema>;

/** Where a Panoptes YAML threat stands. */
export type PanoptesYamlThreatStatus = z.infer<typeof threatStatusSchema>;

/** How far a Panoptes YAML mitigation has got. */
export type PanoptesYamlMitigationStatus = z.infer<
  typeof mitigationStatusSchema
>;

/** Whether a Panoptes YAML assumption still holds. */
export type PanoptesYamlAssumptionStatus = z.infer<
  typeof assumptionStatusSchema
>;

/** The category of a Panoptes YAML threat, by methodology. */
export type PanoptesYamlCategory = z.infer<typeof categorySchema>;

/** A STRIDE category as a Panoptes YAML file states it. */
export type PanoptesYamlStrideCategory = z.infer<typeof strideCategorySchema>;

/** A LINDDUN category as a Panoptes YAML file states it. */
export type PanoptesYamlLinddunCategory = z.infer<typeof linddunCategorySchema>;

/** A CIA category as a Panoptes YAML file states it. */
export type PanoptesYamlCiaCategory = z.infer<typeof ciaCategorySchema>;

/** A CIA-DIE category as a Panoptes YAML file states it. */
export type PanoptesYamlCiaDieCategory = z.infer<typeof ciaDieCategorySchema>;

/** A PLOT4ai category as a Panoptes YAML file states it. */
export type PanoptesYamlPlot4aiCategory = z.infer<typeof plot4aiCategorySchema>;

/** A category from a methodology the format does not enumerate. */
export type PanoptesYamlCustomCategory = z.infer<typeof customCategorySchema>;
