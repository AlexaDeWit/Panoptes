import { Either } from 'effect';
import { join } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { installedIn } from './mcp-install.fixtures.js';
import {
  InstallFailure,
  entryText,
  hostEntry,
  hostFile,
  hostNameSchema,
  hostRegistrations,
  installEnvironment,
  renderInstallFailure,
  type HostName,
  type HostPlatform,
} from './mcp-hosts.js';

const entryOf = (host: HostName, file?: string): string =>
  Either.getOrThrow(
    entryText(
      hostRegistrations[host],
      'entry',
      hostEntry(hostRegistrations[host], file),
    ),
  );

const parsedEntry = (host: HostName, text: string): unknown =>
  hostRegistrations[host].syntax === 'json'
    ? JSON.parse(text)
    : parseToml(text);

const fileOf = (host: HostName, platform: HostPlatform = 'other') =>
  Either.getOrThrow(
    hostFile(host, 'user', installedIn('/home/alexa', platform)),
  );

const stdio = { command: 'saer', args: ['mcp'] };

const declared = { type: 'stdio', command: 'saer', args: ['mcp'] };

const documented: Record<HostName, { key: string; entry: unknown }> = {
  'claude-code': { key: 'mcpServers', entry: stdio },
  'claude-desktop': { key: 'mcpServers', entry: stdio },
  cursor: { key: 'mcpServers', entry: declared },
  vscode: { key: 'servers', entry: declared },
  codex: { key: 'mcp_servers', entry: stdio },
};

describe('the entry a host file holds', () => {
  it.each(hostNameSchema.options)(
    'reads back as the shape %s documents',
    (host) => {
      const shape = documented[host];
      expect(parsedEntry(host, entryOf(host))).toEqual({
        [shape.key]: { saerskriven: shape.entry },
      });
    },
  );

  it('writes the claude-code entry as the form a project commits', () => {
    expect(entryOf('claude-code')).toEqual(
      `{
  "mcpServers": {
    "saerskriven": {
      "command": "saer",
      "args": [
        "mcp"
      ]
    }
  }
}
`,
    );
  });

  it('declares the transport where the host asks for it', () => {
    expect(entryOf('vscode')).toEqual(
      `{
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
    );
  });

  it('writes the codex entry as a TOML table', () => {
    expect(entryOf('codex')).toEqual(
      `[mcp_servers.saerskriven]
command = "saer"
args = [ "mcp" ]
`,
    );
  });

  it('passes a named model file on as the server default', () => {
    expect(hostEntry(hostRegistrations['claude-code'], 'threats.yaml')).toEqual(
      { command: 'saer', args: ['mcp', '--file', 'threats.yaml'] },
    );
  });
});

describe('where a host reads its registration', () => {
  it.each([
    ['claude-code', 'other', join('/home/alexa', '.claude.json')],
    ['cursor', 'other', join('/home/alexa', '.cursor', 'mcp.json')],
    ['codex', 'other', join('/home/alexa', '.codex', 'config.toml')],
    [
      'claude-desktop',
      'macos',
      join(
        '/home/alexa',
        'Library',
        'Application Support',
        'Claude',
        'claude_desktop_config.json',
      ),
    ],
    [
      'claude-desktop',
      'windows',
      join(
        '/home/alexa',
        'AppData',
        'Roaming',
        'Claude',
        'claude_desktop_config.json',
      ),
    ],
    [
      'vscode',
      'other',
      join('/home/alexa', '.config', 'Code', 'User', 'mcp.json'),
    ],
  ] as readonly [HostName, HostPlatform, string][])(
    'puts the %s user-level file on %s where its documentation says',
    (host, platform, path) => {
      expect(fileOf(host, platform)).toEqual({
        kind: 'file',
        file: path,
        path,
      });
    },
  );

  it('names no user-level path for claude-desktop off its two platforms', () => {
    expect(fileOf('claude-desktop')).toEqual({
      kind: 'undocumented',
      where: 'the file its Settings, Developer, Edit Config button opens',
    });
  });

  it('resolves a project file under the directory the invocation ran in', () => {
    expect(hostFile('cursor', 'project', installedIn('/work'))).toEqual(
      Either.right({
        kind: 'file',
        file: join('.cursor', 'mcp.json'),
        path: join('/work', '.cursor', 'mcp.json'),
      }),
    );
  });

  it('refuses a user-level file where no home directory is named', () => {
    const nowhere = {
      directory: '/work',
      home: undefined,
      platform: 'other' as HostPlatform,
      appData: undefined,
    };
    expect(hostFile('cursor', 'user', nowhere)).toEqual(
      Either.left(InstallFailure.NoHome({ host: 'cursor' })),
    );
    expect(
      renderInstallFailure(InstallFailure.NoHome({ host: 'cursor' })),
    ).toEqual([
      'The user-level file for cursor sits under a home directory, and this environment names none.',
      'Set HOME, or USERPROFILE on Windows, or pass --print to read the entry.',
    ]);
  });

  it('says claude-desktop commits nothing, and what to pass instead', () => {
    const refusal = hostFile('claude-desktop', 'project', installedIn('/work'));
    expect(refusal).toEqual(
      Either.left(InstallFailure.NoProjectForm({ host: 'claude-desktop' })),
    );
    expect(
      renderInstallFailure(
        InstallFailure.NoProjectForm({ host: 'claude-desktop' }),
      ),
    ).toEqual([
      'claude-desktop keeps no registration a project commits, so there is no project file to write.',
      'Pass --user to write its user-level file, or --print to read the entry.',
    ]);
  });
});

describe('a write the host file would not take', () => {
  it('says a path taken while the run worked can be tried again', () => {
    expect(
      renderInstallFailure(InstallFailure.Occupied({ path: '.mcp.json' })),
    ).toEqual([
      'The file ".mcp.json" was taken while this run was working, so nothing was written.',
      'Run this again to add the entry to what the file holds now.',
    ]);
  });

  it('says the same of a file that changed under the run', () => {
    expect(
      renderInstallFailure(InstallFailure.Changed({ path: '.mcp.json' })),
    ).toEqual([
      'The file ".mcp.json" changed while this run was working, so nothing was written.',
      'Run this again to add the entry to what the file holds now.',
    ]);
  });
});

describe('the environment the process runs in', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads the home directory off the environment, not off the system', () => {
    vi.stubEnv('HOME', '/home/alexa');
    const environment = installEnvironment();
    expect(environment.home).toEqual('/home/alexa');
    expect(environment.directory).toEqual(process.cwd());
  });

  it('falls back to the variable Windows sets', () => {
    vi.stubEnv('HOME', '');
    vi.stubEnv('USERPROFILE', 'C:\\Users\\alexa');
    expect(installEnvironment().home).toEqual('C:\\Users\\alexa');
  });

  it('takes a variable set to nothing for one that is not set', () => {
    vi.stubEnv('HOME', '');
    vi.stubEnv('USERPROFILE', '');
    vi.stubEnv('APPDATA', '');
    const environment = installEnvironment();
    expect(environment.home).toBeUndefined();
    expect(environment.appData).toBeUndefined();
  });
});
