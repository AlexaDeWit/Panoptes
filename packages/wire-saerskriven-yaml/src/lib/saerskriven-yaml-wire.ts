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
 * A Saerskriven YAML file, whole, and the whole of what this package declares.
 *
 * The format is a contract with files people already have, so this schema is
 * the only authority on it. It states its own ids, its own vocabularies and
 * its own record shapes, and imports nothing but zod. Where a name here
 * matches one in the internal model, the two are the same today and are free
 * to stop being: a model changed for the sake of the editor must not change
 * what version 1 means, and only the mapping in `@saerskriven/formats` knows
 * both sides.
 *
 * Nothing is optional, nothing is defaulted, and nothing is transformed. An
 * id is any non-empty string, unbranded: the model brands its ids at its own
 * parse boundary, and a file is not a model.
 *
 * `formatVersion` is a literal rather than a bounded number, so a file
 * stamped with any other release fails at that path rather than reaching the
 * mapping. It is also what tells a Saerskriven file apart from a JSON format
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
export const saerskrivenYamlWireSchema = z.object({
  formatVersion: z.literal(1),
  metadata: metadataSchema,
  assumptions: z.array(assumptionSchema),
  diagrams: z.array(diagramSchema),
  mitigations: z.array(mitigationSchema),
  threats: z.array(threatSchema),
  lastIssuedThreatNumber: z.int().nonnegative(),
});

/** A whole Saerskriven YAML document. */
export type SaerskrivenYamlDocument = z.infer<typeof saerskrivenYamlWireSchema>;

/** What a Saerskriven YAML file says about the model as a whole. */
export type SaerskrivenYamlMetadata = z.infer<typeof metadataSchema>;

/** One diagram of a Saerskriven YAML document. */
export type SaerskrivenYamlDiagram = z.infer<typeof diagramSchema>;

/** One element of a Saerskriven YAML diagram. */
export type SaerskrivenYamlElement = z.infer<typeof elementSchema>;

/** Where a Saerskriven YAML flow starts or ends. */
export type SaerskrivenYamlEndpoint = z.infer<typeof endpointSchema>;

/** The geometry of a Saerskriven YAML trust boundary. */
export type SaerskrivenYamlBoundaryShape = z.infer<typeof boundaryShapeSchema>;

/** One threat of a Saerskriven YAML document. */
export type SaerskrivenYamlThreat = z.infer<typeof threatSchema>;

/** One mitigation of a Saerskriven YAML document. */
export type SaerskrivenYamlMitigation = z.infer<typeof mitigationSchema>;

/** One assumption of a Saerskriven YAML document. */
export type SaerskrivenYamlAssumption = z.infer<typeof assumptionSchema>;

/** How bad a Saerskriven YAML threat is if realized. */
export type SaerskrivenYamlSeverity = z.infer<typeof severitySchema>;

/** Where a Saerskriven YAML threat stands. */
export type SaerskrivenYamlThreatStatus = z.infer<typeof threatStatusSchema>;

/** How far a Saerskriven YAML mitigation has got. */
export type SaerskrivenYamlMitigationStatus = z.infer<
  typeof mitigationStatusSchema
>;

/** Whether a Saerskriven YAML assumption still holds. */
export type SaerskrivenYamlAssumptionStatus = z.infer<
  typeof assumptionStatusSchema
>;

/** The category of a Saerskriven YAML threat, by methodology. */
export type SaerskrivenYamlCategory = z.infer<typeof categorySchema>;

/** A STRIDE category as a Saerskriven YAML file states it. */
export type SaerskrivenYamlStrideCategory = z.infer<
  typeof strideCategorySchema
>;

/** A LINDDUN category as a Saerskriven YAML file states it. */
export type SaerskrivenYamlLinddunCategory = z.infer<
  typeof linddunCategorySchema
>;

/** A CIA category as a Saerskriven YAML file states it. */
export type SaerskrivenYamlCiaCategory = z.infer<typeof ciaCategorySchema>;

/** A CIA-DIE category as a Saerskriven YAML file states it. */
export type SaerskrivenYamlCiaDieCategory = z.infer<
  typeof ciaDieCategorySchema
>;

/** A PLOT4ai category as a Saerskriven YAML file states it. */
export type SaerskrivenYamlPlot4aiCategory = z.infer<
  typeof plot4aiCategorySchema
>;

/** A category from a methodology the format does not enumerate. */
export type SaerskrivenYamlCustomCategory = z.infer<
  typeof customCategorySchema
>;
