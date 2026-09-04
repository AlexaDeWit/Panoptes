import { Either } from 'effect';
import { readFileSync, writeFileSync } from 'node:fs';

/**
 * What a thrown value says. Node's file calls throw an Error carrying the
 * system's own sentence, which is what a user needs to see; a value thrown
 * that is not an Error is reported as it prints rather than swallowed.
 */
export function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * A file as UTF-8 text, or a sentence naming the path and the system's
 * reason. The file calls are the one place the CLI meets a channel that
 * throws, and it is contained here so no command has to.
 */
export function readTextFile(path: string): Either.Either<string, string> {
  return Either.try({
    try: () => readFileSync(path, 'utf8'),
    catch: (error) => `cannot read ${path}: ${reasonOf(error)}`,
  });
}

/**
 * The text written to a path as UTF-8, or a sentence naming the path and
 * the system's reason.
 */
export function writeTextFile(
  path: string,
  text: string,
): Either.Either<void, string> {
  return Either.try({
    try: () => {
      writeFileSync(path, text);
    },
    catch: (error) => `cannot write ${path}: ${reasonOf(error)}`,
  });
}
