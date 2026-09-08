import { z } from 'zod';

const namedSchema = z.object({
  name: z.string(),
  id: z.string(),
  description: z.union([z.string(), z.null()]).optional(),
});

const sizeSchema = z.union([
  z.object({
    width: z.number(),
    height: z.number(),
  }),
  z.null(),
]);

const parentSchema = z
  .object({
    trustZone: z.string().optional(),
    component: z.string().optional(),
  })
  .refine(
    (value) =>
      (value.trustZone === undefined) !== (value.component === undefined),
    { message: 'A parent names exactly one trust zone or component' },
  );

const positionSchema = z.union([
  z.object({
    x: z.number(),
    y: z.number(),
  }),
  z.null(),
]);

const representationElementSchema = z.object({
  representation: z.string(),
  name: z.union([z.string(), z.null()]).optional(),
  id: z.string(),
  position: positionSchema.optional(),
  size: sizeSchema.optional(),
  file: z.union([z.string(), z.null()]).optional(),
  line: z.union([z.number(), z.null()]).optional(),
  codeSnippet: z.union([z.string(), z.null()]).optional(),
  attributes: z.union([z.record(z.string(), z.unknown()), z.null()]).optional(),
});

const assetInstanceSchema = z.union([
  z.object({
    processed: z
      .union([z.array(z.union([z.string(), z.null()])), z.null()])
      .optional(),
    stored: z
      .union([z.array(z.union([z.string(), z.null()])), z.null()])
      .optional(),
  }),
  z.null(),
]);

const threatSchema = z.object({
  threat: z.string(),
  state: z.string(),
  mitigations: z
    .array(
      z.union([
        z.object({
          mitigation: z.union([z.string(), z.null()]),
          state: z.union([z.string(), z.null()]),
        }),
        z.null(),
      ]),
    )
    .optional(),
});

/** The complete OTM 0.2.0 wire document. */
export const otmWireSchema = z.object({
  otmVersion: z.literal('0.2.0'),
  project: namedSchema.extend({
    owner: z.union([z.string(), z.null()]).optional(),
    ownerContact: z.union([z.string(), z.null()]).optional(),
    tags: z.union([z.array(z.string()), z.null()]).optional(),
    attributes: z
      .union([z.record(z.string(), z.unknown()), z.null()])
      .optional(),
  }),
  representations: z
    .union([
      z.array(
        namedSchema.extend({
          type: z.string(),
          size: sizeSchema.optional(),
          repository: z
            .union([
              z.object({
                url: z.union([z.string(), z.null()]),
              }),
              z.null(),
            ])
            .optional(),
          attributes: z
            .union([z.record(z.string(), z.unknown()), z.null()])
            .optional(),
        }),
      ),
      z.null(),
    ])
    .optional(),
  assets: z
    .union([
      z.array(
        namedSchema.extend({
          risk: z.object({
            confidentiality: z.number(),
            integrity: z.number(),
            availability: z.number(),
            comment: z.union([z.string(), z.null()]).optional(),
          }),
          attributes: z
            .union([z.record(z.string(), z.unknown()), z.null()])
            .optional(),
        }),
      ),
      z.null(),
    ])
    .optional(),
  trustZones: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string().optional(),
        description: z.union([z.string(), z.null()]).optional(),
        risk: z.object({
          trustRating: z.number(),
        }),
        parent: parentSchema.optional(),
        representations: z
          .union([z.array(representationElementSchema), z.null()])
          .optional(),
        attributes: z
          .union([z.record(z.string(), z.unknown()), z.null()])
          .optional(),
      }),
    )
    .optional(),
  components: z
    .union([
      z.array(
        namedSchema.extend({
          type: z.string(),
          parent: parentSchema,
          representations: z
            .union([z.array(representationElementSchema), z.null()])
            .optional(),
          assets: assetInstanceSchema.optional(),
          threats: z.union([z.array(threatSchema), z.null()]).optional(),
          tags: z
            .union([z.array(z.union([z.string(), z.null()])), z.null()])
            .optional(),
          attributes: z
            .union([z.record(z.string(), z.unknown()), z.null()])
            .optional(),
        }),
      ),
      z.null(),
    ])
    .optional(),
  dataflows: z
    .array(
      namedSchema.extend({
        bidirectional: z.union([z.boolean(), z.null()]).optional(),
        source: z.string(),
        destination: z.string(),
        assets: z
          .union([z.array(z.union([z.string(), z.null()])), z.null()])
          .optional(),
        threats: z.union([z.array(threatSchema), z.null()]).optional(),
        tags: z
          .union([z.array(z.union([z.string(), z.null()])), z.null()])
          .optional(),
        attributes: z
          .union([z.record(z.string(), z.unknown()), z.null()])
          .optional(),
      }),
    )
    .optional(),
  threats: z
    .union([
      z.array(
        namedSchema.extend({
          categories: z
            .union([z.array(z.union([z.string(), z.null()])), z.null()])
            .optional(),
          cwes: z
            .union([z.array(z.union([z.string(), z.null()])), z.null()])
            .optional(),
          risk: z.object({
            likelihood: z.union([z.number(), z.null()]),
            likelihoodComment: z.union([z.string(), z.null()]).optional(),
            impact: z.number(),
            impactComment: z.string().optional(),
          }),
          tags: z
            .union([z.array(z.union([z.string(), z.null()])), z.null()])
            .optional(),
          attributes: z
            .union([z.record(z.string(), z.unknown()), z.null()])
            .optional(),
        }),
      ),
      z.null(),
    ])
    .optional(),
  mitigations: z
    .union([
      z.array(
        namedSchema.extend({
          riskReduction: z.number(),
          attributes: z
            .union([z.record(z.string(), z.unknown()), z.null()])
            .optional(),
        }),
      ),
      z.null(),
    ])
    .optional(),
});

/** An OTM document before conversion to the core model. */
export type OtmDocument = z.infer<typeof otmWireSchema>;
