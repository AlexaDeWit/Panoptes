import { escapedForTerminal, quotedForTerminal } from '@saerskriven/formats';
import {
  assumptionSchema,
  mitigationSchema,
  threatCountByElement,
  threatSchema,
  type Assumption,
  type Mitigation,
  type Model,
  type Threat,
} from '@saerskriven/model';
import { Either } from 'effect';
import { z } from 'zod';
import {
  elementDetail,
  elementDetailSchema,
  elementsOnDiagrams,
  renderElement,
} from './element-rows.js';
import { fileArgumentSchema } from './inspect.js';
import {
  readNamed,
  readingSchema,
  renderReading,
  reportedReading,
  type ModelReading,
} from './reading.js';
import { renderCategory } from './threat-rows.js';
import type { ModelWorkspace } from './workspace.js';

/** What `saer_get_threat` takes. */
export const getThreatArgumentsSchema = fileArgumentSchema.extend({
  ref: z
    .string()
    .describe(
      'Which threat to read: its number as digits, or its id. An id is tried first, so a model whose threat ids are digits is read by id rather than by number.',
    ),
});

/** What `saer_get_threat` takes. */
export type GetThreatArguments = z.infer<typeof getThreatArgumentsSchema>;

/** What `saer_get_threat` answers with. */
export const getThreatResultSchema = readingSchema.extend({
  threat: threatSchema,
  elements: z.array(elementDetailSchema),
  mitigations: z.array(mitigationSchema),
  assumptions: z.array(assumptionSchema),
});

/** What `saer_get_threat` answers with. */
export type GetThreatResult = z.infer<typeof getThreatResultSchema>;

/** What `saer_get_threat` tells a client it is for. */
export const getThreatDescription = [
  'Read one threat of a Saerskriven threat model in full: the whole record, the elements it attaches to, the mitigations addressing it, and the assumptions its analysis rests on.',
  'Use this once you know which threat you mean. Find that threat with saer_search_threats, which takes the filters and carries the numbers, and use saer_register where you want every threat rather than one.',
  'Pass `ref` as the threat number or the threat id. Pass `file` as a path relative to the server root, or leave it out where the server was started with a default model.',
  'A ref naming no threat of the model is refused with the count of threats it holds rather than answered with an empty record. This tool never writes.',
].join(' ');

/**
 * One threat with everything the model links to it, or the lines saying why
 * there is no such threat. The mitigations and assumptions are the ones
 * naming this threat, which is a link the threat record itself does not
 * carry.
 */
export function getThreat(
  workspace: ModelWorkspace,
  args: GetThreatArguments,
): Either.Either<GetThreatResult, readonly string[]> {
  return Either.flatMap(readNamed(workspace, args.file), (reading) =>
    Either.map(threatOf(reading.model, args.ref), (threat) =>
      recorded(reading, threat),
    ),
  );
}

/** The threat as the lines its text result carries. */
export function renderThreatRecord(result: GetThreatResult): readonly string[] {
  const { threat } = result;
  return [
    ...renderReading(result),
    `threat ${String(threat.number)} (${threat.id}): ${escapedForTerminal(threat.title)}`,
    `status: ${threat.status}`,
    `severity: ${threat.severity}`,
    `category: ${renderCategory(threat.category)}`,
    `description: ${escapedForTerminal(threat.description)}`,
    `mitigation: ${escapedForTerminal(threat.mitigation)}`,
    'elements:',
    ...result.elements.flatMap(renderElement),
    'mitigations:',
    ...result.mitigations.map(
      (mitigation) =>
        `  ${mitigation.id} (${mitigation.status}): ${escapedForTerminal(mitigation.title)}`,
    ),
    'assumptions:',
    ...result.assumptions.map(
      (assumption) =>
        `  ${assumption.id} (${assumption.status}): ${escapedForTerminal(assumption.prose)}`,
    ),
  ];
}

function threatOf(
  model: Model,
  ref: string,
): Either.Either<Threat, readonly string[]> {
  const found =
    model.threats.find((threat) => threat.id === ref) ??
    model.threats.find((threat) => String(threat.number) === ref);
  return found === undefined
    ? Either.left([
        `The model holds no threat ${quotedForTerminal(ref)}, by number or by id.`,
        `It holds ${String(model.threats.length)} threats. Call saer_search_threats for their numbers.`,
      ])
    : Either.right(found);
}

function recorded(reading: ModelReading, threat: Threat): GetThreatResult {
  const { model } = reading;
  const attached = new Set<string>(threat.elements);
  const counts = threatCountByElement(model);
  return {
    ...reportedReading(reading),
    threat,
    elements: elementsOnDiagrams(model.diagrams)
      .filter((placed) => attached.has(placed.element.id))
      .map((placed) =>
        elementDetail(placed, counts.get(placed.element.id) ?? 0),
      ),
    mitigations: model.mitigations.filter((mitigation) =>
      addresses(mitigation, threat),
    ),
    assumptions: model.assumptions.filter((assumption) =>
      underpins(assumption, threat),
    ),
  };
}

function addresses(mitigation: Mitigation, threat: Threat): boolean {
  return mitigation.threats.some((linked) => linked === threat.id);
}

function underpins(assumption: Assumption, threat: Threat): boolean {
  return assumption.threats.some((linked) => linked === threat.id);
}
