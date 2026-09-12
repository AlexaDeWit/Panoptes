import {
  coverageResultSchema,
  dataNotInstructions,
  getThreatResultSchema,
  registerResultSchema,
  renderDiagramResultSchema,
  revisionOf,
  searchElementsResultSchema,
  searchThreatsResultSchema,
  validateResultSchema,
} from '@saerskriven/mcp';
import {
  imagesOf,
  mediaTypesOf,
  readingOf,
  registeredTools,
  resourceLinksOf,
  structuredOf,
  textOf,
} from '@saerskriven/mcp/fixtures';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stdioSession } from './mcp-session.fixtures.js';
import {
  ran,
  repositoryRoot,
  runners,
  spawnTimeout,
  titleOf,
} from './runners.fixtures.js';

const ecluse = ['mcp', '--file', 'test-data/ecluse.json'];

const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

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
        expect(listed.tools.map((tool) => tool.name)).toEqual(registeredTools);
      });

      it('serves a 2025-era client the same tool list', async () => {
        const session = await stdioSession(runner, ecluse, 'legacy');
        const listed = await session.client.listTools();
        const era = session.client.getProtocolEra();
        await session.end();
        expect(era).toEqual('legacy');
        expect(listed.tools.map((tool) => tool.name)).toEqual(registeredTools);
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

      it('checks the Écluse fixture through saer_validate', async () => {
        const session = await stdioSession(runner, ecluse);
        const result = await session.client.callTool({
          name: 'saer_validate',
        });
        await session.end();
        const checked = structuredOf(result, validateResultSchema);
        expect({ format: checked.format, diverged: checked.diverged }).toEqual({
          format: 'threat-dragon',
          diverged: false,
        });
      });

      it('reports coverage over the Écluse fixture', async () => {
        const session = await stdioSession(runner, ecluse);
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
        const session = await stdioSession(runner, ecluse);
        const result = await session.client.callTool({
          name: 'saer_register',
        });
        await session.end();
        expect(structuredOf(result, registerResultSchema).markdown).toContain(
          'Écluse',
        );
      });

      it('searches the elements of the Écluse fixture', async () => {
        const session = await stdioSession(runner, ecluse);
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

      it('searches the threats of the Écluse fixture', async () => {
        const session = await stdioSession(runner, ecluse);
        const result = await session.client.callTool({
          name: 'saer_search_threats',
          arguments: { severity: 'high', response_format: 'detailed' },
        });
        await session.end();
        const found = structuredOf(result, searchThreatsResultSchema);
        expect(found.counts.matched).toBeGreaterThan(0);
        expect(found.threats.every((row) => row.severity === 'high')).toBe(
          true,
        );
      });

      it('reads one threat of the Écluse fixture in full', async () => {
        const session = await stdioSession(runner, ecluse);
        const result = await session.client.callTool({
          name: 'saer_get_threat',
          arguments: { ref: '1' },
        });
        await session.end();
        const read = structuredOf(result, getThreatResultSchema);
        expect(read.threat.number).toBe(1);
        expect(read.elements.map((element) => element.id)).toEqual(
          read.threat.elements,
        );
      });

      it('draws the Écluse diagram as a PNG image block and no SVG', async () => {
        const session = await stdioSession(runner, ecluse);
        const result = await session.client.callTool({
          name: 'saer_render_diagram',
        });
        await session.end();
        const drawn = structuredOf(result, renderDiagramResultSchema);
        const [image] = imagesOf(result);
        expect(result.isError).toBeFalsy();
        expect(drawn.image.mimeType).toEqual('image/png');
        expect(mediaTypesOf(result)).toEqual(['image/png']);
        expect(image?.bytes.subarray(0, 4)).toEqual(pngMagic);
        expect(Math.max(drawn.image.width, drawn.image.height)).toBe(1568);
      });

      it('refuses to draw over a file the root already holds', async () => {
        const session = await stdioSession(runner, ecluse);
        const result = await session.client.callTool({
          name: 'saer_render_diagram',
          arguments: { out: 'package.json' },
        });
        await session.end();
        expect(result.isError).toBe(true);
        expect(resourceLinksOf(result)).toEqual([]);
        expect(textOf(result)).toContain('is already there');
      });

      it('refuses a file no format claims with the formats it tried', async () => {
        const session = await stdioSession(runner, [
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
