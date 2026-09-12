import { readLimits } from '@saerskriven/formats';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { fixtureFile } from './cli.fixtures.js';
import type { HostPlatform, HostSyntax } from './mcp-hosts.js';
import {
  installedIn,
  malformedJson,
  malformedToml,
  misshapenJson,
  occupiedJson,
  occupiedToml,
} from './mcp-install.fixtures.js';
import {
  installMcp,
  installOptionsSchema,
  type InstallOptions,
} from './mcp-install.js';

const directory = (): string =>
  mkdtempSync(join(tmpdir(), 'saerskriven-cli-install-'));

const parsedAs = (syntax: HostSyntax, text: string): unknown =>
  syntax === 'json' ? JSON.parse(text) : parseToml(text);

const stdio = { command: 'saer', args: ['mcp'] };

const declared = { type: 'stdio', command: 'saer', args: ['mcp'] };

const otherServer = { command: 'other', args: ['serve'] };

const claudeCodeEntry = `{
  "mcpServers": {
    "saerskriven": {
      "command": "saer",
      "args": [
        "mcp"
      ]
    }
  }
}`;

type HostCase = {
  readonly name: string;
  readonly options: InstallOptions;
  readonly platform: HostPlatform;
  readonly syntax: HostSyntax;
  readonly file: string;
  readonly held: string;
  readonly holds: unknown;
};

const hostCases: readonly HostCase[] = [
  {
    name: 'claude-code, in the file a project commits',
    options: { host: 'claude-code' },
    platform: 'other',
    syntax: 'json',
    file: '.mcp.json',
    held: occupiedJson('mcpServers'),
    holds: {
      theme: 'dark',
      mcpServers: { 'other-server': otherServer, saerskriven: stdio },
    },
  },
  {
    name: 'claude-desktop, in the file it keeps for this user',
    options: { host: 'claude-desktop', user: true },
    platform: 'macos',
    syntax: 'json',
    file: join(
      'Library',
      'Application Support',
      'Claude',
      'claude_desktop_config.json',
    ),
    held: occupiedJson('mcpServers'),
    holds: {
      theme: 'dark',
      mcpServers: { 'other-server': otherServer, saerskriven: stdio },
    },
  },
  {
    name: 'cursor, declaring the transport it asks for',
    options: { host: 'cursor' },
    platform: 'other',
    syntax: 'json',
    file: join('.cursor', 'mcp.json'),
    held: occupiedJson('mcpServers'),
    holds: {
      theme: 'dark',
      mcpServers: { 'other-server': otherServer, saerskriven: declared },
    },
  },
  {
    name: 'vscode, under the key it keeps servers on',
    options: { host: 'vscode' },
    platform: 'other',
    syntax: 'json',
    file: join('.vscode', 'mcp.json'),
    held: occupiedJson('servers'),
    holds: {
      theme: 'dark',
      servers: { 'other-server': otherServer, saerskriven: declared },
    },
  },
  {
    name: 'codex, as a table in its TOML configuration',
    options: { host: 'codex' },
    platform: 'other',
    syntax: 'toml',
    file: join('.codex', 'config.toml'),
    held: occupiedToml,
    holds: {
      model: 'gpt-5',
      mcp_servers: { 'other-server': otherServer, saerskriven: stdio },
    },
  },
];

describe('an entry the command only shows', () => {
  it('prints the project form, and writes nothing at all', () => {
    const root = directory();
    expect(
      installMcp({ host: 'claude-code', print: true }, installedIn(root)),
    ).toEqual({
      code: 0,
      out: `host: claude-code
scope: project
file: .mcp.json
status: shown
entry:
${claudeCodeEntry}
`,
      err: '',
    });
    expect(existsSync(join(root, '.mcp.json'))).toEqual(false);
  });

  it('shows the project entry where no home directory is named at all', () => {
    const outcome = installMcp(
      { host: 'claude-code', print: true },
      {
        directory: directory(),
        home: undefined,
        platform: 'other',
        appData: undefined,
      },
    );
    expect(outcome.code).toEqual(0);
    expect(outcome.out).toContain('status: shown\n');
  });

  it('names the model file the server reads where a tool call names none', () => {
    const outcome = installMcp(
      { host: 'codex', file: 'threat-model.yaml', print: true },
      installedIn(directory()),
    );
    expect(outcome.out).toEqual(
      `host: codex
scope: project
file: ${join('.codex', 'config.toml')}
status: shown
entry:
[mcp_servers.saerskriven]
command = "saer"
args = [ "mcp", "--file", "threat-model.yaml" ]
`,
    );
  });

  it('shows the entry for a host whose file it will not name', () => {
    const outcome = installMcp(
      { host: 'claude-desktop', print: true },
      installedIn(directory()),
    );
    expect(outcome.code).toEqual(0);
    expect(outcome.out).toContain(
      'file: the file its Settings, Developer, Edit Config button opens\n',
    );
    expect(outcome.out).toContain('scope: user\n');
  });
});

describe('a registration written to a host file', () => {
  it.each(hostCases)(
    'carries over what $name already held, and writes nothing on the run after',
    (host) => {
      const root = directory();
      const path = fixtureFile(root, host.file, host.held);
      const environment = installedIn(root, host.platform);
      const written = installMcp(host.options, environment);
      expect(written.code).toEqual(0);
      expect(written.out).toContain('status: written\n');
      expect(parsedAs(host.syntax, readFileSync(path, 'utf8'))).toEqual(
        host.holds,
      );
      const bytes = readFileSync(path, 'utf8');
      const again = installMcp(host.options, environment);
      expect(again.code).toEqual(0);
      expect(again.out).toContain('status: unchanged\n');
      expect(readFileSync(path, 'utf8')).toEqual(bytes);
    },
  );

  it('writes the project file, saying what went where', () => {
    const root = directory();
    const outcome = installMcp({ host: 'vscode' }, installedIn(root));
    expect(outcome).toEqual({
      code: 0,
      out: `host: vscode
scope: project
file: ${join('.vscode', 'mcp.json')}
status: written
entry:
{
  "servers": {
    "saerskriven": {
      "type": "stdio",
      "command": "saer",
      "args": [
        "mcp"
      ]
    }
  }
}
`,
      err: '',
    });
    expect(
      JSON.parse(readFileSync(join(root, '.vscode', 'mcp.json'), 'utf8')),
    ).toEqual({ servers: { saerskriven: declared } });
  });

  it('writes the user-level file where the scope asks for it', () => {
    const root = directory();
    const outcome = installMcp(
      { host: 'claude-code', user: true },
      installedIn(root),
    );
    expect(outcome.out).toContain(`file: ${join(root, '.claude.json')}\n`);
    expect(outcome.out).toContain('status: written\n');
    expect(existsSync(join(root, '.mcp.json'))).toEqual(false);
  });

  it('keeps a file it creates to its own user', () => {
    const root = directory();
    installMcp({ host: 'claude-code', user: true }, installedIn(root));
    expect(statSync(join(root, '.claude.json')).mode & 0o777).toEqual(0o600);
  });

  it('leaves the permissions of a file that is already there', () => {
    const root = directory();
    const path = fixtureFile(root, '.mcp.json', occupiedJson('mcpServers'));
    chmodSync(path, 0o644);
    installMcp({ host: 'claude-code' }, installedIn(root));
    expect(statSync(path).mode & 0o777).toEqual(0o644);
  });

  it('writes through a symbolic link rather than over it', () => {
    const root = directory();
    const linked = fixtureFile(
      root,
      join('dotfiles', 'mcp.json'),
      occupiedJson('mcpServers'),
    );
    symlinkSync(linked, join(root, '.mcp.json'));
    expect(installMcp({ host: 'claude-code' }, installedIn(root)).code).toEqual(
      0,
    );
    expect(lstatSync(join(root, '.mcp.json')).isSymbolicLink()).toEqual(true);
    expect(JSON.parse(readFileSync(linked, 'utf8'))).toEqual({
      theme: 'dark',
      mcpServers: { 'other-server': otherServer, saerskriven: stdio },
    });
  });
});

describe('a host file the command will not write', () => {
  it.each([
    ['.mcp.json', malformedJson, 'claude-code', 'it is not valid JSON'],
    ['.codex/config.toml', malformedToml, 'codex', 'it is not valid TOML'],
    [
      '.mcp.json',
      misshapenJson,
      'claude-code',
      'its "mcpServers" is not a table of servers',
    ],
  ] as const)(
    'refuses %s, naming it and leaving it alone',
    (name, text, host, reason) => {
      const root = directory();
      const path = fixtureFile(root, name, text);
      const outcome = installMcp({ host }, installedIn(root));
      expect(outcome.code).toEqual(2);
      expect(outcome.out).toEqual('');
      expect(outcome.err).toContain(
        `The file "${name}" was left as it is: ${reason}`,
      );
      expect(readFileSync(path, 'utf8')).toEqual(text);
    },
  );

  it('refuses a file past the bound every foreign text is read within', () => {
    const root = directory();
    fixtureFile(root, '.mcp.json', ' '.repeat(readLimits.maxTextBytes + 1));
    const outcome = installMcp({ host: 'claude-code' }, installedIn(root));
    expect(outcome.code).toEqual(2);
    expect(outcome.err).toContain(
      `is ${String(readLimits.maxTextBytes + 1)} bytes, past the ${String(readLimits.maxTextBytes)} a read is bounded to`,
    );
  });

  it('reports a target whose bytes it cannot read', () => {
    const root = directory();
    mkdirSync(join(root, '.mcp.json'));
    const outcome = installMcp({ host: 'claude-code' }, installedIn(root));
    expect(outcome.code).toEqual(2);
    expect(outcome.err).toContain('The file ".mcp.json" cannot be read: ');
  });

  it('reports a directory it cannot make, and writes nothing', () => {
    const root = directory();
    fixtureFile(root, '.cursor', 'a file where the directory goes\n');
    const outcome = installMcp({ host: 'cursor' }, installedIn(root));
    expect(outcome.code).toEqual(2);
    expect(outcome.err).toContain(
      `The file "${join('.cursor', 'mcp.json')}" was not written: `,
    );
  });

  it('refuses the user-level file of a host whose path it cannot name', () => {
    const root = directory();
    const outcome = installMcp(
      { host: 'claude-desktop', user: true },
      installedIn(root),
    );
    expect(outcome.code).toEqual(2);
    expect(outcome.err).toEqual(
      'The user-level file for claude-desktop is the file its Settings, Developer, Edit Config button opens, and its documentation does not name that path on this platform.\nPass --print and paste the entry into the file the host opens.\n',
    );
  });

  it('refuses a user-level file where no home directory is named', () => {
    const outcome = installMcp(
      { host: 'cursor', user: true },
      {
        directory: directory(),
        home: undefined,
        platform: 'other',
        appData: undefined,
      },
    );
    expect(outcome.code).toEqual(2);
    expect(outcome.err).toContain(
      'sits under a home directory, and this environment names none.',
    );
  });
});

describe('what the install subcommand is given', () => {
  it('refuses a scope naming both files', () => {
    const parsed = installOptionsSchema.safeParse({
      host: 'cursor',
      project: true,
      user: true,
    });
    expect(parsed.success).toEqual(false);
    expect(parsed.error?.issues[0]?.path).toEqual(['project']);
  });

  it('refuses a host it does not know', () => {
    const parsed = installOptionsSchema.safeParse({ host: 'emacs' });
    expect(parsed.error?.issues[0]?.message).toEqual(
      'must be claude-code, claude-desktop, cursor, vscode or codex',
    );
  });
});
