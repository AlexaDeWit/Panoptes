import { Either } from 'effect';
import { readFileSync, statSync, writeFileSync } from 'node:fs';

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
 * reason. Node's file calls throw, and they are contained here so no
 * command has to.
 */
export function readTextFile(path: string): Either.Either<string, string> {
  return Either.try({
    try: () => readFileSync(path, 'utf8'),
    catch: (error) => `cannot read ${path}: ${reasonOf(error)}`,
  });
}

/**
 * How many bytes a path holds, or nothing where it cannot be measured, in
 * which case the read that follows says why the path was no good.
 */
export function sizeOf(path: string): number | undefined {
  return Either.getOrUndefined(Either.try(() => statSync(path).size));
}

/**
 * The content written to a path, text as UTF-8 and bytes as they are, or a
 * sentence naming the path and the system's reason.
 */
export function writeFile(
  path: string,
  content: string | Uint8Array,
): Either.Either<void, string> {
  return Either.try({
    try: () => {
      writeFileSync(path, content);
    },
    catch: (error) => `cannot write ${path}: ${reasonOf(error)}`,
  });
}
