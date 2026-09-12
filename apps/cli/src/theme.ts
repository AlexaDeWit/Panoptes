import {
  escapedForTerminal,
  parseYaml,
  readLimits,
  ReadFailure,
  renderReadFailure,
} from '@saerskriven/formats';
import {
  defaultRenderTheme,
  readThemeOverrides,
  withBundledFonts,
  type ThemeRead,
} from '@saerskriven/render';
import { Data, Either } from 'effect';
import { readTextFile, withinReadBound } from './files.js';
import { lines } from './outcome.js';

/** File failures remain data until the command chooses the default theme. */
export type ThemeFileFailure = Data.TaggedEnum<{
  Unreadable: { readonly message: string };
  Unusable: { readonly failure: ReadFailure };
}>;

/** The theme reader's package-owned file and parser failures. */
export const ThemeFileFailure = Data.taggedEnum<ThemeFileFailure>();

/** Reads partial YAML overrides within the format package's shared resource bounds. */
export function readThemeFile(
  path: string,
): Either.Either<ThemeRead, ThemeFileFailure> {
  return Either.flatMap(
    withinReadBound(path, (observed) =>
      ThemeFileFailure.Unusable({
        failure: ReadFailure.ExceededReadLimit({
          limit: 'maxTextBytes',
          bound: readLimits.maxTextBytes,
          observed,
        }),
      }),
    ),
    () =>
      Either.flatMap(
        Either.mapLeft(readTextFile(path), (message) =>
          ThemeFileFailure.Unreadable({ message }),
        ),
        themeText,
      ),
  );
}

function themeText(text: string): Either.Either<ThemeRead, ThemeFileFailure> {
  const empty = /^(?:\s|#[^\n]*(?:\n|$))*$/u.test(text);
  return Either.map(
    Either.mapLeft(parseYaml(text), (failure) =>
      ThemeFileFailure.Unusable({ failure }),
    ),
    (value) => readThemeOverrides(empty ? {} : value),
  );
}

/** Resolves best-effort file input and the font limits of the selected output. */
export function commandTheme(
  path: string | undefined,
  format: 'md' | 'pdf' | 'svg' | 'png',
  styled: boolean,
): ThemeRead {
  const read =
    path === undefined
      ? { theme: defaultRenderTheme, diagnostics: [] }
      : Either.match(readThemeFile(path), {
          onRight: (value) => value,
          onLeft: (failure): ThemeRead => ({
            theme: defaultRenderTheme,
            diagnostics: [
              {
                key: '',
                message: ThemeFileFailure.$match(failure, {
                  Unreadable: ({ message }) => `${message}, using defaults`,
                  Unusable: ({ failure: reason }) =>
                    `${renderReadFailure(reason).join(' ')}, using defaults`,
                }),
              },
            ],
          }),
        });
  const fitted =
    format === 'pdf' || format === 'png' ? withBundledFonts(read.theme) : read;
  const diagnostics =
    fitted === read
      ? [...read.diagnostics]
      : [...read.diagnostics, ...fitted.diagnostics];
  if (path !== undefined && format === 'md' && !styled)
    diagnostics.push({
      key: '',
      message:
        'portable Markdown cannot apply appearance settings, keeping readable text',
    });
  return { theme: fitted.theme, diagnostics };
}

/** Diagnostics are terminal-escaped and never enter the rendered document. */
export function themeWarnings(
  path: string | undefined,
  diagnostics: ThemeRead['diagnostics'],
): string {
  return diagnostics.length === 0
    ? ''
    : lines(
        ...diagnostics.map(({ key, message }) =>
          escapedForTerminal(
            `warning: theme ${JSON.stringify(path ?? 'default')}${key === '' ? '' : ` ${key}`}: ${message}`,
          ),
        ),
      );
}
