import {
  OpenOutcome,
  SaveOutcome,
  readWithin,
  reasonOf,
  type ChosenFile,
  type FileContent,
  type FileBridge,
  type SaveFileType,
  type SaveText,
} from './bridge.js';

type OpenPicker = (options: {
  readonly multiple: false;
}) => Promise<readonly FileSystemFileHandle[]>;

type SavePicker = (options: {
  readonly suggestedName: string;
  readonly types: readonly SaveFileType[];
}) => Promise<FileSystemFileHandle>;

declare global {
  interface Window {
    showOpenFilePicker?: OpenPicker;
    showSaveFilePicker?: SavePicker;
  }
}

let held: FileSystemFileHandle | undefined;
let revision = 0;

const dismissed = (cause: unknown): boolean =>
  cause instanceof DOMException && cause.name === 'AbortError';

async function open(maxBytes: number): Promise<OpenOutcome> {
  const picker = window.showOpenFilePicker;
  if (picker === undefined) {
    return OpenOutcome.NoPicker();
  }
  try {
    const chosen = await picker({ multiple: false });
    const handle = chosen.at(0);
    if (handle === undefined) {
      return OpenOutcome.Cancelled();
    }
    const outcome = await readWithin(await handle.getFile(), maxBytes);
    held = OpenOutcome.$is('Chosen')(outcome) ? handle : undefined;
    revision += 1;
    return outcome;
  } catch (cause) {
    return dismissed(cause)
      ? OpenOutcome.Cancelled()
      : OpenOutcome.Unreadable({ reason: reasonOf(cause) });
  }
}

async function received(
  file: ChosenFile,
  maxBytes: number,
): Promise<OpenOutcome> {
  const outcome = await readWithin(file, maxBytes);
  release();
  return outcome;
}

function release(): void {
  held = undefined;
  revision += 1;
}

async function save(name: string, text: string): Promise<SaveOutcome> {
  const started = revision;
  const outcome =
    held === undefined
      ? download(name, text, 'text/plain;charset=utf-8')
      : await writeTo(held, held.name, text);
  if (started === revision && SaveOutcome.$is('Written')(outcome)) {
    revision += 1;
  }
  return outcome;
}

async function saveAs(
  name: string,
  types: readonly SaveFileType[],
  text: SaveText,
): Promise<SaveOutcome> {
  const started = revision;
  const picker = window.showSaveFilePicker;
  if (picker === undefined) {
    release();
    return download(name, text(name), 'text/plain;charset=utf-8');
  }
  try {
    const handle = await picker({ suggestedName: name, types });
    const outcome = await writeTo(handle, handle.name, text(handle.name));
    if (started === revision && SaveOutcome.$is('Written')(outcome)) {
      held = handle;
      revision += 1;
    }
    return outcome;
  } catch (cause) {
    return dismissed(cause)
      ? SaveOutcome.Cancelled()
      : SaveOutcome.Refused({ reason: reasonOf(cause) });
  }
}

async function exportFile(
  name: string,
  type: SaveFileType,
  content: FileContent,
): Promise<SaveOutcome> {
  const picker = window.showSaveFilePicker;
  if (picker === undefined) {
    return download(name, content, mediaTypeOf(type));
  }
  try {
    const handle = await picker({ suggestedName: name, types: [type] });
    return writeTo(handle, handle.name, content);
  } catch (cause) {
    return dismissed(cause)
      ? SaveOutcome.Cancelled()
      : SaveOutcome.Refused({ reason: reasonOf(cause) });
  }
}

function asksWhere(): boolean {
  return window.showSaveFilePicker !== undefined;
}

async function writeTo(
  handle: FileSystemFileHandle,
  name: string,
  content: FileContent,
): Promise<SaveOutcome> {
  try {
    const stream = await handle.createWritable();
    await stream.write(
      typeof content === 'string' ? content : new Uint8Array(content),
    );
    await stream.close();
    return SaveOutcome.Written({ name });
  } catch (cause) {
    return SaveOutcome.Refused({ reason: reasonOf(cause) });
  }
}

function download(
  name: string,
  content: FileContent,
  mediaType: string,
): SaveOutcome {
  const url = URL.createObjectURL(
    new Blob(
      [typeof content === 'string' ? content : new Uint8Array(content)],
      { type: mediaType },
    ),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  globalThis.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
  return SaveOutcome.Written({ name });
}

function mediaTypeOf(type: SaveFileType): string {
  return Object.keys(type.accept)[0] ?? 'application/octet-stream';
}

/**
 * Handles are dropped by release, completed fallback reads, fallback save-as, and bounded picker read failures.
 * Save completions cannot replace a newer association.
 */
export const browserFileBridge: FileBridge = {
  open,
  received,
  save,
  saveAs,
  exportFile,
  asksWhere,
  release,
};
