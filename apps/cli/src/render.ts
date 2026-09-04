import type { Diagram, Model } from '@panoptes/model';
import { renderRegister, renderSvg, type SvgDocument } from '@panoptes/render';
import { Either } from 'effect';
import { z } from 'zod';
import { writeTextFile } from './files.js';
import { readModel } from './input.js';
import {
  escaped,
  lines,
  succeeded,
  usageError,
  type CommandOutcome,
} from './outcome.js';

type UnplacedFlow = SvgDocument['unplaced'][number];

/**
 * What `render` needs, and the one gate on the option bag the parser hands
 * over. Commander tokenizes argv and says nothing about what a command
 * requires, so the requirement is stated once, here, and its messages are
 * what a user reads.
 */
export const renderOptionsSchema = z.object({
  format: z.enum(['svg', 'md'], { error: 'must be svg or md' }),
  out: z.string({ error: 'must be a path, or - for standard output' }),
  diagram: z.string().optional(),
});

/** The options a render was asked for. */
export type RenderOptions = z.infer<typeof renderOptionsSchema>;

/**
 * `panoptes render <file> --format svg|md --out <path>`: a projection of
 * the model the file holds, written to that path, or to standard output
 * where the path is `-`. `md` writes the whole threat register. `svg` draws
 * one diagram, which `--diagram` names by id or by title, and which a model
 * holding exactly one diagram does not have to name.
 */
export function render(file: string, options: RenderOptions): CommandOutcome {
  return Either.match(readModel(file), {
    onLeft: (outcome) => outcome,
    onRight: (read) => projection(read.model, options),
  });
}

function projection(model: Model, options: RenderOptions): CommandOutcome {
  return options.format === 'md'
    ? register(model, options)
    : drawing(model, options);
}

function register(model: Model, options: RenderOptions): CommandOutcome {
  return options.diagram === undefined
    ? written(options.out, renderRegister(model), '')
    : usageError(
        lines(
          'error: --diagram chooses one diagram, and --format md writes the whole register.',
        ),
      );
}

function drawing(model: Model, options: RenderOptions): CommandOutcome {
  return Either.match(chosenDiagram(model, options.diagram), {
    onLeft: (reason) => usageError(reason),
    onRight: (diagram) => drawn(diagram, model, options.out),
  });
}

function drawn(diagram: Diagram, model: Model, out: string): CommandOutcome {
  const document = renderSvg(diagram, model);
  return written(out, document.svg, unplacedWarning(document.unplaced));
}

function written(out: string, text: string, warning: string): CommandOutcome {
  return out === '-'
    ? succeeded(text, warning)
    : Either.match(writeTextFile(out, text), {
        onLeft: (reason) => usageError(lines(`error: ${reason}`)),
        onRight: () => succeeded('', warning),
      });
}

function unplacedWarning(unplaced: readonly UnplacedFlow[]): string {
  return unplaced.length > 0
    ? lines(
        'warning: a flow endpoint names an element the canvas draws as no box, so its flow is not in the drawing.',
        ...unplaced.map(
          (endpoint) =>
            `  flow ${quoted(endpoint.flow)} ${endpoint.side} names ${quoted(endpoint.element)}`,
        ),
      )
    : '';
}

function chosenDiagram(
  model: Model,
  name: string | undefined,
): Either.Either<Diagram, string> {
  return name === undefined
    ? theOnlyDiagram(model)
    : theNamedDiagram(model, name);
}

function theOnlyDiagram(model: Model): Either.Either<Diagram, string> {
  const [only] = model.diagrams;
  return model.diagrams.length === 1
    ? Either.right(only)
    : Either.left(noSingleDiagram(model));
}

function noSingleDiagram(model: Model): string {
  return model.diagrams.length === 0
    ? lines('error: the model holds no diagram, so there is nothing to draw.')
    : lines(
        'error: --diagram chooses which diagram to draw, and the model holds several:',
        ...diagramList(model),
      );
}

function theNamedDiagram(
  model: Model,
  name: string,
): Either.Either<Diagram, string> {
  const found = model.diagrams.find(
    (diagram) => diagram.id === name || diagram.title === name,
  );
  return found === undefined
    ? Either.left(
        lines(
          `error: the model holds no diagram named ${quoted(name)}.`,
          ...diagramList(model),
        ),
      )
    : Either.right(found);
}

function diagramList(model: Model): readonly string[] {
  return model.diagrams.map((diagram) =>
    escaped(`  ${diagram.id}: ${collapsed(diagram.title)}`),
  );
}

function collapsed(text: string): string {
  return text.replace(/\s+/gu, ' ');
}

function quoted(text: string): string {
  return JSON.stringify(text);
}
