import {
  OpenOutcome,
  SaveOutcome,
  fileOwnership,
  readWithin,
  reasonOf,
  type ChosenFile,
  type FileContent,
  type FileBridge,
  type FileResult,
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

const ownership = fileOwnership<FileSystemFileHandle>();

const dismissed = (cause: unknown): boolean =>
  cause instanceof DOMException && cause.name === 'AbortError';

async function open(maxBytes: number): Promise<FileResult<OpenOutcome>> {
  const complete = ownership.begin();
  const previous = ownership.current();
  const picker = window.showOpenFilePicker;
  if (picker === undefined) {
    return complete(OpenOutcome.NoPicker(), previous);
  }
  try {
    const chosen = await picker({ multiple: false });
    const handle = chosen.at(0);
    if (handle === undefined) {
      return complete(OpenOutcome.Cancelled(), previous);
    }
    const outcome = await readWithin(await handle.getFile(), maxBytes);
    return complete(outcome, handle);
  } catch (cause) {
    return complete(
      dismissed(cause)
        ? OpenOutcome.Cancelled()
        : OpenOutcome.Unreadable({ reason: reasonOf(cause) }),
      previous,
    );
  }
}

async function received(
  file: ChosenFile,
  maxBytes: number,
): Promise<FileResult<OpenOutcome>> {
  const complete = ownership.begin();
  return complete(await readWithin(file, maxBytes), undefined);
}

function release(): void {
  ownership.release();
}

async function save(
  name: string,
  text: string,
): Promise<FileResult<SaveOutcome>> {
  const complete = ownership.begin();
  const held = ownership.current();
  const outcome =
    held === undefined
      ? download(name, text, 'text/plain;charset=utf-8')
      : await writeTo(held, held.name, text);
  return complete(outcome, held);
}

async function saveAs(
  name: string,
  types: readonly SaveFileType[],
  text: SaveText,
): Promise<FileResult<SaveOutcome>> {
  const complete = ownership.begin();
  const previous = ownership.current();
  const picker = window.showSaveFilePicker;
  if (picker === undefined) {
    return complete(
      download(name, text(name), 'text/plain;charset=utf-8'),
      undefined,
    );
  }
  try {
    const handle = await picker({ suggestedName: name, types });
    const outcome = await writeTo(handle, handle.name, text(handle.name));
    return complete(
      outcome,
      SaveOutcome.$is('Written')(outcome) ? handle : previous,
    );
  } catch (cause) {
    return complete(
      dismissed(cause)
        ? SaveOutcome.Cancelled()
        : SaveOutcome.Refused({ reason: reasonOf(cause) }),
      previous,
    );
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

/** Only settlement adopts or drops a handle. Close releases it and invalidates pending operations. */
export const browserFileBridge: FileBridge = {
  open,
  received,
  save,
  saveAs,
  exportFile,
  asksWhere,
  release,
};
