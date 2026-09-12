import {
  elementsWithoutThreats,
  openThreatsBySeverity,
  severitySchema,
  threatCountByElement,
  type Model,
  type Severity,
} from '@saerskriven/model';
import { Either } from 'effect';
import { z } from 'zod';
import {
  elementRow,
  elementRowSchema,
  elementsOnDiagrams,
  renderElement,
  type ElementOnDiagram,
} from './element-rows.js';
import { fileArgumentSchema } from './inspect.js';
import {
  readNamed,
  readingSchema,
  renderReading,
  reportedReading,
  type ModelReading,
} from './reading.js';
import type { ModelWorkspace } from './workspace.js';

/** What `saer_coverage` takes. */
export type CoverageArguments = z.infer<typeof fileArgumentSchema>;

const openSeveritySchema = z.object({
  severity: severitySchema,
  count: z.int().nonnegative(),
  threats: z.array(z.int().positive()),
});

/** What `saer_coverage` answers with. */
export const coverageResultSchema = readingSchema.extend({
  unanalyzed: z.array(elementRowSchema),
  open: z.array(openSeveritySchema),
  perElement: z.array(elementRowSchema),
});

/** What `saer_coverage` answers with. */
export type CoverageResult = z.infer<typeof coverageResultSchema>;

/** What `saer_coverage` tells a client it is for. */
export const coverageDescription = [
  'Report what one Saerskriven threat model has analyzed and what it has not: the elements no threat references, the open threats grouped by severity, and the number of threats recorded against every element of every diagram.',
  'Call this to decide where to work next, and to answer whether a model is analyzed at all. Use saer_search_elements where you want to look up particular elements, and saer_search_threats where you want the threats themselves rather than the counts.',
  'Pass `file` as a path relative to the server root, or leave it out where the server was started with a default model. This tool takes no other argument and reports on the whole model.',
  'The unanalyzed list means no threat references the element. It may still hold security properties or assumptions. The count does not say that no data is recorded or that an element is safe. Scope is reported separately. Counts cover recorded threats, and the open groups count only outstanding threats. This tool never writes.',
].join(' ');

/** Reports threat coverage using the model's queries, independently of recorded security properties. */
export function coverage(
  workspace: ModelWorkspace,
  args: CoverageArguments,
): Either.Either<CoverageResult, readonly string[]> {
  return Either.map(readNamed(workspace, args.file), reported);
}

/** The coverage as the lines its text result carries. */
export function renderCoverage(result: CoverageResult): readonly string[] {
  return [
    ...renderReading(result),
    `elements with no threat recorded: ${String(result.unanalyzed.length)}`,
    ...result.unanalyzed.flatMap(renderElement),
    'open threats by severity:',
    ...result.open.map(
      (group) =>
        `  ${group.severity} ${String(group.count)}${group.threats.length === 0 ? '' : `: ${group.threats.map(String).join(', ')}`}`,
    ),
    'threats recorded per element:',
    ...result.perElement.flatMap(renderElement),
  ];
}

function reported(reading: ModelReading): CoverageResult {
  const { model } = reading;
  const counts = threatCountByElement(model);
  const placed = elementsOnDiagrams(model.diagrams);
  const unanalyzed = new Set<string>(
    elementsWithoutThreats(model).map((element) => element.id),
  );
  const rowOf = (one: ElementOnDiagram) =>
    elementRow(one, counts.get(one.element.id) ?? 0);
  return {
    ...reportedReading(reading),
    unanalyzed: placed
      .filter((one) => unanalyzed.has(one.element.id))
      .map(rowOf),
    open: openGroups(model),
    perElement: placed.map(rowOf),
  };
}

function openGroups(model: Model): z.infer<typeof openSeveritySchema>[] {
  const grouped = openThreatsBySeverity(model);
  return severitySchema.options.map((severity: Severity) => ({
    severity,
    count: grouped[severity].length,
    threats: grouped[severity].map((threat) => threat.number),
  }));
}
