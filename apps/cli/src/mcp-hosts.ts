import { escapedForTerminal, quotedForTerminal } from '@saerskriven/formats';
import { WriteFailure, renderWriteFailure, serverName } from '@saerskriven/mcp';
import { Data, Either } from 'effect';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { z } from 'zod';
import { reasonOf } from './files.js';

/** The agent hosts `saer mcp install` writes a registration for. */
export const hostNameSchema = z.enum(
  ['claude-code', 'claude-desktop', 'cursor', 'vscode', 'codex'],
  { error: 'must be claude-code, claude-desktop, cursor, vscode or codex' },
);

/** Which host a registration is for. */
export type HostName = z.infer<typeof hostNameSchema>;

/**
 * Which of a host's two files a registration goes into: the one a project
 * commits, or the one that covers every project for this user.
 */
export type HostScope = 'project' | 'user';

/**
 * Which documented layout a host's user-level file follows. `other` is every
 * platform that is neither, which for a host documenting macOS and Windows
 * alone is a file this command will not name.
 */
export type HostPlatform = 'macos' | 'windows' | 'other';

/**
 * What resolving a host's file needs: the directory a project file is
 * written under, and where this user's own configuration lives. A spec hands
 * over a temporary directory for both, so no test reads or writes the
 * machine's real configuration.
 */
export type InstallEnvironment = {
  readonly directory: string;
  readonly home: string;
  readonly platform: HostPlatform;
  readonly appData: string | undefined;
};

/** The environment this process runs in. */
export function installEnvironment(): InstallEnvironment {
  return {
    directory: process.cwd(),
    home: homedir(),
    platform: platformOf(process.platform),
    appData: process.env['APPDATA'],
  };
}

/**
 * Where a host reads a registration: a file, or the sentence naming where a
 * host keeps one whose path its documentation does not give.
 */
export type HostFile =
  | { readonly kind: 'file'; readonly file: string; readonly path: string }
  | { readonly kind: 'undocumented'; readonly where: string };

/** Which syntax a host's configuration file is written in. */
export type HostSyntax = 'json' | 'toml';

/**
 * One host's registration interface: the syntax of its file, the key its
 * table of servers hangs off, whether an entry declares its transport, the
 * project file it commits, and the user-level file it reads.
 */
export type HostRegistration = {
  readonly syntax: HostSyntax;
  readonly serversKey: string;
  readonly declaresType: boolean;
  readonly project: string | undefined;
  readonly user: (environment: InstallEnvironment) => HostFile;
};

const registeredCommand = 'saer';

/**
 * Where each host keeps a registration and under which key, read off each
 * host's own published documentation on 2026-09-12:
 *
 * - `claude-code`: `.mcp.json` in the project, `~/.claude.json` for the
 *   user, both under `mcpServers`. An entry naming no `type` is read as a
 *   stdio server.
 * - `claude-desktop`: no project file, and `claude_desktop_config.json` in
 *   the application's own directory, under `mcpServers`. That directory is
 *   documented for macOS and Windows alone.
 * - `cursor`: `.cursor/mcp.json` and `~/.cursor/mcp.json`, under
 *   `mcpServers`, with `type` declared.
 * - `vscode`: `.vscode/mcp.json` and `mcp.json` in the user profile
 *   directory, under `servers`, with `type` declared.
 * - `codex`: `.codex/config.toml`, which Codex reads for a trusted project
 *   only, and `~/.codex/config.toml`, as the TOML table `mcp_servers`.
 */
export const hostRegistrations: Record<HostName, HostRegistration> = {
  'claude-code': {
    syntax: 'json',
    serversKey: 'mcpServers',
    declaresType: false,
    project: '.mcp.json',
    user: (environment) => fileAt(join(environment.home, '.claude.json')),
  },
  'claude-desktop': {
    syntax: 'json',
    serversKey: 'mcpServers',
    declaresType: false,
    project: undefined,
    user: (environment) =>
      environment.platform === 'other'
        ? {
            kind: 'undocumented',
            where: 'the file its Settings, Developer, Edit Config button opens',
          }
        : fileAt(
            join(
              applicationDirectory(environment, 'Claude'),
              'claude_desktop_config.json',
            ),
          ),
  },
  cursor: {
    syntax: 'json',
    serversKey: 'mcpServers',
    declaresType: true,
    project: join('.cursor', 'mcp.json'),
    user: (environment) =>
      fileAt(join(environment.home, '.cursor', 'mcp.json')),
  },
  vscode: {
    syntax: 'json',
    serversKey: 'servers',
    declaresType: true,
    project: join('.vscode', 'mcp.json'),
    user: (environment) =>
      fileAt(
        join(applicationDirectory(environment, 'Code'), 'User', 'mcp.json'),
      ),
  },
  codex: {
    syntax: 'toml',
    serversKey: 'mcp_servers',
    declaresType: false,
    project: join('.codex', 'config.toml'),
    user: (environment) =>
      fileAt(join(environment.home, '.codex', 'config.toml')),
  },
};

/**
 * Why a registration was not written. `NoProjectForm` and `Undocumented` are
 * about the host: one keeps nothing a project commits, and the other keeps a
 * user-level file whose path its documentation does not name on this
 * platform. `Malformed` is a file this command will not parse, which it
 * leaves as it is rather than replacing with a document that would drop
 * whatever the parse could not read.
 */
export type InstallFailure = Data.TaggedEnum<{
  NoProjectForm: { readonly host: HostName };
  Undocumented: { readonly host: HostName; readonly where: string };
  Unreadable: { readonly path: string; readonly reason: string };
  Malformed: { readonly path: string; readonly reason: string };
  Unwritten: { readonly failure: WriteFailure };
}>;

/**
 * Constructors for {@link InstallFailure}, plus Effect's `$is` and `$match`
 * helpers.
 */
export const InstallFailure = Data.taggedEnum<InstallFailure>();

/** Why nothing was written, as the lines the command puts on standard error. */
export function renderInstallFailure(
  failure: InstallFailure,
): readonly string[] {
  return InstallFailure.$match(failure, {
    NoProjectForm: ({ host }) => [
      `${host} keeps no registration a project commits, so there is no project file to write.`,
      'Pass --user to write its user-level file, or --print to read the entry.',
    ],
    Undocumented: ({ host, where }) => [
      `The user-level file for ${host} is ${where}, and its documentation does not name that path on this platform.`,
      'Pass --print and paste the entry into the file the host opens.',
    ],
    Unreadable: ({ path, reason }) => [
      `The file ${quotedForTerminal(path)} cannot be read: ${escapedForTerminal(reason)}.`,
    ],
    Malformed: ({ path, reason }) => [
      `The file ${quotedForTerminal(path)} was left as it is: ${escapedForTerminal(reason)}.`,
      'Pass --print and add the entry by hand, or repair the file and run this again.',
    ],
    Unwritten: ({ failure: refusal }) => renderWriteFailure(refusal),
  });
}

/**
 * The file a host reads at this scope, refused where the host commits
 * nothing. A project file is named as the relative path a repository holds
 * and written under the invocation's own directory.
 */
export function hostFile(
  host: HostName,
  scope: HostScope,
  environment: InstallEnvironment,
): Either.Either<HostFile, InstallFailure> {
  const registration = hostRegistrations[host];
  return scope === 'user'
    ? Either.right(registration.user(environment))
    : registration.project === undefined
      ? Either.left(InstallFailure.NoProjectForm({ host }))
      : Either.right({
          kind: 'file',
          file: registration.project,
          path: resolve(environment.directory, registration.project),
        });
}

const stdioEntrySchema = z.object({
  command: z.string(),
  args: z.array(z.string()),
});

const declaredStdioEntrySchema = stdioEntrySchema.extend({
  type: z.literal('stdio'),
});

/**
 * What a host launches for this server, with `type` where the host's
 * interface declares the transport.
 */
export type HostEntry =
  | z.infer<typeof stdioEntrySchema>
  | z.infer<typeof declaredStdioEntrySchema>;

/**
 * The entry a host's file holds for this server. A named model file becomes
 * the server's `--file`, so a tool call that names none reads it. The command
 * is the name `saer` rather than a path, which a host resolves on PATH: an
 * absolute path would name this machine's install, and the form to reach for
 * is a file every machine commits.
 */
export function hostEntry(
  registration: HostRegistration,
  file: string | undefined,
): HostEntry {
  const args = file === undefined ? ['mcp'] : ['mcp', '--file', file];
  return registration.declaresType
    ? { type: 'stdio', command: registeredCommand, args }
    : { command: registeredCommand, args };
}

/** A host's configuration file as parsed, holding every key it held. */
export type HostDocument = Record<string, unknown>;

const documentSchema = z.record(z.string(), z.unknown());

/**
 * The document a host file holds: an empty one where the file holds nothing
 * but space, or the refusal naming the path. The parser's own message is cut
 * to its first line, since a TOML error carries a caret diagram under it.
 *
 * Nothing here is read through a schema of the host's interface. A key this
 * command does not know is data to carry over, and a strip would lose
 * another server's entry, so the only shape read is the table of keys.
 */
export function hostDocument(
  registration: HostRegistration,
  path: string,
  text: string,
): Either.Either<HostDocument, InstallFailure> {
  return text.trim() === ''
    ? Either.right({})
    : Either.flatMap(
        Either.try({
          try: () =>
            registration.syntax === 'json'
              ? (JSON.parse(text) as unknown)
              : (parseToml(text) as unknown),
          catch: (error) =>
            InstallFailure.Malformed({
              path,
              reason: `it is not valid ${registration.syntax === 'json' ? 'JSON' : 'TOML'} (${firstLine(reasonOf(error))})`,
            }),
        }),
        (parsed) =>
          tableOf(parsed, path, 'its top level is not a table of keys'),
      );
}

/**
 * The document with this server's entry under the host's own key, every
 * other key as it was. Preservation is the merge's work rather than a
 * schema's: the entry is set on the table the parse produced, and the entry
 * this server owns is replaced whole, so a field added to it by hand does
 * not survive.
 */
export function withRegistration(
  registration: HostRegistration,
  path: string,
  document: HostDocument,
  entry: HostEntry,
): Either.Either<HostDocument, InstallFailure> {
  const held = document[registration.serversKey];
  return Either.map(
    held === undefined
      ? Either.right<HostDocument>({})
      : tableOf(
          held,
          path,
          `its "${registration.serversKey}" is not a table of servers`,
        ),
    (servers) => ({
      ...document,
      [registration.serversKey]: { ...servers, [serverName]: entry },
    }),
  );
}

/** A document as the text a host file holds, ending in one newline. */
export function hostText(
  registration: HostRegistration,
  document: HostDocument,
): string {
  const text =
    registration.syntax === 'json'
      ? JSON.stringify(document, null, 2)
      : stringifyToml(document);
  return `${text.trimEnd()}\n`;
}

/** The text a host file would hold for this server and nothing else. */
export function entryText(
  registration: HostRegistration,
  entry: HostEntry,
): string {
  return hostText(registration, {
    [registration.serversKey]: { [serverName]: entry },
  });
}

function tableOf(
  value: unknown,
  path: string,
  reason: string,
): Either.Either<HostDocument, InstallFailure> {
  const parsed = documentSchema.safeParse(value);
  return parsed.success
    ? Either.right(parsed.data)
    : Either.left(InstallFailure.Malformed({ path, reason }));
}

function platformOf(platform: typeof process.platform): HostPlatform {
  return platform === 'darwin'
    ? 'macos'
    : platform === 'win32'
      ? 'windows'
      : 'other';
}

function applicationDirectory(
  environment: InstallEnvironment,
  application: string,
): string {
  return environment.platform === 'macos'
    ? join(environment.home, 'Library', 'Application Support', application)
    : environment.platform === 'windows'
      ? join(
          environment.appData ?? join(environment.home, 'AppData', 'Roaming'),
          application,
        )
      : join(environment.home, '.config', application);
}

function fileAt(path: string): HostFile {
  return { kind: 'file', file: path, path };
}

function firstLine(text: string): string {
  return text.split('\n')[0] ?? text;
}
