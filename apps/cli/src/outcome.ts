/**
 * What the process answers with. 0 is the command doing what it was asked.
 * 1 is the input being invalid, which is a file Panoptes read and refused.
 * 2 is the invocation not being usable, which covers an unknown flag, a
 * missing argument, a file the process cannot read or write, and a choice
 * that names nothing. The README states the same three, and nothing else is
 * ever returned.
 */
export type ExitCode = 0 | 1 | 2;

/**
 * What a command asks the edge to do: the exit code, and the text each
 * stream is to carry. Both texts are written verbatim, so a command writing
 * a document to standard output decides its own trailing newline rather
 * than inheriting one.
 */
export type CommandOutcome = {
  readonly code: ExitCode;
  readonly out: string;
  readonly err: string;
};

/** The command did what it was asked, whatever it wrote to either stream. */
export function succeeded(out: string, err: string): CommandOutcome {
  return { code: 0, out, err };
}

/** Panoptes read the file and refused it. */
export function invalidInput(err: string): CommandOutcome {
  return { code: 1, out: '', err };
}

/** The invocation cannot be carried out as given. */
export function usageError(err: string): CommandOutcome {
  return { code: 2, out: '', err };
}

/**
 * Texts as lines, each ending in a newline, so passing none gives an empty
 * text rather than a blank line.
 */
export function lines(...texts: readonly string[]): string {
  return texts.map((text) => `${text}\n`).join('');
}
