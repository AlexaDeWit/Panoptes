import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { fixtureFile } from './cli.fixtures.js';
import {
  installedIn,
  malformedJson,
  malformedToml,
  misshapenJson,
  occupiedJson,
  occupiedToml,
} from './mcp-install.fixtures.js';
import { installMcp, installOptionsSchema } from './mcp-install.js';

const directory = (): string =>
  mkdtempSync(join(tmpdir(), 'saerskriven-cli-install-'));

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
    ).toEqual({
      servers: {
        saerskriven: { type: 'stdio', command: 'saer', args: ['mcp'] },
      },
    });
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

  it('is a no-op on the run after it', () => {
    const root = directory();
    installMcp({ host: 'cursor' }, installedIn(root));
    const path = join(root, '.cursor', 'mcp.json');
    const written = readFileSync(path, 'utf8');
    const again = installMcp({ host: 'cursor' }, installedIn(root));
    expect(again.code).toEqual(0);
    expect(again.out).toContain('status: unchanged\n');
    expect(readFileSync(path, 'utf8')).toEqual(written);
  });

  it('leaves another server and an unrelated setting where they were', () => {
    const root = directory();
    const path = fixtureFile(
      root,
      join('.vscode', 'mcp.json'),
      occupiedJson('servers'),
    );
    expect(installMcp({ host: 'vscode' }, installedIn(root)).code).toEqual(0);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({
      theme: 'dark',
      servers: {
        'other-server': { command: 'other', args: ['serve'] },
        saerskriven: { type: 'stdio', command: 'saer', args: ['mcp'] },
      },
    });
  });

  it('leaves them where they were in a TOML file too', () => {
    const root = directory();
    const path = fixtureFile(root, '.codex/config.toml', occupiedToml);
    expect(installMcp({ host: 'codex' }, installedIn(root)).code).toEqual(0);
    expect(parseToml(readFileSync(path, 'utf8'))).toEqual({
      model: 'gpt-5',
      mcp_servers: {
        'other-server': { command: 'other', args: ['serve'] },
        saerskriven: { command: 'saer', args: ['mcp'] },
      },
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
