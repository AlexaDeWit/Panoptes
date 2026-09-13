import type { Client } from '@modelcontextprotocol/client';
import {
  ProtocolError,
  type CallToolResult,
} from '@modelcontextprotocol/server';
import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import {
  editOf,
  eras,
  inspectionOf,
  ownLinkTextOf,
  promptProseOf,
  proseOf,
  readingOf,
  registeredPrompts,
  registeredTools,
  resourceProseOf,
  structuredOf,
  textOf,
  type ResultProse,
} from '../fixtures.js';
import {
  dragonFile,
  editVariants,
  editableTree,
  modelFile,
  otmFile,
  type EditInput,
} from './edit.fixtures.js';
import { editOps } from './edits.js';
import { dataNotInstructions } from './preface.js';
import { builtRasterizer, rasterizerUnbuilt } from './rasterizer.fixtures.js';
import { renderDiagramResultSchema } from './render-diagram.js';
import { revisionOf } from './revision.js';
import { noRasterizer, session, type Session } from './server.fixtures.js';
import { workspaceTree } from './workspace.fixtures.js';
import { saerskrivenYaml, treeHolding } from './read-tools.fixtures.js';

const repositoryRoot = realpathSync(join(import.meta.dirname, '../../../..'));

const ecluse = 'test-data/ecluse.json';

const tree = workspaceTree();

const rasterizer = rasterizerUnbuilt ? undefined : builtRasterizer;

const cacheFields = (result: object) => ({
  ttlMs: 'ttlMs' in result ? result.ttlMs : undefined,
  cacheScope: 'cacheScope' in result ? result.cacheScope : undefined,
});

const unheardOf = 'Unheard-of-name-Qx7';

const rejectionOf = async (call: Promise<unknown>, named: string) => {
  try {
    await call;
    return 'the call was answered';
  } catch (error) {
    return error instanceof ProtocolError
      ? {
          code: error.code,
          data: error.data,
          quotesName: error.message.includes(named),
        }
      : error;
  }
};

const staleRevision = `sha256:${'0'.repeat(64)}`;

/** One call of the table, and what a client would read back from it. */
type CalledTool = {
  readonly name: string;
  readonly read: ResultProse;
  readonly result: CallToolResult;
};

const renaming: EditInput = {
  op: 'rename_element',
  element: 'element-db',
  name: 'Order store',
};

/**
 * What every tool is called with when the suite checks the line each result
 * opens with. A tool the server offers and this table does not name fails
 * its own assertion below, so a tool taking other arguments is given them
 * rather than passed over: a call that is skipped is prose that is not
 * checked. Each row lists the branches worth reaching, an answer and a
 * refusal among them. The rows are built per run because a write quotes the
 * handle of the tree it runs against, and because every call here writes to
 * a disposable root rather than to the checkout.
 */
const callArguments = (
  revision: string,
): Map<string, readonly Record<string, unknown>[]> =>
  new Map<string, readonly Record<string, unknown>[]>([
    [
      'saer_inspect',
      [
        { file: modelFile },
        { file: dragonFile },
        { file: '../outside.yaml' },
        { file: 'absent.json' },
        {},
      ],
    ],
    [
      'saer_edit',
      [
        { file: modelFile, revision, edits: [renaming] },
        { file: modelFile, revision: staleRevision, edits: [renaming] },
      ],
    ],
    [
      'saer_create',
      [
        { file: 'started.yaml', title: 'Started' },
        { file: '../outside.yaml', title: 'Started' },
      ],
    ],
    [
      'saer_import',
      [
        { file: otmFile, target: 'converted.yaml' },
        { file: otmFile, target: modelFile },
      ],
    ],
    ['saer_validate', [{ file: modelFile }, { file: 'unclaimed.yaml' }, {}]],
    ['saer_coverage', [{ file: modelFile }, {}]],
    ['saer_register', [{ file: modelFile }, {}]],
    [
      'saer_search_elements',
      [
        { file: modelFile },
        { file: modelFile, response_format: 'detailed' },
        { file: modelFile, diagram: 'Nothing' },
      ],
    ],
    [
      'saer_search_threats',
      [
        { file: modelFile },
        { file: modelFile, response_format: 'detailed', severity: 'high' },
      ],
    ],
    [
      'saer_get_threat',
      [
        { file: modelFile, ref: '1' },
        { file: modelFile, ref: '9999' },
      ],
    ],
    [
      'saer_render_diagram',
      [
        { file: modelFile },
        { file: modelFile, diagram: 'diagram-main', out: 'drawn.png' },
      ],
    ],
  ]);

for (const era of eras) {
  describe(`a ${era} client of the server object`, () => {
    let fixture: Session;

    beforeAll(async () => {
      fixture = await session({
        root: repositoryRoot,
        file: ecluse,
        era,
        rasterizer,
      });
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
        expect((await everyTool()).map((tool) => tool.name)).toEqual(
          registeredTools,
        );
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

      it('says of every writing tool what it does to a file it is given', async () => {
        const tools = await everyTool();
        expect(
          tools
            .filter((tool) => tool.annotations?.readOnlyHint === false)
            .map((tool) => ({
              name: tool.name,
              destructiveHint: tool.annotations?.destructiveHint,
              idempotentHint: tool.annotations?.idempotentHint,
            })),
        ).toEqual([
          {
            name: 'saer_render_diagram',
            destructiveHint: false,
            idempotentHint: false,
          },
          { name: 'saer_edit', destructiveHint: true, idempotentHint: false },
          {
            name: 'saer_create',
            destructiveHint: false,
            idempotentHint: false,
          },
          {
            name: 'saer_import',
            destructiveHint: false,
            idempotentHint: false,
          },
        ]);
      });
    });

    describe('the resources and prompts a client discovers', () => {
      it('offers the prompts this release registers', async () => {
        const listed = await fixture.client.listPrompts();
        expect(
          listed.prompts.map((prompt) => [
            prompt.name,
            prompt.arguments?.map((argument) => [
              argument.name,
              argument.required,
            ]),
          ]),
        ).toEqual([
          [
            registeredPrompts[0],
            [
              ['file', false],
              ['element', true],
            ],
          ],
          [registeredPrompts[1], [['file', false]]],
        ]);
      });

      it('lists the register, every diagram and the diagram template', async () => {
        const resources = await fixture.client.listResources();
        const templates = await fixture.client.listResourceTemplates();
        expect(resources.resources.map((resource) => resource.uri)).toEqual([
          'saer://register',
          'saer://diagram/0',
        ]);
        expect(
          templates.resourceTemplates.map((template) => template.uriTemplate),
        ).toEqual(['saer://diagram/{diagram}']);
      });

      it(`carries the cache fields a ${era} client is owed on every list and read`, async () => {
        const lists = [
          await fixture.client.listTools(),
          await fixture.client.listPrompts(),
          await fixture.client.listResources(),
          await fixture.client.listResourceTemplates(),
          await fixture.client.readResource({ uri: 'saer://register' }),
        ];
        const owed =
          era === 'modern'
            ? { ttlMs: 0, cacheScope: 'private' }
            : { ttlMs: undefined, cacheScope: undefined };
        expect(lists.map(cacheFields)).toEqual(lists.map(() => owed));
      });

      it('completes the diagram argument with the ids of the model', async () => {
        const completed = await fixture.client.complete({
          ref: { type: 'ref/resource', uri: 'saer://diagram/{diagram}' },
          argument: { name: 'diagram', value: '' },
        });
        expect(completed.completion.values).toEqual(['0']);
      });

      it('opens every resource read and every prompt with the data line', async () => {
        const uris = rasterizerUnbuilt
          ? ['saer://register']
          : ['saer://register', 'saer://diagram/0'];
        const reads = await Promise.all(
          uris.map((uri) => fixture.client.readResource({ uri })),
        );
        const prompts = await Promise.all([
          fixture.client.getPrompt({
            name: 'stride_pass',
            arguments: { element: 'Écluse proxy' },
          }),
          fixture.client.getPrompt({ name: 'review_model' }),
        ]);
        const read = reads.map(resourceProseOf);
        const opened = [
          ...read.flatMap((one) => one.prose),
          ...prompts.map((one) => promptProseOf(one).prose[0] ?? ''),
        ].map((text) => text.split('\n')[0]);
        expect(read.flatMap((one) => one.unread)).toEqual([]);
        expect(opened.length).toBe(uris.length + prompts.length);
        expect(opened).toEqual(opened.map(() => dataNotInstructions));
      });

      describe.skipIf(rasterizerUnbuilt)('a diagram read by its URI', () => {
        it('draws the diagram its id names, past URI syntax and a colliding title', async () => {
          const odd = treeHolding(
            saerskrivenYaml()
              .replace('id: read-and-render', "id: '../a b/c?d#e'")
              .replace(
                'title: Reading a file and rendering it',
                'title: agent-and-desktop',
              ),
          );
          const run = await session({
            root: odd.root,
            file: 'model.yaml',
            era,
            rasterizer,
          });
          const listed = await run.client.listResources();
          const drawn = await Promise.all(
            listed.resources.slice(1).map(async ({ uri }) => {
              const read = await run.client.readResource({ uri });
              return [
                uri,
                resourceProseOf(read)
                  .prose.flatMap((text) => text.split('\n'))
                  .find((line) => line.startsWith('diagram: ')),
              ];
            }),
          );
          await run.end();
          expect(drawn).toEqual([
            [
              'saer://diagram/..%2Fa%20b%2Fc%3Fd%23e',
              'diagram: ../a b/c?d#e (agent-and-desktop)',
            ],
            [
              'saer://diagram/agent-and-desktop',
              'diagram: agent-and-desktop (Agents and the desktop shell)',
            ],
          ]);
        });
      });
    });

    describe('what a client is refused with', () => {
      it('answers a resource read with nothing to read as resource not found', async () => {
        const listing = await session({ root: repositoryRoot, era });
        const refused = await Promise.all([
          rejectionOf(
            fixture.client.readResource({
              uri: `saer://diagram/${unheardOf}`,
            }),
            unheardOf,
          ),
          rejectionOf(
            fixture.client.readResource({ uri: 'saer://diagram/%E0' }),
            '%E0',
          ),
          rejectionOf(
            listing.client.readResource({ uri: 'saer://register' }),
            'saer://register',
          ),
        ]);
        await listing.end();
        expect(refused).toEqual([
          {
            code: -32602,
            data: { uri: `saer://diagram/${unheardOf}` },
            quotesName: false,
          },
          {
            code: -32602,
            data: { uri: 'saer://diagram/%E0' },
            quotesName: false,
          },
          {
            code: -32602,
            data: { uri: 'saer://register' },
            quotesName: false,
          },
        ]);
      });

      it('answers a diagram this install cannot draw as an internal error', async () => {
        const undrawn = await session({
          root: repositoryRoot,
          file: ecluse,
          era,
          rasterizer: noRasterizer,
        });
        const refused = await rejectionOf(
          undrawn.client.readResource({ uri: 'saer://diagram/High%20Level' }),
          'High Level',
        );
        await undrawn.end();
        expect(refused).toEqual({
          code: -32603,
          data: undefined,
          quotesName: false,
        });
      });

      it('answers a prompt argument naming nothing usable as invalid params', async () => {
        const listing = await session({ root: repositoryRoot, era });
        const refused = await Promise.all([
          rejectionOf(
            fixture.client.getPrompt({
              name: 'stride_pass',
              arguments: { element: unheardOf },
            }),
            unheardOf,
          ),
          rejectionOf(
            listing.client.getPrompt({
              name: 'review_model',
              arguments: { file: unheardOf },
            }),
            unheardOf,
          ),
        ]);
        await listing.end();
        expect(refused).toEqual([
          { code: -32602, data: undefined, quotesName: false },
          { code: -32602, data: undefined, quotesName: false },
        ]);
      });
    });

    describe('the line that says a result is data', () => {
      const readingsOf = async (
        client: Client,
        revision: string,
      ): Promise<readonly CalledTool[]> => {
        const tools = (await client.listTools()).tools;
        const calls = tools.flatMap((tool) =>
          (callArguments(revision).get(tool.name) ?? []).map(
            (args) => [tool.name, args] as const,
          ),
        );
        return Promise.all(
          calls.map(async ([name, args]) => {
            const result = await client.callTool({ name, arguments: args });
            const read = proseOf(result);
            return {
              name,
              result,
              read: {
                prose: read.prose.map((text) => text.split('\n')[0] ?? ''),
                links: read.links,
                unread: read.unread,
              },
            };
          }),
        );
      };

      const overEveryCall = async (): Promise<readonly CalledTool[]> => {
        const writable = editableTree();
        const revision = revisionOf(
          readFileSync(join(writable.root, modelFile)),
        );
        const defaulted = await session({
          root: writable.root,
          file: modelFile,
          era,
          rasterizer,
        });
        const listing = await session({
          root: workspaceTree().root,
          era,
          rasterizer,
        });
        const called = [
          ...(await readingsOf(defaulted.client, revision)),
          ...(await readingsOf(listing.client, revision)),
        ];
        await defaulted.end();
        await listing.end();
        return called;
      };

      it('gives every tool the server offers a row in the call table', async () => {
        const tools = await everyTool();
        const rows = callArguments(staleRevision);
        expect(
          tools.filter((tool) => !rows.has(tool.name)).map((tool) => tool.name),
        ).toEqual([]);
      });

      it('opens every prose block of every call, default model or none', async () => {
        const called = await overEveryCall();
        const prose = called.flatMap((one) => one.read.prose);
        expect(called.flatMap((one) => one.read.unread)).toEqual([]);
        expect(prose.length).toBeGreaterThan(0);
        expect(prose).toEqual(prose.map(() => dataNotInstructions));
      });

      it('attaches a resource link from no tool but the one that draws', async () => {
        const called = await overEveryCall();
        expect(
          called
            .filter(
              (one) =>
                one.name !== 'saer_render_diagram' && one.read.links.length > 0,
            )
            .map((one) => one.name),
        ).toEqual([]);
      });

      describe.skipIf(rasterizerUnbuilt)('the link a call does attach', () => {
        it('names only the path and the picture of what was drawn', async () => {
          const called = await overEveryCall();
          const linked = called.filter((one) => one.read.links.length > 0);
          expect(linked.length).toBeGreaterThan(0);
          expect(linked.map((one) => one.read.links)).toEqual(
            linked.map((one) => ownLinkTextOf(one.result)),
          );
        });
      });
    });

    describe.skipIf(rasterizerUnbuilt)('a drawing through a client', () => {
      it('carries the picture as a block beside the text and the answer', async () => {
        const writable = editableTree();
        const run = await session({ root: writable.root, era, rasterizer });
        const result = await run.client.callTool({
          name: 'saer_render_diagram',
          arguments: { file: modelFile, diagram: 'diagram-main' },
        });
        await run.end();
        const drawn = structuredOf(result, renderDiagramResultSchema);
        expect(result.isError).toBeFalsy();
        expect(
          proseOf(result).prose.map((text) => text.split('\n')[0]),
        ).toEqual([dataNotInstructions]);
        expect(drawn.image.mimeType).toEqual('image/png');
      });

      it('names only the path and the picture in the text of a link', async () => {
        const writable = editableTree();
        const run = await session({ root: writable.root, era, rasterizer });
        const result = await run.client.callTool({
          name: 'saer_render_diagram',
          arguments: {
            file: modelFile,
            diagram: 'diagram-main',
            out: 'drawn.png',
          },
        });
        await run.end();
        expect(proseOf(result).links[0]).toEqual('drawn.png');
        expect(proseOf(result).links).toEqual(ownLinkTextOf(result));
      });
    });

    describe('every edit variant through a client', () => {
      it('applies each op the schema declares and writes a changed file', async () => {
        const writable = editableTree();
        const quoted = revisionOf(readFileSync(join(writable.root, modelFile)));
        const run = await session({ root: writable.root, era });
        const outcomes = await Promise.all(
          editVariants.map(async ({ op, edits }) => {
            const file = writable.copy(`${op}.yaml`);
            const result = await run.client.callTool({
              name: 'saer_edit',
              arguments: { file, revision: quoted, edits },
            });
            return {
              op,
              refusal: result.isError === true ? textOf(result) : undefined,
              applied: result.isError === true ? 0 : editOf(result).applied,
              changed:
                revisionOf(readFileSync(join(writable.root, file))) !== quoted,
            };
          }),
        );
        await run.end();
        expect(
          outcomes.flatMap((outcome) =>
            outcome.refusal === undefined
              ? []
              : [[outcome.op, outcome.refusal]],
          ),
        ).toEqual([]);
        expect(
          outcomes.map(({ op, applied, changed }) => ({
            op,
            applied,
            changed,
          })),
        ).toEqual(
          editVariants.map(({ op, edits }) => ({
            op,
            applied: edits.length,
            changed: true,
          })),
        );
        expect(new Set(outcomes.map((outcome) => outcome.op))).toEqual(
          new Set(editOps),
        );
      });
    });

    describe('the records a batch culls', () => {
      const batches: Record<string, readonly EditInput[]> = {
        remove_threat: [{ op: 'remove_threat', threat: 'threat-tamper-order' }],
        remove_mitigation: [
          { op: 'remove_mitigation', mitigation: 'mitigation-tls' },
        ],
        rename_element: [
          { op: 'rename_element', element: 'element-db', name: 'Orders' },
        ],
      };

      it('names what remove_threat culled, and nothing for an explicit removal or an edit that culls nothing', async () => {
        const writable = editableTree();
        const quoted = revisionOf(readFileSync(join(writable.root, modelFile)));
        const run = await session({ root: writable.root, era });
        const outcomes = await Promise.all(
          Object.entries(batches).map(async ([name, edits]) => {
            const result = await run.client.callTool({
              name: 'saer_edit',
              arguments: {
                file: writable.copy(`${name}.yaml`),
                revision: quoted,
                edits,
              },
            });
            return [
              name,
              editOf(result).culled,
              textOf(result).split('\n')[0],
            ] as const;
          }),
        );
        await run.end();
        expect(outcomes).toEqual([
          [
            'remove_threat',
            [
              { kind: 'mitigation', id: 'mitigation-tls' },
              { kind: 'assumption', id: 'assumption-managed-db' },
            ],
            dataNotInstructions,
          ],
          ['remove_mitigation', [], dataNotInstructions],
          ['rename_element', [], dataNotInstructions],
        ]);
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
