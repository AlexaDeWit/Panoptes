import {
  assumptionSchema,
  elementSchema,
  mitigationSchema,
  threatSchema,
  type ParseIssue,
} from '@saerskriven/model';
import type { z } from 'zod';
import type { Divergence } from './divergence.js';
import { importBudget } from './import-budget.js';
import { isRecord } from './records.js';

/** Unbranded model inputs cross through parseModel after conversion. */
export type ImportElement = z.input<typeof elementSchema>;
/** A threat assembled from a foreign definition or occurrence. */
export type ImportThreat = z.input<typeof threatSchema>;
/** A mitigation assembled from a foreign definition or occurrence. */
export type ImportMitigation = z.input<typeof mitigationSchema>;
/** An assumption expressible by the current model. */
export type ImportAssumption = z.input<typeof assumptionSchema>;

/** A deterministic layout for records with no drawable position. */
export function importPosition(index: number) {
  return { x: 60 + (index % 4) * 260, y: 60 + Math.floor(index / 4) * 160 };
}

/** Common fields for imported elements, with scoping left undecided by the source. */
export function importElement(
  context: ImportContext,
  id: string,
  name: string,
  description = '',
) {
  return {
    id,
    name: context.text([name]),
    description: context.text([description]),
    outOfScope: false,
    reasonOutOfScope: '',
  };
}

/** Tracks mapped fields so every remaining wire field appears in the import report. */
export function importContext() {
  const budget = importBudget();
  const used = new WeakMap<object, Set<string>>();
  const divergences: Divergence[] = [];
  const issues: ParseIssue[] = [];
  const report = (
    detail: string,
    reason: Divergence['reason'] = 'narrowed',
  ): void => {
    if (budget.failure !== undefined) return;
    divergences.push({ subject: { kind: 'model' }, detail, reason });
  };
  const problem = (
    path: readonly (string | number)[],
    message: string,
  ): void => {
    issues.push({ path: [...path], message, code: 'custom' });
  };
  return {
    text: budget.text,
    reserve: budget.reserve,
    id: budget.id,
    get failure() {
      return budget.failure;
    },
    divergences,
    issues,
    report,
    problem,
    fields: <T extends object>(
      value: T,
      keys: readonly (keyof T & string)[],
    ): T => {
      const selected = used.get(value) ?? new Set<string>();
      for (const key of keys) selected.add(key);
      used.set(value, selected);
      return value;
    },
    index: <T>(
      values: readonly T[],
      key: (value: T) => string,
      path: string,
    ): Map<string, T> => {
      const result = new Map<string, T>();
      for (const [position, value] of values.entries()) {
        const id = key(value);
        if (result.has(id))
          problem(
            [path, position],
            `Duplicate identifier ${JSON.stringify(id)}`,
          );
        result.set(id, value);
      }
      return result;
    },
    omitted: (source: object): void => {
      const pending: { value: unknown; path: readonly string[] }[] = [
        { value: source, path: [] },
      ];
      const visited = new WeakSet();
      while (pending.length > 0) {
        const entry = pending.pop();
        if (
          entry === undefined ||
          typeof entry.value !== 'object' ||
          entry.value === null ||
          visited.has(entry.value)
        )
          continue;
        visited.add(entry.value);
        if (Array.isArray(entry.value)) {
          entry.value.forEach((value: unknown, index) =>
            pending.push({ value, path: [...entry.path, String(index)] }),
          );
        } else if (isRecord(entry.value)) {
          const selected = used.get(entry.value);
          for (const [key, value] of Object.entries(entry.value)) {
            const path = [...entry.path, key];
            if (selected?.has(key)) pending.push({ value, path });
            else
              report(
                `The source field ${JSON.stringify(path)} is not retained by import.`,
                'unrepresentable',
              );
          }
        }
      }
    },
  };
}

/** The report and reference checks shared by the two import mappings. */
export type ImportContext = ReturnType<typeof importContext>;
