import {
  ReadFailure,
  escapedForTerminal,
  quotedForTerminal,
  readAnyFormat,
  readLimits,
  renderReadFailure,
  withinTextBytes,
  type DetectedRead,
  type DetectionFailure,
} from '@saerskriven/formats';
import { Data, Either } from 'effect';
import {
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  type Stats,
} from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { revisionOf } from './revision.js';

/**
 * Where the server may read, and which model it reads when a tool names no
 * file. Both paths are resolved through every symbolic link when the
 * workspace opens, so the comparison a later call makes is between two real
 * paths rather than between two spellings.
 */
export type ModelWorkspace = {
  readonly root: string;
  readonly defaultFile: string | undefined;
};

/**
 * Why the server has no model to work with. `OutsideRoot` is refusable
 * input rather than a fault: an agent names a path, and a path that leaves
 * the root is answered with where it resolved to, not with an exception. A
 * `path` is the spelling the call used, so what a result names is what the
 * next call may pass; `resolved` is the absolute path, which is the whole
 * point of that one variant.
 */
export type WorkspaceFailure = Data.TaggedEnum<{
  NoRoot: { readonly root: string; readonly reason: string };
  OutsideRoot: {
    readonly requested: string;
    readonly resolved: string;
    readonly root: string;
  };
  Unreadable: { readonly path: string; readonly reason: string };
  Unread: {
    readonly path: string;
    readonly failure: ReadFailure | DetectionFailure;
  };
}>;

/**
 * Constructor for {@link WorkspaceFailure}, plus Effect's `$is` and `$match`
 * helpers.
 */
export const WorkspaceFailure = Data.taggedEnum<WorkspaceFailure>();

/** One file's bytes as the server read them, and the text they decode to. */
export type ReadTextFile = {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly text: string;
};

/** One model file as the server read it, with the handle a write quotes back. */
export type ReadModelFile = {
  readonly path: string;
  readonly revision: string;
  readonly read: DetectedRead;
};

/** What the `mcp` invocation asked the server to work over. */
export type WorkspaceRequest = {
  readonly root: string;
  readonly file?: string;
};

/**
 * The workspace an invocation describes, or why it cannot be opened. A root
 * that is not a directory this process can resolve is refused here rather
 * than at the first tool call, and a default file outside the root is refused
 * with the rest of the invocation.
 */
export function openWorkspace(
  request: WorkspaceRequest,
): Either.Either<ModelWorkspace, WorkspaceFailure> {
  return Either.flatMap(rootOf(request.root), (root) =>
    defaulting(root, request.file),
  );
}

/**
 * The text of a file a tool call names. The path is confined to the root
 * first, and the entry is measured before its bytes are read: anything that
 * is not a regular file is refused there, so a FIFO or a device inside the
 * root cannot block the synchronous read forever, and a regular file past
 * the shared text bound costs a `stat` rather than its own length in memory.
 * A `stat` that fails refuses too, since a bound that cannot be measured is
 * no bound.
 */
export function readTextFile(
  workspace: ModelWorkspace,
  requested: string,
): Either.Either<ReadTextFile, WorkspaceFailure> {
  return Either.flatMap(confined(workspace, requested), (path) =>
    Either.flatMap(readableFile(path, requested), () =>
      Either.map(bytesOf(path, requested), (bytes) => ({
        path,
        bytes,
        text: Buffer.from(bytes).toString('utf8'),
      })),
    ),
  );
}

/**
 * The model a tool call names, read through the format detection every other
 * reader goes through, on the bounds {@link readTextFile} applies.
 */
export function readModelFile(
  workspace: ModelWorkspace,
  requested: string,
): Either.Either<ReadModelFile, WorkspaceFailure> {
  return Either.flatMap(readTextFile(workspace, requested), (file) =>
    Either.mapBoth(readAnyFormat(file.text), {
      onLeft: (failure) =>
        WorkspaceFailure.Unread({ path: requested, failure }),
      onRight: (read) => ({
        path: file.path,
        revision: revisionOf(file.bytes),
        read,
      }),
    }),
  );
}

/**
 * The path a result names a file by: relative to the root, so what an agent
 * reads back is what it may pass to the next call.
 */
export function withinRoot(workspace: ModelWorkspace, path: string): string {
  return relative(workspace.root, path);
}

/**
 * Every file under the root whose name suggests a model, sorted by path,
 * which is what a tool offers when no file was named. The extension is all
 * that is consulted, so an entry is a candidate rather than a model: only a
 * read settles which format claims a file, and reading the whole tree to
 * answer a listing is not what the listing is for.
 *
 * The walk follows no symbolic link, so a listing cannot leave the root or
 * circle back into itself. It also skips entries whose name starts with a dot
 * and the `node_modules` of a checkout, and descends no deeper than
 * {@link candidateDepth}. It stops collecting once it is one past
 * {@link candidateLimit} rather than gathering a tree to throw most of it
 * away, so a truncated listing is the files the walk reached first, sorted,
 * and the result says it was truncated. A directory the process cannot read
 * contributes nothing.
 */
export function candidateFiles(workspace: ModelWorkspace): {
  readonly files: readonly string[];
  readonly truncated: boolean;
} {
  const found: string[] = [];
  let frontier: readonly string[] = [workspace.root];
  for (let depth = 0; depth <= candidateDepth; depth += 1) {
    const next: string[] = [];
    for (const directory of frontier) {
      for (const entry of entriesOf(directory)) {
        if (found.length > candidateLimit) {
          break;
        }
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          next.push(path);
        } else if (entry.isFile() && modelExtensions.has(extensionOf(path))) {
          found.push(withinRoot(workspace, path));
        }
      }
    }
    frontier = next;
  }
  found.sort();
  return {
    files: found.slice(0, candidateLimit),
    truncated: found.length > candidateLimit,
  };
}

/** Why the server has no model, as the lines a tool result carries. */
export function renderWorkspaceFailure(
  failure: WorkspaceFailure,
): readonly string[] {
  return WorkspaceFailure.$match(failure, {
    NoRoot: ({ root, reason }) => [
      `The root ${quotedForTerminal(root)} cannot be used: ${escapedForTerminal(reason)}.`,
    ],
    OutsideRoot: ({ requested, resolved, root }) => [
      `The file ${quotedForTerminal(requested)} is outside the root this server may read.`,
      `It resolves to ${quotedForTerminal(resolved)}, and the root is ${quotedForTerminal(root)}.`,
    ],
    Unreadable: ({ path, reason }) => [
      `The file ${quotedForTerminal(path)} cannot be read: ${escapedForTerminal(reason)}.`,
    ],
    Unread: ({ path, failure: refusal }) => [
      `The file ${quotedForTerminal(path)} was not read.`,
      ...renderReadFailure(refusal),
    ],
  });
}

/** How many directories below the root a candidate listing descends. */
export const candidateDepth = 8;

/** How many candidate files a listing carries before it reports a truncation. */
export const candidateLimit = 200;

const modelExtensions = new Set(['.json', '.yaml', '.yml']);

const skippedDirectories = new Set(['node_modules']);

function defaulting(
  root: string,
  file: string | undefined,
): Either.Either<ModelWorkspace, WorkspaceFailure> {
  const empty: ModelWorkspace = { root, defaultFile: undefined };
  return file === undefined
    ? Either.right(empty)
    : Either.map(confined(empty, file), (defaultFile): ModelWorkspace => ({
        root,
        defaultFile,
      }));
}

function rootOf(root: string): Either.Either<string, WorkspaceFailure> {
  return Either.try({
    try: () => realpathSync(resolve(root)),
    catch: (error) =>
      WorkspaceFailure.NoRoot({ root, reason: reasonOf(error) }),
  });
}

/**
 * A requested path as the absolute path it resolves to inside the root, or
 * the refusal naming where it landed. Every path this server reads or writes
 * passes through here, including one whose last segments do not exist yet,
 * which is the path a write that creates a file names.
 */
export function confined(
  workspace: ModelWorkspace,
  requested: string,
): Either.Either<string, WorkspaceFailure> {
  const resolved = realPathOf(resolve(workspace.root, requested));
  return resolved === workspace.root ||
    resolved.startsWith(workspace.root + sep)
    ? Either.right(resolved)
    : Either.left(
        WorkspaceFailure.OutsideRoot({
          requested,
          resolved,
          root: workspace.root,
        }),
      );
}

/**
 * A path with every symbolic link on it followed, including on a path whose
 * last segments do not exist yet: the deepest ancestor that resolves is
 * resolved, and what was below it is put back. A link inside the root
 * pointing out of it therefore answers with where it points.
 */
function realPathOf(path: string): string {
  const below: string[] = [];
  let current = path;
  for (;;) {
    const resolved = Either.getOrUndefined(
      Either.try(() => realpathSync(current)),
    );
    if (resolved !== undefined) {
      return join(resolved, ...below);
    }
    const parent = dirname(current);
    if (parent === current) {
      return join(current, ...below);
    }
    below.unshift(basename(current));
    current = parent;
  }
}

function readableFile(
  path: string,
  requested: string,
): Either.Either<void, WorkspaceFailure> {
  return Either.flatMap(statted(path, requested), (stats) =>
    stats.isFile()
      ? withinSizeBound(stats.size, requested)
      : Either.left(
          WorkspaceFailure.Unreadable({
            path: requested,
            reason: 'it is not a regular file',
          }),
        ),
  );
}

function statted(
  path: string,
  requested: string,
): Either.Either<Stats, WorkspaceFailure> {
  return Either.try({
    try: () => statSync(path),
    catch: (error) =>
      WorkspaceFailure.Unreadable({
        path: requested,
        reason: reasonOf(error),
      }),
  });
}

function withinSizeBound(
  size: number,
  requested: string,
): Either.Either<void, WorkspaceFailure> {
  return withinTextBytes(size)
    ? Either.right(undefined)
    : Either.left(
        WorkspaceFailure.Unread({
          path: requested,
          failure: ReadFailure.ExceededReadLimit({
            limit: 'maxTextBytes',
            bound: readLimits.maxTextBytes,
            observed: size,
          }),
        }),
      );
}

function bytesOf(
  path: string,
  requested: string,
): Either.Either<Uint8Array, WorkspaceFailure> {
  return Either.try({
    try: () => readFileSync(path),
    catch: (error) =>
      WorkspaceFailure.Unreadable({
        path: requested,
        reason: reasonOf(error),
      }),
  });
}

function entriesOf(directory: string) {
  return Either.getOrElse(
    Either.try(() => readdirSync(directory, { withFileTypes: true })),
    () => [],
  ).filter(
    (entry) =>
      !entry.name.startsWith('.') && !skippedDirectories.has(entry.name),
  );
}

/**
 * The extension a path ends in, lowercase and with its dot, and the empty
 * string where it ends in none. A name of nothing but an extension is a
 * hidden file rather than one, so `.png` answers empty, a name ending in a
 * dot answers that dot alone, and a name carrying several answers the last,
 * which is what a reader of the path would go by.
 */
export function extensionOf(path: string): string {
  const name = basename(path);
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot).toLowerCase();
}

/** What a thrown value says, for the system's own sentence on a failure. */
export function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
