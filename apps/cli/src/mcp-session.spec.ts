import {
  coverageResultSchema,
  dataNotInstructions,
  getThreatResultSchema,
  registerResultSchema,
  renderDiagramResultSchema,
  renderWriteFailure,
  revisionOf,
  searchElementsResultSchema,
  searchThreatsResultSchema,
  validateResultSchema,
  WriteFailure,
} from '@saerskriven/mcp';
import {
  blobsOf,
  editOf,
  eras,
  type Era,
  imagesOf,
  mediaTypesOf,
  promptProseOf,
  proseOf,
  readingOf,
  registeredPrompts,
  registeredTools,
  resourceLinksOf,
  resourceProseOf,
  structuredOf,
  textOf,
} from '@saerskriven/mcp/fixtures';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { readAnyFormat } from '@saerskriven/formats';
import { Either } from 'effect';
import { join } from 'node:path';
import {
  httpProcess,
  sessionOpeners,
  type McpSession,
  type SessionOpener,
} from './mcp-session.fixtures.js';
import {
  ran,
  repositoryRoot,
  runners,
  spawnTimeout,
  titleOf,
  type Runner,
} from './runners.fixtures.js';

const ecluse = ['mcp', '--file', 'test-data/ecluse.json'];

const ecluseBytes = readFileSync(join(repositoryRoot, 'test-data/ecluse.json'));

const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

const retitled = 'Écluse gate: a title written through saer_edit';

const scripted = async (opener: SessionOpener, runner: Runner, era: Era) => {
  const root = mkdtempSync(join(tmpdir(), 'saerskriven-cli-session-'));
  try {
    writeFileSync(join(root, 'ecluse.json'), ecluseBytes);
    const session = await opener.open(
      runner,
      ['mcp', '--root', root, '--file', 'ecluse.json'],
      era,
    );
    try {
      const run = await calls(session);
      return { ...run, onDisk: readFileSync(join(root, 'ecluse.json')) };
    } finally {
      await session.end();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const calls = async (session: McpSession) => {
  const call = (name: string, args: Record<string, unknown> = {}) =>
    session.client.callTool({ name, arguments: args });
  const inspected = await call('saer_inspect');
  const drawn = await call('saer_render_diagram');
  const searched = await call('saer_search_threats', {
    status: 'open',
    severity: 'high',
    response_format: 'detailed',
  });
  const found = structuredOf(searched, searchThreatsResultSchema).threats[0];
  const target = found?.id ?? '';
  const ref = String(found?.number ?? 0);
  const held = await call('saer_get_threat', { ref });
  const threat = structuredOf(held, getThreatResultSchema).threat;
  const revision = readingOf(inspected).revision;
  const edited = await call('saer_edit', {
    revision,
    edits: [
      {
        op: 'replace_threat',
        threat: {
          id: threat.id,
          title: retitled,
          category: threat.category,
          severity: threat.severity,
          status: 'mitigated',
          description: threat.description,
          mitigation: threat.mitigation,
          elements: threat.elements,
        },
      },
    ],
  });
  const stale = await call('saer_edit', {
    revision,
    edits: [{ op: 'set_threat_severity', threat: target, severity: 'low' }],
  });
  const reread = await call('saer_get_threat', { ref });
  const reinspected = await call('saer_inspect');
  return {
    era: session.client.getProtocolEra(),
    results: [
      inspected,
      drawn,
      searched,
      held,
      edited,
      stale,
      reread,
      reinspected,
    ],
    inspected: readingOf(inspected),
    drawn,
    searched: structuredOf(searched, searchThreatsResultSchema),
    held: threat,
    edited,
    stale,
    reread: structuredOf(reread, getThreatResultSchema).threat,
    reinspected: readingOf(reinspected),
  };
};

for (const runner of runners) {
  const register = runner.absence === undefined ? describe : describe.skip;
  for (const opener of sessionOpeners) {
    register(
      titleOf(
        runner,
        `the scripted session against saer mcp over ${opener.name}`,
      ),
      () => {
        for (const era of eras) {
          it(`inspects, draws, searches, edits a threat and reads it back in the ${era} era`, async () => {
            const run = await scripted(opener, runner, era);
            const written = editOf(run.edited);
            const [image] = imagesOf(run.drawn);
            const drawn = structuredOf(run.drawn, renderDiagramResultSchema);
            const opening = run.results.flatMap((result) =>
              proseOf(result).prose.map((text) => text.split('\n')[0]),
            );

            expect(run.era).toEqual(era);
            expect(opening.length).toBeGreaterThanOrEqual(run.results.length);
            expect(opening).toEqual(opening.map(() => dataNotInstructions));
            expect({
              file: run.inspected.file,
              format: run.inspected.format,
              revision: run.inspected.revision,
              totals: run.inspected.totals,
            }).toEqual({
              file: 'ecluse.json',
              format: 'threat-dragon',
              revision: revisionOf(ecluseBytes),
              totals: {
                diagrams: 1,
                elements: 38,
                threats: 29,
                mitigations: 0,
                assumptions: 0,
              },
            });
            expect(mediaTypesOf(run.drawn)).toEqual(['image/png']);
            expect(image?.bytes.subarray(0, 4)).toEqual(pngMagic);
            expect(Math.max(drawn.image.width, drawn.image.height)).toBe(1568);
            expect(run.searched.threats.length).toBeGreaterThan(0);
            expect(run.searched.response_format).toEqual('detailed');
            expect(
              run.searched.threats.map((row) => [row.status, row.severity]),
            ).toEqual(run.searched.threats.map(() => ['open', 'high']));
            expect(run.edited.isError).toBeFalsy();
            expect({
              file: written.file,
              format: written.format,
              applied: written.applied,
              revision: written.revision,
            }).toEqual({
              file: 'ecluse.json',
              format: 'threat-dragon',
              applied: 1,
              revision: revisionOf(run.onDisk),
            });
            expect(run.stale.isError).toBe(true);
            expect(textOf(run.stale)).toContain(
              renderWriteFailure(
                WriteFailure.StaleRevision({
                  file: 'ecluse.json',
                  quoted: run.inspected.revision,
                  found: written.revision,
                }),
              ).join('\n'),
            );
            expect(run.reread).toEqual({
              ...run.held,
              title: retitled,
              status: 'mitigated',
            });
            expect({
              revision: run.reinspected.revision,
              totals: run.reinspected.totals,
            }).toEqual({
              revision: written.revision,
              totals: run.inspected.totals,
            });
          });
        }
      },
      spawnTimeout,
    );
    register(
      titleOf(runner, `a client against saer mcp over ${opener.name}`),
      () => {
        it(
          'creates, reads, patches and clears security properties through the transport',
          async () => {
            const root = mkdtempSync(
              join(tmpdir(), 'saerskriven-mcp-properties-'),
            );
            const file = 'model.yaml';
            const session = await opener.open(runner, ['mcp', '--root', root]);
            try {
              const created = await session.client.callTool({
                name: 'saer_create',
                arguments: { file, title: 'Security properties' },
              });
              expect(created.isError).toBeFalsy();
              const revision = readingOf(
                await session.client.callTool({
                  name: 'saer_inspect',
                  arguments: { file },
                }),
              ).revision;
              const added = await session.client.callTool({
                name: 'saer_edit',
                arguments: {
                  file,
                  revision,
                  edits: [
                    { op: 'add_diagram', diagram: 'diagram', title: 'System' },
                    {
                      op: 'add_element',
                      diagram: 'diagram',
                      element: {
                        kind: 'actor',
                        id: 'caller',
                        name: 'Caller',
                        placement: 'auto',
                        providesAuthentication: false,
                      },
                    },
                    {
                      op: 'add_element',
                      diagram: 'diagram',
                      element: {
                        kind: 'trust-boundary',
                        id: 'boundary',
                        name: 'Boundary',
                        shape: {
                          kind: 'box',
                          position: { x: 0, y: 0 },
                          size: { width: 200, height: 200 },
                        },
                        containedElements: ['caller'],
                        crossingFlows: [],
                      },
                    },
                    {
                      op: 'add_element',
                      diagram: 'diagram',
                      element: {
                        kind: 'flow',
                        id: 'flow',
                        name: 'Traffic',
                        source: { kind: 'attached', element: 'caller' },
                        target: { kind: 'attached', element: 'caller' },
                        bidirectional: true,
                        protocol: '',
                        isEncrypted: false,
                        trustBoundaryIds: ['boundary'],
                      },
                    },
                  ],
                },
              });
              expect(added.isError).toBeFalsy();
              const found = await session.client.callTool({
                name: 'saer_search_elements',
                arguments: {
                  file,
                  element: 'flow',
                  response_format: 'detailed',
                },
              });
              expect(
                structuredOf(found, searchElementsResultSchema).elements,
              ).toMatchObject([
                {
                  id: 'flow',
                  protocol: '',
                  isEncrypted: false,
                  bidirectional: true,
                  trustBoundaryIds: ['boundary'],
                },
              ]);
              expect(textOf(found)).toContain('isEncrypted: false');
              const changed = await session.client.callTool({
                name: 'saer_edit',
                arguments: {
                  file,
                  revision: editOf(added).revision,
                  edits: [
                    {
                      op: 'set_element_properties',
                      element: 'flow',
                      properties: { kind: 'flow', protocol: 'HTTPS' },
                      unset: ['isEncrypted'],
                    },
                  ],
                },
              });
              expect(changed.isError).toBeFalsy();
              const saved = readFileSync(join(root, file), 'utf8');
              const model = Either.getOrThrow(readAnyFormat(saved)).model;
              const flow = model.diagrams[0].elements.find(
                (element) => element.id === 'flow',
              );
              expect(flow).toMatchObject({
                protocol: 'HTTPS',
                bidirectional: true,
                trustBoundaryIds: ['boundary'],
              });
              expect(flow).not.toHaveProperty('isEncrypted');
              const reread = await session.client.callTool({
                name: 'saer_search_elements',
                arguments: {
                  file,
                  element: 'flow',
                  response_format: 'detailed',
                },
              });
              expect(
                structuredOf(reread, searchElementsResultSchema).elements[0],
              ).toMatchObject({ protocol: 'HTTPS' });
              expect(
                structuredOf(reread, searchElementsResultSchema).elements[0],
              ).not.toHaveProperty('isEncrypted');
            } finally {
              await session.end();
              rmSync(root, { recursive: true, force: true });
            }
          },
          spawnTimeout,
        );

        it('completes discovery on the revision the split SDK negotiates', async () => {
          const session = await opener.open(runner, ecluse);
          const listed = await session.client.listTools();
          const era = session.client.getProtocolEra();
          await session.end();
          expect(era).toEqual('modern');
          expect(listed.tools.map((tool) => tool.name)).toEqual(
            registeredTools,
          );
        });

        it('serves a 2025-era client the same tool list', async () => {
          const session = await opener.open(runner, ecluse, 'legacy');
          const listed = await session.client.listTools();
          const era = session.client.getProtocolEra();
          await session.end();
          expect(era).toEqual('legacy');
          expect(listed.tools.map((tool) => tool.name)).toEqual(
            registeredTools,
          );
        });

        it('checks the Écluse fixture through saer_validate', async () => {
          const session = await opener.open(runner, ecluse);
          const result = await session.client.callTool({
            name: 'saer_validate',
          });
          await session.end();
          const checked = structuredOf(result, validateResultSchema);
          expect({
            format: checked.format,
            diverged: checked.diverged,
          }).toEqual({
            format: 'threat-dragon',
            diverged: false,
          });
        });

        it('reports coverage over the Écluse fixture', async () => {
          const session = await opener.open(runner, ecluse);
          const result = await session.client.callTool({
            name: 'saer_coverage',
          });
          await session.end();
          const reported = structuredOf(result, coverageResultSchema);
          expect(reported.perElement.length).toBe(38);
          expect(
            reported.open.reduce((total, group) => total + group.count, 0),
          ).toBeGreaterThan(0);
        });

        it('writes the register of the Écluse fixture', async () => {
          const session = await opener.open(runner, ecluse);
          const result = await session.client.callTool({
            name: 'saer_register',
          });
          await session.end();
          expect(structuredOf(result, registerResultSchema).markdown).toContain(
            'Écluse',
          );
        });

        it('searches the elements of the Écluse fixture', async () => {
          const session = await opener.open(runner, ecluse);
          const result = await session.client.callTool({
            name: 'saer_search_elements',
            arguments: { kind: 'store' },
          });
          await session.end();
          const found = structuredOf(result, searchElementsResultSchema);
          expect(found.counts.matched).toBeGreaterThan(0);
          expect(found.elements.map((row) => row.kind)).toEqual(
            found.elements.map(() => 'store'),
          );
        });

        it('refuses to draw over a file the root already holds', async () => {
          const session = await opener.open(runner, ecluse);
          const result = await session.client.callTool({
            name: 'saer_render_diagram',
            arguments: { out: 'test-data/render/ecluse.snapshot.png' },
          });
          await session.end();
          expect(result.isError).toBe(true);
          expect(resourceLinksOf(result)).toEqual([]);
          expect(textOf(result)).toContain('is already there');
        });

        it('refuses an out path that names anything but a PNG', async () => {
          const session = await opener.open(runner, ecluse);
          const result = await session.client.callTool({
            name: 'saer_render_diagram',
            arguments: { out: 'package.json' },
          });
          await session.end();
          expect(result.isError).toBe(true);
          expect(resourceLinksOf(result)).toEqual([]);
          expect(textOf(result)).toContain('does not end in .png');
        });

        it('refuses a file no format claims with the formats it tried', async () => {
          const session = await opener.open(runner, [
            'mcp',
            '--file',
            'package.json',
          ]);
          const result = await session.client.callTool({
            name: 'saer_validate',
          });
          await session.end();
          expect(result.isError).toBe(true);
          expect(textOf(result)).toContain(
            'No format claimed the file. Saerskriven tried threat-dragon, saerskriven-yaml.',
          );
        });

        it('refuses a file outside the root as a tool result', async () => {
          const session = await opener.open(runner, [
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
      },
      spawnTimeout,
    );
    register(
      titleOf(
        runner,
        `the resources and prompts of saer mcp over ${opener.name}`,
      ),
      () => {
        for (const era of eras) {
          it(`reads the register and a diagram, completes it, and renders both prompts in the ${era} era`, async () => {
            const session = await opener.open(runner, ecluse, era);
            try {
              const listed = await session.client.listResources();
              const registerRead = await session.client.readResource({
                uri: 'saer://register',
              });
              const diagram = await session.client.readResource({
                uri: 'saer://diagram/0',
              });
              const completed = await session.client.complete({
                ref: { type: 'ref/resource', uri: 'saer://diagram/{diagram}' },
                argument: { name: 'diagram', value: '' },
              });
              const prompts = await session.client.listPrompts();
              const stride = await session.client.getPrompt({
                name: 'stride_pass',
                arguments: { element: 'Écluse proxy' },
              });
              const review = await session.client.getPrompt({
                name: 'review_model',
              });
              const [image] = blobsOf(diagram);
              const opening = [
                ...resourceProseOf(registerRead).prose,
                ...resourceProseOf(diagram).prose,
                promptProseOf(stride).prose[0] ?? '',
                promptProseOf(review).prose[0] ?? '',
              ].map((text) => text.split('\n')[0]);

              expect(session.client.getProtocolEra()).toEqual(era);
              expect(listed.resources.map((resource) => resource.uri)).toEqual([
                'saer://register',
                'saer://diagram/0',
              ]);
              expect({
                ttlMs: listed.ttlMs,
                cacheScope: listed.cacheScope,
              }).toEqual(
                era === 'modern'
                  ? { ttlMs: 0, cacheScope: 'private' }
                  : { ttlMs: undefined, cacheScope: undefined },
              );
              expect(opening).toEqual(opening.map(() => dataNotInstructions));
              expect(opening.length).toBe(4);
              expect(resourceProseOf(registerRead).prose[0]).toContain(
                '# Écluse threat register',
              );
              expect(image?.mimeType).toEqual('image/png');
              expect(image?.bytes.subarray(0, 4)).toEqual(pngMagic);
              expect(completed.completion.values).toEqual(['0']);
              expect(prompts.prompts.map((prompt) => prompt.name)).toEqual(
                registeredPrompts,
              );
              expect([stride.messages.length, review.messages.length]).toEqual([
                2, 2,
              ]);
            } finally {
              await session.end();
            }
          });
        }
      },
      spawnTimeout,
    );
  }
  register(
    titleOf(runner, 'saer mcp as a process'),
    () => {
      it('leaves standard output to the protocol and exits on end of input', () => {
        const session = ran(runner, ['mcp']);
        expect({
          code: session.code,
          out: session.out.toString('utf8'),
          err: session.err.toString('utf8'),
        }).toEqual({ code: 0, out: '', err: '' });
      });

      it('keeps the HTTP token out of both streams and exits 0 on SIGTERM', async () => {
        const server = await httpProcess(runner, ecluse);
        const token = readFileSync(server.tokenFile, 'utf8');
        const mode = statSync(server.tokenFile).mode & 0o777;
        const ended = await server.stop();
        expect(token.length).toBeGreaterThan(0);
        expect(mode).toBe(0o600);
        expect({ code: ended.code, signal: ended.signal }).toEqual({
          code: 0,
          signal: null,
        });
        expect(ended.out).toEqual('');
        expect(ended.err).not.toContain(token);
      });
    },
    spawnTimeout,
  );
}
