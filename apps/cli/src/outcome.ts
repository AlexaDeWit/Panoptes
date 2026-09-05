/**
 * What the process answers with. 0 is the command doing what it was asked,
 * 1 is a file Panoptes read and refused, and 2 is an invocation it cannot
 * carry out. The README states the same three, and nothing else is ever
 * returned.
 */
export type ExitCode = 0 | 1 | 2;

/**
 * What a command puts on standard output: the text of a document, or its
 * bytes where the document is not text. A PDF is the second, and a stream
 * handed a string would encode it as UTF-8 and corrupt it.
 */
export type CommandOutput = string | Uint8Array;

/**
 * What a command asks the edge to do: the exit code, and what each stream is
 * to carry. Both are written verbatim, so a command writing a document to
 * standard output decides its own trailing newline rather than inheriting
 * one.
 */
export type CommandOutcome = {
  readonly code: ExitCode;
  readonly out: CommandOutput;
  readonly err: string;
};

/** The command did what it was asked, whatever it wrote to either stream. */
export function succeeded(out: CommandOutput, err: string): CommandOutcome {
  return { code: 0, out, err };
}

/** Panoptes read the file and refused it. */
export function invalidInput(err: string): CommandOutcome {
  return { code: 1, out: '', err };
}

/**
 * The invocation cannot be carried out: the parser or the option schema
 * refused it, a file cannot be read or written, a choice names no diagram,
 * a stream refused the output, a pipe whose reader closed aside, or a
 * projection could not be produced from a model Panoptes accepted, which is
 * a typesetter refusing the document or an install missing the files it
 * typesets with. The last two are 2 rather than 1 because the file was read
 * and was good: what failed is the asking, not the input.
 */
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
