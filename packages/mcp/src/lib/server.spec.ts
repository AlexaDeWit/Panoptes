import type { Client } from '@modelcontextprotocol/client';
import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import {
  eras,
  inspectionOf,
  proseOf,
  readingOf,
  textOf,
  type ResultProse,
} from '../fixtures.js';
import { dataNotInstructions } from './preface.js';
import { revisionOf } from './revision.js';
import { session, type Session } from './server.fixtures.js';
import { workspaceTree } from './workspace.fixtures.js';

const repositoryRoot = realpathSync(join(import.meta.dirname, '../../../..'));

const ecluse = 'test-data/ecluse.json';

const tree = workspaceTree();

/**
 * What every tool is called with when the suite checks the line each result
 * opens with. A tool the server offers and this table does not name fails
 * its own assertion below, so a tool taking other arguments is given them
 * rather than passed over: a call that is skipped is prose that is not
 * checked. Each row lists the branches worth reaching, an answer and a
 * refusal among them.
 */
const callArguments = new Map<string, readonly Record<string, unknown>[]>([
  [
    'saer_inspect',
    [
      { file: ecluse },
      { file: 'test-data/saerskriven/ecluse.yaml' },
      { file: '../outside.yaml' },
      { file: 'test-data/absent.json' },
      {},
    ],
  ],
]);

for (const era of eras) {
  describe(`a ${era} client of the server object`, () => {
    let fixture: Session;

    beforeAll(async () => {
      fixture = await session({ root: repositoryRoot, file: ecluse, era });
    });

    afterAll(async () => {
      await fixture.end();
    });

    const inspecting = () => fixture.client.callTool({ name: 'saer_inspect' });

    const everyTool = async () => (await fixture.client.listTools()).tools;

    describe('what the client discovers', () => {
      it(`opens the connection in the ${era} era`, () => {
        expect(fixture.client.getProtocolEra()).toEqual(era);
      });

      it('offers the tools this release registers', async () => {
        expect((await everyTool()).map((tool) => tool.name)).toEqual([
          'saer_inspect',
        ]);
      });

      it('prefixes every tool name with saer_', async () => {
        const tools = await everyTool();
        expect(tools.filter((tool) => !tool.name.startsWith('saer_'))).toEqual(
          [],
        );
      });

      it('advertises an object input and an object output for every tool', async () => {
        const tools = await everyTool();
        expect(
          tools.map((tool) => [tool.inputSchema.type, tool.outputSchema?.type]),
        ).toEqual(tools.map(() => ['object', 'object']));
      });

      it('closes every tool to the open world and states whether it writes', async () => {
        const tools = await everyTool();
        expect(
          tools.map((tool) => ({
            openWorldHint: tool.annotations?.openWorldHint,
            readOnlyHint: typeof tool.annotations?.readOnlyHint,
          })),
        ).toEqual(
          tools.map(() => ({ openWorldHint: false, readOnlyHint: 'boolean' })),
        );
      });
    });

    describe('the line that says a result is data', () => {
      const readingsOf = async (client: Client): Promise<ResultProse> => {
        const tools = (await client.listTools()).tools;
        const calls = tools.flatMap((tool) =>
          (callArguments.get(tool.name) ?? []).map(
            (args) => [tool.name, args] as const,
          ),
        );
        const results = await Promise.all(
          calls.map(([name, args]) =>
            client.callTool({ name, arguments: args }),
          ),
        );
        const read = results.map(proseOf);
        return {
          prose: read.flatMap((result) =>
            result.prose.map((text) => text.split('\n')[0] ?? ''),
          ),
          unread: read.flatMap((result) => result.unread),
        };
      };

      it('gives every tool the server offers a row in the call table', async () => {
        const tools = await everyTool();
        expect(
          tools
            .filter((tool) => !callArguments.has(tool.name))
            .map((tool) => tool.name),
        ).toEqual([]);
      });

      it('opens every prose block of every call, default model or none', async () => {
        const listing = await session({ root: tree.root, era });
        const read = [
          await readingsOf(fixture.client),
          await readingsOf(listing.client),
        ];
        await listing.end();
        const prose = read.flatMap((one) => one.prose);
        expect(read.flatMap((one) => one.unread)).toEqual([]);
        expect(prose.length).toBeGreaterThan(0);
        expect(prose).toEqual(prose.map(() => dataNotInstructions));
      });
    });

    describe('saer_inspect against the Ecluse fixture', () => {
      it('reports the format, the counts and the revision of the file', async () => {
        const reading = readingOf(await inspecting());
        expect({
          file: reading.file,
          format: reading.format,
          revision: reading.revision,
          diagrams: reading.diagrams,
          totals: reading.totals,
          divergences: reading.divergences,
        }).toEqual({
          file: ecluse,
          format: 'threat-dragon',
          revision: revisionOf(readFileSync(join(repositoryRoot, ecluse))),
          diagrams: [
            { id: '0', title: 'High Level', elements: 38, threats: 29 },
          ],
          totals: {
            diagrams: 1,
            elements: 38,
            threats: 29,
            mitigations: 0,
            assumptions: 0,
          },
          divergences: [],
        });
      });

      it('carries the metadata the file states, and the root it may read', async () => {
        const result = await inspecting();
        const reading = readingOf(result);
        expect({
          root: inspectionOf(result).root,
          title: reading.metadata.title,
          owner: reading.metadata.owner,
          contributors: reading.metadata.contributors,
        }).toEqual({
          root: repositoryRoot,
          title: 'Écluse',
          owner: 'Alexandra de Wit',
          contributors: ['Alexandra de Wit'],
        });
      });

      it('answers a named file and the default file alike', async () => {
        const named = await fixture.client.callTool({
          name: 'saer_inspect',
          arguments: { file: ecluse },
        });
        expect(readingOf(named)).toEqual(readingOf(await inspecting()));
      });

      it('reads the same model in the native format as that format', async () => {
        const reading = readingOf(
          await fixture.client.callTool({
            name: 'saer_inspect',
            arguments: { file: 'test-data/saerskriven/ecluse.yaml' },
          }),
        );
        expect(reading.format).toEqual('saerskriven-yaml');
      });
    });

    describe('a file outside the root', () => {
      const outside = (file: string) =>
        fixture.client.callTool({ name: 'saer_inspect', arguments: { file } });

      it('is refused as a tool result rather than as a protocol error', async () => {
        const result = await outside('../outside.yaml');
        expect(result.isError).toBe(true);
        expect(textOf(result)).toContain(
          'is outside the root this server may read',
        );
      });

      it('names where the path resolved to', async () => {
        expect(textOf(await outside('/etc/passwd'))).toContain(
          'It resolves to "/etc/passwd"',
        );
      });
    });

    describe('a server started with no default file', () => {
      it('lists the candidate models under its root', async () => {
        const listing = await session({ root: tree.root, era });
        const result = await listing.client.callTool({ name: 'saer_inspect' });
        await listing.end();
        expect(inspectionOf(result)).toEqual({
          root: realpathSync(tree.root),
          result: {
            kind: 'candidates',
            files: [
              join('nested', 'deeper.yaml'),
              'small.yaml',
              'unclaimed.yaml',
            ],
            truncated: false,
          },
        });
      });
    });
  });
}
