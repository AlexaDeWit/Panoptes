import {
  readAnyFormat,
  saerskrivenYamlCodec,
  threatDragonCodec,
} from '@saerskriven/formats';
import { elementPropertiesSchema } from '@saerskriven/model';
import {
  parsedFixture,
  securityModelFixture,
} from '@saerskriven/model/fixtures';
import { Either } from 'effect';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { editOf, readingOf, structuredOf, textOf } from '../fixtures.js';
import { editableTree } from './edit.fixtures.js';
import { getThreatResultSchema } from './get-threat.js';
import { searchElementsResultSchema } from './search-elements.js';
import { session, type Session } from './server.fixtures.js';

const model = parsedFixture(securityModelFixture);
const elements = model.diagrams.flatMap((diagram) => diagram.elements);
const cases = elements.map((element) => ({
  element,
  properties: elementPropertiesSchema.parse(element),
}));

for (const { format, codec } of [
  { format: 'native YAML', codec: saerskrivenYamlCodec },
  { format: 'Threat Dragon', codec: threatDragonCodec },
]) {
  describe(`MCP security properties in ${format}`, () => {
    let connected: Session;
    let root: string;
    const file = 'security.model';
    let revision: string;
    const bytes = () => readFileSync(join(root, file));
    const readDisk = () =>
      Either.getOrThrow(readAnyFormat(bytes().toString('utf8'))).model;
    const edit = async (edits: readonly unknown[]) => {
      const result = await connected.client.callTool({
        name: 'saer_edit',
        arguments: { revision, edits },
      });
      if (!result.isError) revision = editOf(result).revision;
      return result;
    };
    const detail = async (id: string) => {
      const result = await connected.client.callTool({
        name: 'saer_search_elements',
        arguments: { element: id, response_format: 'detailed' },
      });
      const found = structuredOf(result, searchElementsResultSchema);
      expect(found.counts.matched).toBe(1);
      return { row: found.elements[0], text: textOf(result) };
    };

    beforeEach(async () => {
      root = editableTree().root;
      writeFileSync(join(root, file), codec.write(model).output);
      connected = await session({ root, file });
      revision = readingOf(
        await connected.client.callTool({ name: 'saer_inspect' }),
      ).revision;
    });

    afterEach(async () => {
      await connected.end();
      rmSync(root, { recursive: true, force: true });
    });

    it.each(cases)(
      'reads every $element.kind property through the advertised result schema',
      async ({ element, properties }) => {
        const found = await detail(element.id);
        expect(found.row).toMatchObject(element);
        for (const [field, value] of Object.entries(properties).filter(
          ([key]) => key !== 'kind',
        )) {
          expect(found.text).toContain(`${field}: ${JSON.stringify(value)}`);
        }
      },
    );

    it.each(cases)(
      'creates $element.kind with its recorded properties',
      async ({ element, properties }) => {
        const id = `added-${element.id}`;
        const input =
          'position' in element
            ? { ...element, id, placement: 'auto' }
            : { ...element, id };
        const result = await edit([
          {
            op: 'add_element',
            diagram: readDisk().diagrams[0].id,
            element: input,
          },
        ]);
        expect(result.isError).toBeFalsy();
        expect((await detail(id)).row).toMatchObject({ id, ...properties });
        expect(
          readDisk()
            .diagrams.flatMap((diagram) => diagram.elements)
            .find((entry) => entry.id === id),
        ).toMatchObject(properties);
      },
    );

    it.each(cases)(
      'patches and explicitly clears $element.kind without changing its other data',
      async ({ element, properties }) => {
        const fields = Object.keys(properties).filter(
          (field) => field !== 'kind',
        );
        const changed = Object.fromEntries(
          Object.entries(properties).map(([field, value]) => [
            field,
            field === 'kind'
              ? value
              : typeof value === 'boolean'
                ? false
                : typeof value === 'string'
                  ? ''
                  : [],
          ]),
        );
        expect(
          (
            await edit([
              {
                op: 'set_element_properties',
                element: element.id,
                properties: changed,
              },
            ])
          ).isError,
        ).toBeFalsy();
        expect((await detail(element.id)).row).toMatchObject(changed);
        expect(
          (
            await edit([
              { op: 'rename_element', element: element.id, name: 'Renamed' },
            ])
          ).isError,
        ).toBeFalsy();
        expect((await detail(element.id)).row).toMatchObject(changed);
        expect(
          (
            await edit([
              {
                op: 'set_element_properties',
                element: element.id,
                properties: { kind: element.kind },
                unset: fields,
              },
            ])
          ).isError,
        ).toBeFalsy();
        const found = await detail(element.id);
        for (const field of fields) {
          expect(found.row).not.toHaveProperty(field);
          expect(found.text).not.toContain(`${field}:`);
        }
        const saved = readDisk();
        const actual = saved.diagrams
          .flatMap((diagram) => diagram.elements)
          .find((entry) => entry.id === element.id);
        for (const field of fields) expect(actual).not.toHaveProperty(field);
        expect(actual).toMatchObject({ id: element.id, name: 'Renamed' });
        expect(saved.threats).toEqual(model.threats);
        expect(saved.lastIssuedThreatNumber).toBe(model.lastIssuedThreatNumber);
      },
    );

    it('keeps omitted properties and exposes direction alongside security facts', async () => {
      expect(
        (
          await edit([
            {
              op: 'set_element_properties',
              element: 'element-order-flow',
              properties: { kind: 'flow', isEncrypted: false },
            },
          ])
        ).isError,
      ).toBeFalsy();
      const found = await detail('element-order-flow');
      expect(found.row).toMatchObject({
        isEncrypted: false,
        protocol: 'HTTPS',
        trustBoundaryIds: ['element-perimeter'],
        bidirectional: false,
      });
      expect(found.text).toContain('bidirectional: false');
    });

    it('finds protocol text and returns one exact id even when relationships name it', async () => {
      const result = await connected.client.callTool({
        name: 'saer_search_elements',
        arguments: { query: 'https', response_format: 'detailed' },
      });
      expect(
        structuredOf(result, searchElementsResultSchema).elements,
      ).toMatchObject([{ id: 'element-order-flow', protocol: 'HTTPS' }]);
      expect((await detail('element-api')).row).toMatchObject({
        privilegeLevel: '',
      });
      const concise = await connected.client.callTool({
        name: 'saer_search_elements',
        arguments: { element: 'element-api' },
      });
      expect(
        structuredOf(concise, searchElementsResultSchema).elements[0],
      ).not.toHaveProperty('privilegeLevel');
    });

    it('includes full elements when retrieving an attached threat', async () => {
      const threat = model.threats[0];
      const result = await connected.client.callTool({
        name: 'saer_get_threat',
        arguments: { ref: threat.id },
      });
      const read = structuredOf(result, getThreatResultSchema);
      const attached = elements.filter((element) =>
        threat.elements.includes(element.id),
      );
      expect(read.elements).toHaveLength(attached.length);
      for (const element of attached)
        expect(read.elements).toContainEqual(expect.objectContaining(element));
    });

    it('escapes line breaks in identities and property values', async () => {
      const id = 'element-\nisEncrypted: true';
      const privilegeLevel = 'operator\nisEncrypted: true';
      expect(
        (
          await edit([
            {
              op: 'add_element',
              diagram: readDisk().diagrams[0].id,
              element: {
                kind: 'process',
                id,
                name: 'Identity',
                placement: 'auto',
                privilegeLevel,
                isWebApplication: false,
              },
            },
          ])
        ).isError,
      ).toBeFalsy();
      const found = await detail(id);
      expect(found.row).toMatchObject({ id, privilegeLevel });
      expect(found.text).not.toContain('\nisEncrypted: true');
      expect(found.text).toContain('isWebApplication: false');
    });

    it.each([
      { properties: { kind: 'actor', providesAuthentication: true } },
      { properties: { kind: 'flow', trustBoundaryIds: ['missing'] } },
      { properties: { kind: 'flow' }, unset: ['storesCredentials'] },
      {
        properties: { kind: 'flow', isEncrypted: false },
        unset: ['isEncrypted'],
      },
    ])(
      'refuses invalid property edits without writing any of a batch: %j',
      async (input) => {
        const before = bytes();
        const result = await edit([
          {
            op: 'rename_element',
            element: 'element-api',
            name: 'Must not persist',
          },
          {
            op: 'set_element_properties',
            element: 'element-order-flow',
            ...input,
          },
        ]);
        expect(result.isError).toBe(true);
        expect(bytes()).toEqual(before);
      },
    );

    it('refuses stale revisions and preserves deletion cleanup', async () => {
      const stale = revision;
      expect(
        (
          await edit([
            {
              op: 'set_element_properties',
              element: 'element-order-flow',
              properties: { kind: 'flow', protocol: '' },
            },
          ])
        ).isError,
      ).toBeFalsy();
      const before = bytes();
      const refused = await connected.client.callTool({
        name: 'saer_edit',
        arguments: {
          revision: stale,
          edits: [
            {
              op: 'set_element_properties',
              element: 'element-order-flow',
              properties: { kind: 'flow' },
              unset: ['isEncrypted'],
            },
          ],
        },
      });
      expect(refused.isError).toBe(true);
      expect(bytes()).toEqual(before);
      expect(
        (await edit([{ op: 'remove_element', element: 'element-order-flow' }]))
          .isError,
      ).toBeFalsy();
      expect((await detail('element-perimeter')).row).toMatchObject({
        crossingFlows: [],
      });
    });
  });
}
