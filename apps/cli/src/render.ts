import type { Diagram, Model } from '@panoptes/model';
import {
  renderRegister,
  renderSvg,
  renderTypst,
  type SvgDocument,
} from '@panoptes/render';
import { Either } from 'effect';
import { z } from 'zod';
import { writeFile } from './files.js';
import { readModel } from './input.js';
import {
  escaped,
  lines,
  succeeded,
  usageError,
  type CommandOutcome,
  type CommandOutput,
} from './outcome.js';
import { compilePdf, typstAssets } from './pdf.js';

type UnplacedFlow = SvgDocument['unplaced'][number];

/**
 * What `render` needs, and the one gate on the option bag the parser hands
 * over. Commander tokenizes argv and says nothing about what a command
 * requires, so the requirement is stated once, here, and its messages are
 * what a user reads.
 */
export const renderOptionsSchema = z.object({
  format: z.enum(['svg', 'md', 'pdf'], { error: 'must be svg, md or pdf' }),
  out: z.string({ error: 'must be a path, or - for standard output' }),
  diagram: z.string().optional(),
});

/** The options a render was asked for. */
export type RenderOptions = z.infer<typeof renderOptionsSchema>;

type WholeModelFormat = Exclude<RenderOptions['format'], 'svg'>;

const wholeModelFormats = {
  md: 'writes the whole register',
  pdf: 'writes every diagram and the register',
} satisfies Record<WholeModelFormat, string>;

/**
 * `panoptes render <file> --format svg|md|pdf --out <path>`: a projection of
 * the model the file holds, written to that path, or to standard output
 * where the path is `-`. `md` writes the whole threat register and `pdf`
 * writes every diagram followed by that register, so neither takes
 * `--diagram`. `svg` draws one diagram, which `--diagram` names by id or by
 * title, and which a model holding exactly one diagram does not have to name.
 *
 * Only the PDF is asynchronous, because the Typst compiler is a WebAssembly
 * module that is built before it compiles anything. `assets` is where that
 * compiler and its fonts are read from, which for a running CLI is always
 * where the build put them.
 */
export function render(
  file: string,
  options: RenderOptions,
  assets: string = typstAssets,
): Promise<CommandOutcome> {
  return Either.match(readModel(file), {
    onLeft: (outcome) => Promise.resolve(outcome),
    onRight: (read) => projection(read.model, options, assets),
  });
}

function projection(
  model: Model,
  options: RenderOptions,
  assets: string,
): Promise<CommandOutcome> {
  return options.format === 'svg'
    ? Promise.resolve(drawing(model, options))
    : wholeModel(model, options.format, options, assets);
}

function wholeModel(
  model: Model,
  format: WholeModelFormat,
  options: RenderOptions,
  assets: string,
): Promise<CommandOutcome> {
  return options.diagram === undefined
    ? document(model, format, options.out, assets)
    : Promise.resolve(usageError(lines(refusedDiagram(format))));
}

function refusedDiagram(format: WholeModelFormat): string {
  return `error: --diagram chooses one diagram, and --format ${format} ${wholeModelFormats[format]}.`;
}

function document(
  model: Model,
  format: WholeModelFormat,
  out: string,
  assets: string,
): Promise<CommandOutcome> {
  return format === 'md'
    ? Promise.resolve(written(out, renderRegister(model), ''))
    : compiled(model, out, assets);
}

async function compiled(
  model: Model,
  out: string,
  assets: string,
): Promise<CommandOutcome> {
  const source = renderTypst(model);
  return Either.match(await compilePdf(source.typst, assets), {
    onLeft: (reason) => usageError(lines(`error: ${reason}`)),
    onRight: (pdf) => written(out, pdf, unplacedWarning(source.unplaced)),
  });
}

function drawing(model: Model, options: RenderOptions): CommandOutcome {
  return Either.match(chosenDiagram(model, options.diagram), {
    onLeft: (reason) => usageError(reason),
    onRight: (diagram) => drawn(diagram, model, options.out),
  });
}

function drawn(diagram: Diagram, model: Model, out: string): CommandOutcome {
  const drawnDiagram = renderSvg(diagram, model);
  return written(out, drawnDiagram.svg, unplacedWarning(drawnDiagram.unplaced));
}

function written(
  out: string,
  content: CommandOutput,
  warning: string,
): CommandOutcome {
  return out === '-'
    ? succeeded(content, warning)
    : Either.match(writeFile(out, content), {
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
