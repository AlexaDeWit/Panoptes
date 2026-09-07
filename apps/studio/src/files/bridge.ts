import { Data } from 'effect';

/** The browser File fields needed for a bounded read. */
export type ChosenFile = {
  readonly name: string;
  readonly size: number;
  text(): Promise<string>;
};

/** Chosen text is within the byte bound but still needs codec validation. */
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

/** Constructors and matching helpers for open outcomes. */
export const OpenOutcome = Data.taggedEnum<OpenOutcome>();

/** Written names the file that received the text, which can differ from the proposed name. */
export type SaveOutcome = Data.TaggedEnum<{
  Written: { readonly name: string };
  Cancelled: {};
  Refused: { readonly reason: string };
}>;

/** Constructors and matching helpers for save outcomes. */
export const SaveOutcome = Data.taggedEnum<SaveOutcome>();

/** A format offered through the File System Access API. */
export type SaveFileType = {
  readonly description: string;
  readonly accept: Readonly<Record<string, readonly string[]>>;
};

/** Produces text after the chosen file name determines its format. */
export type SaveText = (name: string) => string;

/** Text or binary content the studio can place outside its open file. */
export type FileContent = string | Uint8Array;

/** Settle once before dispatch, retaining the candidate handle or releasing the association. */
export type FileResult<Outcome> = {
  readonly outcome: Outcome;
  settle(retain: boolean): boolean;
};

/** Only the latest request can settle its handle, and Close invalidates every pending result. */
export function fileOwnership<Handle>() {
  let owner: symbol | undefined;
  let held: Handle | undefined;
  return {
    current: (): Handle | undefined => held,
    begin: () => {
      const operation = Symbol();
      owner = operation;
      return <Outcome>(
        outcome: Outcome,
        candidate: Handle | undefined,
      ): FileResult<Outcome> => ({
        outcome,
        settle: (retain) => {
          if (owner !== operation) {
            return false;
          }
          owner = undefined;
          held = retain ? candidate : undefined;
          return true;
        },
      });
    },
    release: (): void => {
      owner = undefined;
      held = undefined;
    },
  };
}

/** File operations defer handle adoption until settlement. Exports never change the association. */
export type FileBridge = {
  open(maxBytes: number): Promise<FileResult<OpenOutcome>>;
  received(
    file: ChosenFile,
    maxBytes: number,
  ): Promise<FileResult<OpenOutcome>>;
  save(name: string, text: string): Promise<FileResult<SaveOutcome>>;
  saveAs(
    name: string,
    types: readonly SaveFileType[],
    text: SaveText,
  ): Promise<FileResult<SaveOutcome>>;
  exportFile(
    name: string,
    type: SaveFileType,
    content: FileContent,
  ): Promise<SaveOutcome>;
  asksWhere(): boolean;
  release(): void;
};

/** Refuses an oversized file before requesting its text. */
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

/** Preserves an Error message and converts other rejection values to text. */
export function reasonOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
