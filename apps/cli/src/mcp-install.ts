import { WriteFailure, replacedFile, type WriteTarget } from '@saerskriven/mcp';
import { Either } from 'effect';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';
import { reasonOf } from './files.js';
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
 * carried over, a file this command cannot parse is refused with its path
 * rather than replaced, and `--print` writes nothing at all.
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

function reported(
  options: InstallOptions,
  environment: InstallEnvironment,
): Either.Either<InstallReport, InstallFailure> {
  const registration = hostRegistrations[options.host];
  const scope = scopeOf(registration, options);
  const entry = hostEntry(registration, options.file);
  const snippet = entryText(registration, entry);
  const reporting = (file: string, status: InstallStatus): InstallReport => ({
    host: options.host,
    scope,
    file,
    status,
    entry: snippet,
  });
  return Either.flatMap(hostFile(options.host, scope, environment), (file) =>
    options.print === true
      ? Either.right(reporting(named(file), 'shown'))
      : file.kind === 'undocumented'
        ? Either.left(
            InstallFailure.Undocumented({
              host: options.host,
              where: file.where,
            }),
          )
        : Either.map(
            written(registration, { file: file.file, path: file.path }, entry),
            (status) => reporting(file.file, status),
          ),
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

function written(
  registration: HostRegistration,
  target: WriteTarget,
  entry: HostEntry,
): Either.Either<InstallStatus, InstallFailure> {
  return Either.flatMap(heldText(target.path), (held) =>
    Either.flatMap(
      document(registration, target.file, held, entry),
      (merged) => {
        const text = hostText(registration, merged);
        return text === held
          ? Either.right<InstallStatus>('unchanged')
          : Either.map(saved(target, text), (): InstallStatus => 'written');
      },
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

function heldText(path: string): Either.Either<string, InstallFailure> {
  return existsSync(path)
    ? Either.try({
        try: () => readFileSync(path, 'utf8'),
        catch: (error) =>
          InstallFailure.Unreadable({ path, reason: reasonOf(error) }),
      })
    : Either.right('');
}

function saved(
  target: WriteTarget,
  text: string,
): Either.Either<string, InstallFailure> {
  return Either.mapLeft(
    Either.flatMap(directoryFor(target), () => replacedFile(target, text)),
    (failure) => InstallFailure.Unwritten({ failure }),
  );
}

function directoryFor(target: WriteTarget): Either.Either<void, WriteFailure> {
  return Either.try({
    try: () => {
      mkdirSync(dirname(target.path), { recursive: true });
    },
    catch: (error) =>
      WriteFailure.Unwritten({ file: target.file, reason: reasonOf(error) }),
  });
}
