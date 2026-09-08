import { z } from 'zod';

const versionSchema = z.string().regex(new RegExp('^\\d+(\\.\\d+)*$'));

const degreeSchema = z.enum(['minimal', 'low', 'moderate', 'high', 'maximal']);

const businessCriticalitySchema = degreeSchema;

const dataSensitivitySchema = z.enum([
  'pii',
  'phi',
  'fin',
  'ip',
  'cred',
  'biz',
  'gov',
  'pci',
  'op',
]);

const exposureSchema = z.enum(['internal', 'external']);

const tierSchema = z.enum([
  'mission_critical',
  'business_critical',
  'important',
  'non_critical',
]);

const scopeSchema = z.object({
  title: z.string(),
  description: z.string(),
  business_criticality: businessCriticalitySchema,
  data_sensitivity: z.array(dataSensitivitySchema),
  exposure: exposureSchema,
  tier: tierSchema,
});

const dateOrDatetimeSchema = z.union([
  z.iso.date(),
  z.iso.datetime({ offset: true }),
]);

const diagramSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  link: z.string().url().optional(),
  type: z.enum(['graphviz', 'mermaid', 'plantuml', 'svg']),
  source: z.string(),
});

const symbolicNameSchema = z.string().regex(new RegExp('^[0-9a-z-]+$'));

const namedSchema = z.object({
  symbolic_name: symbolicNameSchema,
  title: z.string(),
  description: z.string(),
});

const trustZoneSchema = namedSchema;

const accessControlMethodSchema = z.enum([
  'none',
  'acl',
  'rbac',
  'mac',
  'dac',
  'abac',
]);

const authenticationMethodSchema = z.enum([
  'none',
  'password',
  'otp',
  'challenge_response',
  'public_key',
  'token',
  'biometrics',
  'sso',
  'social',
]);

const trustBoundarySchema = z.object({
  trust_zone_a: symbolicNameSchema,
  trust_zone_b: symbolicNameSchema,
  access_control_methods: z.array(accessControlMethodSchema).optional(),
  authentication_methods: z.array(authenticationMethodSchema).optional(),
  access_token_expires: z.boolean().optional(),
  access_token_ttl: z.int().optional(),
  has_refresh_token: z.boolean().optional(),
  refresh_token_expires: z.boolean().optional(),
  refresh_token_ttl: z.int().optional(),
  can_user_logout: z.boolean().optional(),
  can_system_logout: z.boolean().optional(),
});

const actorSchema = namedSchema.extend({
  type: z.enum([
    'system',
    'user',
    'power_user',
    'administrator',
    'engineer',
    'third_party',
  ]),
  permissions: z.string().optional(),
});

const componentSchema = namedSchema.extend({
  parent_component: symbolicNameSchema.optional(),
  trust_zone: symbolicNameSchema,
  repo_link: z.string().url().optional(),
});

const dataStoreTypeSchema = z.enum([
  'sql',
  'key_value',
  'document',
  'object',
  'graph',
  'time_series',
]);

const dataStoreSchema = namedSchema.extend({
  type: dataStoreTypeSchema,
  vendor: z.string().optional(),
  product: z.string().optional(),
});

const dataSetSchema = namedSchema.extend({
  placements: z.array(
    z.object({
      data_store: symbolicNameSchema.optional(),
      encrypted: z.boolean().optional(),
    }),
  ),
  data_sensitivity: z.array(dataSensitivitySchema),
  access_control_methods: z.array(accessControlMethodSchema).optional(),
  record_count: z.int().optional(),
});

const typedSymbolicNameSchema = z.object({
  type: z.string(),
  object: symbolicNameSchema,
});

const dataFlowSchema = namedSchema.extend({
  source: typedSymbolicNameSchema,
  destination: typedSymbolicNameSchema,
  has_sensitive_data: z.boolean(),
  encrypted: z.boolean(),
});

const assumptionSchema = z.object({
  description: z.string(),
  topics: z.array(symbolicNameSchema).optional(),
  validity: z.enum(['unconfirmed', 'confirmed', 'rejected']),
});

const attackerSkillAndKnowledgeSchema = z.enum([
  'script_kid',
  'insider',
  'engineer',
  'expert_engineer',
  'oc_sponsored',
  'state_sponsored',
]);

const accessLevelSchema = z.enum(['anonymous', 'user', 'admin']);

const threatPersonaSchema = namedSchema.extend({
  is_person: z.boolean(),
  skill_level: attackerSkillAndKnowledgeSchema,
  access_level: accessLevelSchema,
  malicious_intent: z.boolean(),
  applicability_to_org: degreeSchema,
});

const capecRefSchema = z.object({
  capec_id: z.int(),
  capec_title: z.string().optional(),
});

const cweRefSchema = z.object({
  cwe_id: z.int(),
  cwe_title: z.string().optional(),
});

const threatSchema = namedSchema.extend({
  components_affected: z.array(symbolicNameSchema).optional(),
  threat_persona: symbolicNameSchema,
  event: z.string(),
  sources: z.array(
    z.enum([
      'adversary',
      'human_error',
      'failure',
      'events_beyond_org_control',
    ]),
  ),
  attack_mechanisms: z.array(capecRefSchema).optional(),
  weaknesses: z.array(cweRefSchema).optional(),
});

const trustBoundaryRefSchema = z.object({
  trust_zone_a: symbolicNameSchema,
  trust_zone_b: symbolicNameSchema,
});

const controlStatusSchema = z.enum([
  'assumed',
  'active',
  'suggested',
  'under_review',
  'approved',
  'scheduled',
  'retired',
  'wont_do',
]);

const prioritySchema = z.enum(['none', 'low', 'medium', 'high', 'critical']);

const controlSchema = namedSchema.extend({
  threats: z.array(symbolicNameSchema),
  trust_boundary: trustBoundaryRefSchema.optional(),
  status: controlStatusSchema,
  priority: prioritySchema,
});

const likelihoodSchema = z.enum([
  'rare',
  'unlikely',
  'possible',
  'likely',
  'certain',
]);

const impactSchema = z.enum([
  'negligible',
  'minor',
  'moderate',
  'major',
  'severe',
]);

const riskScoreSchema = z.int().min(0).max(25);

const riskSchema = namedSchema.extend({
  threats: z.array(symbolicNameSchema),
  likelihood: likelihoodSchema,
  impact: impactSchema,
  impact_description: z.string(),
  score: riskScoreSchema,
  level: z.string(),
});

const tmbom101Schema = z.object({
  $schema: z.literal(
    'https://github.com/OWASP/www-project-threat-model-library/blob/v1.0.1/threat-model.schema.json',
  ),
  version: versionSchema,
  scope: scopeSchema,
  description: z.string().optional(),
  frozen: z.boolean().optional(),
  released_at: dateOrDatetimeSchema.optional(),
  product_release_date: dateOrDatetimeSchema.optional(),
  release_docs_link: z.string().url().optional(),
  reviewed_at: dateOrDatetimeSchema.optional(),
  repo_link: z.string().url().optional(),
  diagrams: z.array(diagramSchema).optional(),
  trust_zones: z.array(trustZoneSchema),
  trust_boundaries: z.array(trustBoundarySchema),
  actors: z.array(actorSchema),
  components: z.array(componentSchema),
  data_stores: z.array(dataStoreSchema),
  data_sets: z.array(dataSetSchema),
  data_flows: z.array(dataFlowSchema),
  assumptions: z.array(assumptionSchema).optional(),
  threat_personas: z.array(threatPersonaSchema).optional(),
  threats: z.array(threatSchema).optional(),
  controls: z.array(controlSchema).optional(),
  risks: z.array(riskSchema).optional(),
  extensions: z
    .record(
      z
        .string()
        .regex(
          new RegExp(
            "^([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\\.)+[A-Za-z]+(/[-$%'()*+,.:;=@^_~0-9A-Za-z]+)+$",
          ),
        ),
      z.unknown(),
    )
    .optional(),
});

const tmbom102Schema = tmbom101Schema.extend({
  $schema: z.literal(
    'https://github.com/OWASP/www-project-threat-model-library/blob/v1.0.2/threat-model.schema.json',
  ),
  actors: z.array(actorSchema.extend({ trust_zone: symbolicNameSchema })),
  data_stores: z.array(
    dataStoreSchema.extend({ trust_zone: symbolicNameSchema }),
  ),
  risks: z
    .array(
      riskSchema.extend({
        level: z.enum([
          'very_low',
          'low',
          'medium',
          'high',
          'very_high',
          'critical',
        ]),
      }),
    )
    .optional(),
});

/** Released TM-BOM 1.0.1 and 1.0.2 documents, identified by their schema URI. */
export const tmbomWireSchema = z.discriminatedUnion('$schema', [
  tmbom101Schema,
  tmbom102Schema,
]);

/** A TM-BOM document before conversion to the core model. */
export type TmbomDocument = z.infer<typeof tmbomWireSchema>;
