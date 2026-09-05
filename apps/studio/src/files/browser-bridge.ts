import {
  OpenOutcome,
  SaveOutcome,
  readWithin,
  reasonOf,
  type ChosenFile,
  type FileBridge,
} from './bridge.js';

type OpenPicker = (options: {
  readonly multiple: false;
}) => Promise<readonly FileSystemFileHandle[]>;

type SavePicker = (options: {
  readonly suggestedName: string;
}) => Promise<FileSystemFileHandle>;

declare global {
  interface Window {
    showOpenFilePicker?: OpenPicker;
    showSaveFilePicker?: SavePicker;
  }
}

let held: FileSystemFileHandle | undefined;

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
    held = handle;
    return await readWithin(await handle.getFile(), maxBytes);
  } catch (cause) {
    return dismissed(cause)
      ? OpenOutcome.Cancelled()
      : OpenOutcome.Unreadable({ reason: reasonOf(cause) });
  }
}

function received(file: ChosenFile, maxBytes: number): Promise<OpenOutcome> {
  held = undefined;
  return readWithin(file, maxBytes);
}

function save(name: string, text: string): Promise<SaveOutcome> {
  return held === undefined
    ? Promise.resolve(download(name, text))
    : writeTo(held, held.name, text);
}

async function saveAs(name: string, text: string): Promise<SaveOutcome> {
  const picker = window.showSaveFilePicker;
  held = undefined;
  if (picker === undefined) {
    return download(name, text);
  }
  try {
    const handle = await picker({ suggestedName: name });
    held = handle;
    return await writeTo(handle, handle.name, text);
  } catch (cause) {
    return dismissed(cause)
      ? SaveOutcome.Cancelled()
      : SaveOutcome.Refused({ reason: reasonOf(cause) });
  }
}

async function writeTo(
  handle: FileSystemFileHandle,
  name: string,
  text: string,
): Promise<SaveOutcome> {
  try {
    const stream = await handle.createWritable();
    await stream.write(text);
    await stream.close();
    return SaveOutcome.Written({ name });
  } catch (cause) {
    return SaveOutcome.Refused({ reason: reasonOf(cause) });
  }
}

function download(name: string, text: string): SaveOutcome {
  const url = URL.createObjectURL(
    new Blob([text], { type: 'text/plain;charset=utf-8' }),
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

/**
 * The studio in a browser. Where the File System Access API is there, a save
 * writes back to the very file that was opened, so the person keeps one file
 * rather than a directory of downloads. Where it is not, `open` answers
 * `NoPicker` for the caller's own file input to take over and a save offers
 * the text as a download, which every browser has.
 *
 * The handle a picker returned is held here rather than in the store,
 * because it is neither plain data nor undoable: it is which file on disk
 * this tab may write, and it is dropped the moment the model moves to
 * another file.
 *
 * The two pickers are declared here because TypeScript's DOM library does
 * not declare them, and each is read off `window` as an optional member, so
 * a browser without one is a property that is not there rather than a name
 * that is not defined.
 */
export const browserFileBridge: FileBridge = {
  open,
  received,
  save,
  saveAs,
};
