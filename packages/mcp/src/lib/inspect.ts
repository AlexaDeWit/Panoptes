import {
  divergenceSchema,
  escapedForTerminal,
  formatNameSchema,
  renderDivergences,
} from '@saerskriven/formats';
import {
  acceptedTextSchema,
  diagramIdSchema,
  elementIdsIn,
  modelMetadataSchema,
  type Diagram,
  type Model,
} from '@saerskriven/model';
import { Either } from 'effect';
import { z } from 'zod';
import {
  candidateFiles,
  readModelFile,
  renderWorkspaceFailure,
  withinRoot,
  type ModelWorkspace,
  type ReadModelFile,
} from './workspace.js';

/** What `saer_inspect` tells a client it is for. */
export const inspectDescription = [
  'Read one Saerskriven threat model file and report what it holds: the file format detected from its content, the model metadata, one line per diagram with its element and threat counts, the totals over the whole model, and every place the file and the model do not correspond exactly.',
  'Call this first on a model you have not read in this session. The `revision` it returns is the handle an edit has to quote back, so a tool that writes will ask you for a fresh one.',
  'Pass `file` as a path relative to the server root. Leave it out when the server was started with a default model; with no default and no `file`, the result lists the model files under the root instead of reading one.',
  'This tool never writes. A path that leaves the server root is refused rather than read.',
].join(' ');

/**
 * The `file` argument every tool of this server takes, optional because
 * `--file` can name the model the server works over. Later tools extend this
 * schema rather than restating the field.
 */
export const fileArgumentSchema = z.object({
  file: z
    .string()
    .optional()
    .describe(
      'Path to the model file, relative to the server root. Optional when the server was started with a default file.',
    ),
});

/** What `saer_inspect` takes. */
export type InspectArguments = z.infer<typeof fileArgumentSchema>;

const diagramSummarySchema = z.object({
  id: diagramIdSchema,
  title: acceptedTextSchema,
  elements: z.int().nonnegative(),
  threats: z.int().nonnegative(),
});

const totalsSchema = z.object({
  diagrams: z.int().nonnegative(),
  elements: z.int().nonnegative(),
  threats: z.int().nonnegative(),
  mitigations: z.int().nonnegative(),
  assumptions: z.int().nonnegative(),
});

const inspectedSchema = z.object({
  kind: z.literal('inspected'),
  file: z.string(),
  format: formatNameSchema,
  revision: z.string(),
  metadata: modelMetadataSchema,
  diagrams: z.array(diagramSummarySchema),
  totals: totalsSchema,
  divergences: z.array(divergenceSchema),
});

const candidatesSchema = z.object({
  kind: z.literal('candidates'),
  files: z.array(z.string()),
  truncated: z.boolean(),
});

/**
 * What `saer_inspect` answers with: the root it is confined to, and either
 * the model it read or the candidate files it found when the call named none.
 * The union is nested inside an object so the advertised JSON Schema has an
 * object at its root, which is what the protocol's structured content is
 * projected against.
 */
export const inspectResultSchema = z.object({
  root: z.string(),
  result: z.discriminatedUnion('kind', [inspectedSchema, candidatesSchema]),
});

/** What `saer_inspect` answers with. */
export type InspectResult = z.infer<typeof inspectResultSchema>;

/**
 * What a model file holds, or the candidates to name where the call named no
 * file and the server carries no default. A failure comes back as data for
 * the caller to render as a refused result: nothing here throws.
 */
export function inspect(
  workspace: ModelWorkspace,
  { file }: InspectArguments,
): Either.Either<InspectResult, readonly string[]> {
  const named = file ?? workspace.defaultFile;
  return named === undefined
    ? Either.right({ root: workspace.root, result: candidates(workspace) })
    : Either.mapBoth(readModelFile(workspace, named), {
        onLeft: renderWorkspaceFailure,
        onRight: (read) => ({
          root: workspace.root,
          result: inspected(workspace, read),
        }),
      });
}

/** The inspection as the lines its text result carries. */
export function renderInspection(inspection: InspectResult): readonly string[] {
  return inspection.result.kind === 'candidates'
    ? renderCandidates(inspection.result)
    : renderModel(inspection.result);
}

function candidates(
  workspace: ModelWorkspace,
): z.infer<typeof candidatesSchema> {
  const listing = candidateFiles(workspace);
  return {
    kind: 'candidates',
    files: [...listing.files],
    truncated: listing.truncated,
  };
}

function inspected(
  workspace: ModelWorkspace,
  read: ReadModelFile,
): z.infer<typeof inspectedSchema> {
  const { model } = read.read;
  return {
    kind: 'inspected',
    file: withinRoot(workspace, read.path),
    format: read.read.format,
    revision: read.revision,
    metadata: model.metadata,
    diagrams: model.diagrams.map((diagram) => summaryOf(diagram, model)),
    totals: totalsOf(model),
    divergences: [...read.read.divergences],
  };
}

function summaryOf(
  diagram: Diagram,
  model: Model,
): z.infer<typeof diagramSummarySchema> {
  const ids = elementIdsIn(diagram);
  return {
    id: diagram.id,
    title: diagram.title,
    elements: diagram.elements.length,
    threats: model.threats.filter((threat) =>
      threat.elements.some((element) => ids.has(element)),
    ).length,
  };
}

function totalsOf(model: Model): z.infer<typeof totalsSchema> {
  return {
    diagrams: model.diagrams.length,
    elements: model.diagrams.reduce(
      (total, diagram) => total + diagram.elements.length,
      0,
    ),
    threats: model.threats.length,
    mitigations: model.mitigations.length,
    assumptions: model.assumptions.length,
  };
}

function renderModel(
  reading: z.infer<typeof inspectedSchema>,
): readonly string[] {
  return [
    `file: ${reading.file}`,
    `format: ${reading.format}`,
    `revision: ${reading.revision}`,
    `title: ${escapedForTerminal(reading.metadata.title)}`,
    `owner: ${escapedForTerminal(reading.metadata.owner)}`,
    `totals: ${countList(reading.totals)}`,
    'diagrams:',
    ...reading.diagrams.map(
      (diagram) =>
        `  ${diagram.id}: ${escapedForTerminal(diagram.title)} (elements ${String(diagram.elements)}, threats ${String(diagram.threats)})`,
    ),
    'divergences:',
    renderDivergences(reading.divergences),
  ];
}

function renderCandidates(
  listing: z.infer<typeof candidatesSchema>,
): readonly string[] {
  return [
    'No file was named and this server carries no default, so these are the model files under the root:',
    ...listing.files.map((file) => `  ${escapedForTerminal(file)}`),
    ...(listing.truncated
      ? ['The listing stopped at its limit and is not the whole root.']
      : []),
  ];
}

function countList(totals: z.infer<typeof totalsSchema>): string {
  return Object.entries(totals)
    .map(([noun, count]) => `${noun} ${String(count)}`)
    .join(', ');
}
