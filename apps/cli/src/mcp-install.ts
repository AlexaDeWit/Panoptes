import {
  createdFile,
  replacedFile,
  revisionOf,
  WriteFailure,
  type WriteTarget,
} from '@saerskriven/mcp';
import { Either } from 'effect';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';
import { reasonOf, withinReadBound } from './files.js';
import {
  InstallFailure,
  entryText,
  hostDocument,
  hostEntry,
  hostFile,
  hostNameSchema,
  hostRegistrations,
  hostText,
  installEnvironment,
  renderInstallFailure,
  withRegistration,
  type HostDocument,
  type HostEntry,
  type HostFile,
  type HostName,
  type HostRegistration,
  type HostScope,
  type InstallEnvironment,
  type NamedHostFile,
} from './mcp-hosts.js';
import {
  lines,
  succeeded,
  usageError,
  type CommandOutcome,
} from './outcome.js';

/**
 * What `mcp install` needs, and the one gate on the option bag the parser
 * hands over. `--project` and `--user` name one file each, so naming both is
 * refused here rather than resolved to one of them. Naming neither leaves
 * the choice to the host: the file a project commits where it keeps one, and
 * the user-level file where it does not.
 */
export const installOptionsSchema = z
  .object({
    host: hostNameSchema,
    project: z.boolean().optional(),
    user: z.boolean().optional(),
    file: z.string().optional(),
    print: z.boolean().optional(),
  })
  .superRefine((options, ctx) => {
    if (options.project === true && options.user === true) {
      ctx.addIssue({
        code: 'custom',
        path: ['project'],
        message:
          'names the file a project commits and --user the one that covers every project, so pass one of them',
      });
    }
  });

/** The options an `mcp install` invocation was given. */
export type InstallOptions = z.infer<typeof installOptionsSchema>;

/** What became of a registration: written, already there, or only shown. */
export type InstallStatus = 'written' | 'unchanged' | 'shown';

/**
 * What the command reports: the host and scope it was asked for, the file a
 * registration belongs in, what became of it, and the entry itself. The
 * entry block is the text a host file holds for this server and nothing
 * else, which is the snippet to quote wherever registration is documented.
 */
export type InstallReport = {
  readonly host: HostName;
  readonly scope: HostScope;
  readonly file: string;
  readonly status: InstallStatus;
  readonly entry: string;
};

/** The report as the lines the command puts on standard output. */
export function renderInstallReport(report: InstallReport): readonly string[] {
  return [
    `host: ${report.host}`,
    `scope: ${report.scope}`,
    `file: ${report.file}`,
    `status: ${report.status}`,
    'entry:',
    report.entry.trimEnd(),
  ];
}

/**
 * `saer mcp install`: the host's registration for `saer mcp`, written once
 * and a no-op on every run after that. What the file already holds is
 * carried over, a file this command cannot parse or cannot read inside the
 * shared read bound is refused with its path rather than replaced, and
 * `--print` writes nothing at all.
 *
 * A target that is a symbolic link is resolved before it is written, so a
 * configuration file linked into a dotfiles repository keeps its link and
 * the write lands on the file it points at. A file this creates is written
 * `0600`, since a host's configuration can hold a sign-in session or a
 * token in an entry's environment, and a file that is already there keeps
 * the mode it carried.
 *
 * A file that is not there is created by a link, which refuses the path
 * another process took while this one was working rather than replacing it.
 * A file that is there is replaced against the handle over the bytes this
 * call read, so a second `saer mcp install` landing inside the same window
 * is reported rather than overwritten. A symbolic link pointing at nothing
 * is refused by the same link: the path reads as free and is not, which is
 * reported as the link it is rather than replaced with a regular file.
 */
export function installMcp(
  options: InstallOptions,
  environment: InstallEnvironment = installEnvironment(),
): CommandOutcome {
  return Either.match(reported(options, environment), {
    onLeft: (failure) => usageError(lines(...renderInstallFailure(failure))),
    onRight: (report) => succeeded(lines(...renderInstallReport(report)), ''),
  });
}

type Requested = {
  readonly options: InstallOptions;
  readonly registration: HostRegistration;
  readonly scope: HostScope;
  readonly file: HostFile;
  readonly entry: HostEntry;
  readonly snippet: string;
};

function reported(
  options: InstallOptions,
  environment: InstallEnvironment,
): Either.Either<InstallReport, InstallFailure> {
  const registration = hostRegistrations[options.host];
  const scope = scopeOf(registration, options);
  const entry = hostEntry(registration, options.file);
  return Either.flatMap(hostFile(options.host, scope, environment), (file) =>
    Either.flatMap(entryText(registration, named(file), entry), (snippet) =>
      installed({ options, registration, scope, file, entry, snippet }),
    ),
  );
}

function installed(
  requested: Requested,
): Either.Either<InstallReport, InstallFailure> {
  const reporting = (status: InstallStatus): InstallReport => ({
    host: requested.options.host,
    scope: requested.scope,
    file: named(requested.file),
    status,
    entry: requested.snippet,
  });
  return requested.options.print === true
    ? Either.right(reporting('shown'))
    : requested.file.kind === 'undocumented'
      ? Either.left(
          InstallFailure.Undocumented({
            host: requested.options.host,
            where: requested.file.where,
          }),
        )
      : Either.map(
          written(
            requested.registration,
            resolved(requested.file),
            requested.entry,
          ),
          reporting,
        );
}

function named(file: HostFile): string {
  return file.kind === 'file' ? file.file : file.where;
}

function scopeOf(
  registration: HostRegistration,
  options: InstallOptions,
): HostScope {
  return options.user === true ||
    (options.project !== true && registration.project === undefined)
    ? 'user'
    : 'project';
}

function resolved(file: NamedHostFile): WriteTarget {
  return {
    file: file.file,
    path: Either.getOrElse(
      Either.try(() => realpathSync(file.path)),
      () => file.path,
    ),
  };
}

type HeldFile =
  | { readonly kind: 'absent' }
  | {
      readonly kind: 'held';
      readonly text: string;
      readonly revision: string;
    };

function written(
  registration: HostRegistration,
  target: WriteTarget,
  entry: HostEntry,
): Either.Either<InstallStatus, InstallFailure> {
  return Either.flatMap(heldFile(target), (held) =>
    Either.flatMap(
      document(registration, target.file, textOf(held), entry),
      (merged) =>
        Either.flatMap(hostText(registration, target.file, merged), (text) =>
          text === textOf(held)
            ? Either.right<InstallStatus>('unchanged')
            : Either.map(
                saved(target, text, held),
                (): InstallStatus => 'written',
              ),
        ),
    ),
  );
}

function document(
  registration: HostRegistration,
  file: string,
  held: string,
  entry: HostEntry,
): Either.Either<HostDocument, InstallFailure> {
  return Either.flatMap(hostDocument(registration, file, held), (parsed) =>
    withRegistration(registration, file, parsed, entry),
  );
}

function textOf(held: HeldFile): string {
  return held.kind === 'held' ? held.text : '';
}

function heldFile(
  target: WriteTarget,
): Either.Either<HeldFile, InstallFailure> {
  return existsSync(target.path)
    ? Either.flatMap(
        withinReadBound(target.path, (observed) =>
          InstallFailure.TooLarge({ path: target.file, observed }),
        ),
        () => readHeld(target),
      )
    : Either.right({ kind: 'absent' });
}

function readHeld(
  target: WriteTarget,
): Either.Either<HeldFile, InstallFailure> {
  return Either.try({
    try: () => {
      const bytes = readFileSync(target.path);
      return {
        kind: 'held',
        text: bytes.toString('utf8'),
        revision: revisionOf(bytes),
      };
    },
    catch: (error) =>
      InstallFailure.Unreadable({
        path: target.file,
        reason: reasonOf(error),
      }),
  });
}

function saved(
  target: WriteTarget,
  text: string,
  held: HeldFile,
): Either.Either<string, InstallFailure> {
  return Either.mapLeft(
    Either.flatMap(directoryFor(target), () =>
      held.kind === 'held'
        ? replacedFile(target, text, held.revision, ownerOnly)
        : createdFile(target, text, ownerOnly),
    ),
    (failure) => refusedWrite(target, failure),
  );
}

function refusedWrite(
  target: WriteTarget,
  failure: WriteFailure,
): InstallFailure {
  return WriteFailure.$is('Occupied')(failure)
    ? takenPath(target)
    : WriteFailure.$is('StaleRevision')(failure)
      ? InstallFailure.Changed({ path: target.file })
      : InstallFailure.Unwritten({ failure });
}

function takenPath(target: WriteTarget): InstallFailure {
  return danglingLink(target.path)
    ? InstallFailure.DanglingLink({ path: target.file })
    : InstallFailure.Occupied({ path: target.file });
}

function danglingLink(path: string): boolean {
  return Either.getOrElse(
    Either.try(() => lstatSync(path).isSymbolicLink() && !existsSync(path)),
    () => false,
  );
}

const ownerOnly = 0o600;

function directoryFor(target: WriteTarget): Either.Either<void, WriteFailure> {
  return Either.try({
    try: () => {
      mkdirSync(dirname(target.path), { recursive: true });
    },
    catch: (error) =>
      WriteFailure.Unwritten({ file: target.file, reason: reasonOf(error) }),
  });
}
