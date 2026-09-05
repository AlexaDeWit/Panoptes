import { Data } from 'effect';

/**
 * A file the studio was handed, as the little of it the open path reads: its
 * name, how many bytes it holds, and its text on demand. It is structural,
 * so a browser `File` satisfies it and a spec hands over a literal.
 */
export type ChosenFile = {
  readonly name: string;
  readonly size: number;
  text(): Promise<string>;
};

/**
 * What asking for a file produced.
 *
 * `Chosen` is the text, already inside the bound the caller named.
 * `TooLarge` is a file past that bound, measured before its text was read,
 * which is what keeps the read itself finite. `Unreadable` is the file never
 * arriving, which is the platform's answer and no codec's. `Cancelled` is
 * the person dismissing the picker, which is not a failure and says nothing.
 * `NoPicker` is a bridge with no picker of its own, so the caller opens
 * through its own file input; the browser bridge answers this wherever the
 * File System Access API is missing.
 */
export type OpenOutcome = Data.TaggedEnum<{
  Chosen: { readonly name: string; readonly text: string };
  TooLarge: {
    readonly name: string;
    readonly bound: number;
    readonly observed: number;
  };
  Unreadable: { readonly reason: string };
  Cancelled: {};
  NoPicker: {};
}>;

/**
 * Constructors for {@link OpenOutcome}, plus Effect's `$is` and `$match`
 * helpers.
 */
export const OpenOutcome = Data.taggedEnum<OpenOutcome>();

/**
 * What asking to write a file produced. `Written` names the file the text
 * reached, which is the one the person chose where they were asked and not
 * always the one that was proposed. `Cancelled` is the person dismissing the
 * picker. `Refused` is the platform declining to write.
 */
export type SaveOutcome = Data.TaggedEnum<{
  Written: { readonly name: string };
  Cancelled: {};
  Refused: { readonly reason: string };
}>;

/**
 * Constructors for {@link SaveOutcome}, plus Effect's `$is` and `$match`
 * helpers.
 */
export const SaveOutcome = Data.taggedEnum<SaveOutcome>();

/**
 * How the studio reaches files: a record of functions the app is handed
 * rather than a platform it calls, so the browser implementation, a spec's
 * recording one, and the typed IPC an Electron shell will offer (issue #43)
 * are the same interface to every view.
 *
 * `open` puts a picker on screen and answers with the text. `received` is
 * that same answer for a file the caller's own file input produced, which is
 * how a browser with no picker of its own opens one; it also forgets
 * whatever `open` retained, so a later save does not write over the file the
 * person moved away from. `save` writes back to the file the model came from
 * where the bridge still holds it and offers a download otherwise, and
 * `saveAs` always asks where.
 *
 * Every path answers with an outcome rather than throwing, and the bound a
 * read may spend is passed in rather than known here, so one number
 * (`readLimits.maxTextBytes`) governs the studio and the codecs alike.
 */
export type FileBridge = {
  open(maxBytes: number): Promise<OpenOutcome>;
  received(file: ChosenFile, maxBytes: number): Promise<OpenOutcome>;
  save(name: string, text: string): Promise<SaveOutcome>;
  saveAs(name: string, text: string): Promise<SaveOutcome>;
};

/**
 * A chosen file as text, refusing one past the bound before any of it is
 * read. Every bridge reads a file through this, so the size check cannot be
 * missed on one path and taken on another.
 */
export async function readWithin(
  file: ChosenFile,
  maxBytes: number,
): Promise<OpenOutcome> {
  if (file.size > maxBytes) {
    return OpenOutcome.TooLarge({
      name: file.name,
      bound: maxBytes,
      observed: file.size,
    });
  }
  try {
    return OpenOutcome.Chosen({ name: file.name, text: await file.text() });
  } catch (cause) {
    return OpenOutcome.Unreadable({ reason: reasonOf(cause) });
  }
}

/**
 * What a platform refused with, as a line for a person. A browser rejects
 * with a `DOMException` carrying a message worth showing, and anything else
 * is rendered rather than dropped.
 */
export function reasonOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
