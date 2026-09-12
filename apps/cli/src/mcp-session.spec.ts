import { dataNotInstructions, revisionOf } from '@saerskriven/mcp';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readingOf, textOf } from '@saerskriven/mcp/fixtures';
import { stdioSession } from './mcp-session.fixtures.js';
import {
  ran,
  repositoryRoot,
  runners,
  spawnTimeout,
  titleOf,
} from './runners.fixtures.js';

const ecluse = ['mcp', '--file', 'test-data/ecluse.json'];

for (const runner of runners) {
  const register = runner.absence === undefined ? describe : describe.skip;
  register(
    titleOf(runner, 'a client against saer mcp'),
    () => {
      it('completes discovery on the revision the split SDK negotiates', async () => {
        const session = await stdioSession(runner, ecluse);
        const listed = await session.client.listTools();
        const era = session.client.getProtocolEra();
        await session.end();
        expect(era).toEqual('modern');
        expect(listed.tools.map((tool) => tool.name)).toEqual(['saer_inspect']);
      });

      it('serves a 2025-era client the same tool list', async () => {
        const session = await stdioSession(runner, ecluse, 'legacy');
        const listed = await session.client.listTools();
        const era = session.client.getProtocolEra();
        await session.end();
        expect(era).toEqual('legacy');
        expect(listed.tools.map((tool) => tool.name)).toEqual(['saer_inspect']);
      });

      it('calls saer_inspect on the Écluse fixture', async () => {
        const session = await stdioSession(runner, ecluse);
        const result = await session.client.callTool({ name: 'saer_inspect' });
        await session.end();
        const reading = readingOf(result);
        expect(result.isError).toBeFalsy();
        expect({
          file: reading.file,
          format: reading.format,
          revision: reading.revision,
          totals: reading.totals,
        }).toEqual({
          file: 'test-data/ecluse.json',
          format: 'threat-dragon',
          revision: revisionOf(
            readFileSync(join(repositoryRoot, 'test-data/ecluse.json')),
          ),
          totals: {
            diagrams: 1,
            elements: 38,
            threats: 29,
            mitigations: 0,
            assumptions: 0,
          },
        });
        expect(textOf(result).split('\n')[0]).toEqual(dataNotInstructions);
      });

      it('refuses a file outside the root as a tool result', async () => {
        const session = await stdioSession(runner, [
          'mcp',
          '--root',
          'test-data',
        ]);
        const result = await session.client.callTool({
          name: 'saer_inspect',
          arguments: { file: '../package.json' },
        });
        await session.end();
        expect(result.isError).toBe(true);
        expect(textOf(result)).toContain(
          'is outside the root this server may read',
        );
      });

      it('leaves standard output to the protocol and exits on end of input', () => {
        const session = ran(runner, ['mcp']);
        expect({
          code: session.code,
          out: session.out.toString('utf8'),
          err: session.err.toString('utf8'),
        }).toEqual({ code: 0, out: '', err: '' });
      });
    },
    spawnTimeout,
  );
}
