import { escapedForTerminal } from '@saerskriven/formats';
import { diagramsNamed, type Diagram, type Model } from '@saerskriven/model';
import {
  renderRegister,
  registerOptionsSchema,
  type RenderTheme,
  renderSvg,
  renderTypst,
  renderUnplacedWarning,
} from '@saerskriven/render';
import { Either } from 'effect';
import { z } from 'zod';
import { runtimeAssets } from './assets.js';
import { writeFile } from './files.js';
import { readModel } from './input.js';
import {
  lines,
  succeeded,
  usageError,
  type CommandOutcome,
  type CommandOutput,
} from './outcome.js';
import { compilePdf } from './pdf.js';
import { drawPng } from './png.js';
import { commandTheme, themeWarnings } from './theme.js';

/** Validated arguments for the render command. */
export const renderOptionsSchema = registerOptionsSchema.extend({
  theme: z.string().optional(),
  styled: z.boolean().optional(),
  stylesheet: z.boolean().optional(),
  headingLevel: z.coerce
    .number()
    .pipe(registerOptionsSchema.shape.headingLevel.unwrap())
    .optional(),
  format: z.enum(['svg', 'png', 'md', 'pdf'], {
    error: 'must be svg, png, md or pdf',
  }),
  out: z.string({ error: 'must be a path, or - for standard output' }),
  diagram: z.string().optional(),
});

/** The options a render was asked for. */
export type RenderOptions = z.infer<typeof renderOptionsSchema>;

type DiagramFormat = 'svg' | 'png';

type WholeModelFormat = Exclude<RenderOptions['format'], DiagramFormat>;

const wholeModelFormats = {
  md: 'writes the whole register',
  pdf: 'writes every diagram and the register',
} satisfies Record<WholeModelFormat, string>;

/** Runs the CLI render command, with the assets beside the built bundle. */
export function render(
  file: string,
  options: RenderOptions,
  assets: string = runtimeAssets,
): Promise<CommandOutcome> {
  return Either.match(readModel(file), {
    onLeft: (outcome) => Promise.resolve(outcome),
    onRight: async (read) => {
      const selected = commandTheme(
        options.theme,
        options.format,
        options.styled === true,
      );
      if (
        options.format === 'md' &&
        options.styled === true &&
        options.stylesheet === false &&
        options.theme !== undefined
      )
        selected.diagnostics.push({
          key: '',
          message:
            'the stylesheet is omitted, so the host CSS controls appearance',
        });
      if (
        options.format !== 'md' &&
        (options.title === false ||
          options.headingLevel !== undefined ||
          options.styled === true ||
          options.stylesheet === false)
      )
        selected.diagnostics.push({
          key: '',
          message: 'Markdown embedding options do not apply to this output',
        });
      const outcome = await projection(
        read.model,
        options,
        assets,
        selected.theme,
      );
      return {
        ...outcome,
        err: themeWarnings(options.theme, selected.diagnostics) + outcome.err,
      };
    },
  });
}

function projection(
  model: Model,
  options: RenderOptions,
  assets: string,
  theme: RenderTheme,
): Promise<CommandOutcome> {
  return options.format === 'svg' || options.format === 'png'
    ? drawing(model, options.format, options, assets, theme)
    : wholeModel(model, options.format, options, assets, theme);
}

function wholeModel(
  model: Model,
  format: WholeModelFormat,
  options: RenderOptions,
  assets: string,
  theme: RenderTheme,
): Promise<CommandOutcome> {
  return options.diagram === undefined
    ? document(model, format, options, assets, theme)
    : Promise.resolve(usageError(lines(refusedDiagram(format))));
}

function refusedDiagram(format: WholeModelFormat): string {
  return `error: --diagram chooses one diagram, and --format ${format} ${wholeModelFormats[format]}.`;
}

function document(
  model: Model,
  format: WholeModelFormat,
  options: RenderOptions,
  assets: string,
  theme: RenderTheme,
): Promise<CommandOutcome> {
  return format === 'md'
    ? Promise.resolve(
        written(
          options.out,
          renderRegister(model, {
            title: options.title,
            headingLevel: options.headingLevel,
            styled: options.styled,
            stylesheet: options.stylesheet,
            theme,
          }),
          '',
        ),
      )
    : compiled(model, options.out, assets, theme);
}

async function compiled(
  model: Model,
  out: string,
  assets: string,
  theme: RenderTheme,
): Promise<CommandOutcome> {
  const source = renderTypst(model, theme);
  return Either.match(await compilePdf(source.typst, assets), {
    onLeft: (reason) => usageError(lines(`error: ${reason}`)),
    onRight: (pdf) => written(out, pdf, renderUnplacedWarning(source.unplaced)),
  });
}

function drawing(
  model: Model,
  format: DiagramFormat,
  options: RenderOptions,
  assets: string,
  theme: RenderTheme,
): Promise<CommandOutcome> {
  return Either.match(chosenDiagram(model, options.diagram), {
    onLeft: (reason) => Promise.resolve(usageError(reason)),
    onRight: (diagram) =>
      drawn(diagram, model, format, options.out, assets, theme),
  });
}

function drawn(
  diagram: Diagram,
  model: Model,
  format: DiagramFormat,
  out: string,
  assets: string,
  theme: RenderTheme,
): Promise<CommandOutcome> {
  return format === 'svg'
    ? Promise.resolve(vector(diagram, model, out, theme))
    : raster(diagram, model, out, assets, theme);
}

function vector(
  diagram: Diagram,
  model: Model,
  out: string,
  theme: RenderTheme,
): CommandOutcome {
  const rendered = renderSvg(diagram, model, theme);
  return written(out, rendered.svg, renderUnplacedWarning(rendered.unplaced));
}

async function raster(
  diagram: Diagram,
  model: Model,
  out: string,
  assets: string,
  theme: RenderTheme,
): Promise<CommandOutcome> {
  return Either.match(await drawPng(diagram, model, assets, theme), {
    onLeft: (reason) => usageError(lines(`error: ${reason}`)),
    onRight: (image) =>
      written(out, image.png, renderUnplacedWarning(image.unplaced)),
  });
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
  const [found] = diagramsNamed(model.diagrams, name);
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
    escapedForTerminal(`  ${diagram.id}: ${collapsed(diagram.title)}`),
  );
}

function collapsed(text: string): string {
  return text.replace(/\s+/gu, ' ');
}

function quoted(text: string): string {
  return JSON.stringify(text);
}
