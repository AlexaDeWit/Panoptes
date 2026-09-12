import { Either } from 'effect';
import { blobsOf, resourceProseOf } from '../fixtures.js';
import { dataNotInstructions, prefaced } from './preface.js';
import { builtRasterizer, rasterizerUnbuilt } from './rasterizer.fixtures.js';
import {
  answerOf,
  ecluseWorkspace,
  rootWorkspace,
  saerskrivenWorkspace,
  saerskrivenYaml,
  treeHolding,
} from './read-tools.fixtures.js';
import { register, renderRegisterResult } from './register.js';
import {
  completedDiagrams,
  diagramResourceDescription,
  diagramResourceName,
  diagramResources,
  diagramUri,
  readDiagramResource,
  readRegisterResource,
  ResourceFailure,
} from './resources.js';
import { noRasterizer } from './server.fixtures.js';

const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

const ecluse = ecluseWorkspace();

const opening = (text: string | undefined) => text?.split('\n')[0];

describe('the register resource', () => {
  it('carries the text saer_register answers with', () => {
    expect(Either.getOrThrow(readRegisterResource(ecluse)).contents).toEqual([
      {
        uri: 'saer://register',
        mimeType: 'text/markdown',
        text: prefaced(renderRegisterResult(answerOf(register(ecluse, {})))),
      },
    ]);
  });

  it('fails with no model where the server carries no default model', () => {
    expect(readRegisterResource(rootWorkspace())).toEqual(
      Either.left(ResourceFailure.NoModel()),
    );
  });
});

describe('the diagram resources', () => {
  it("lists every diagram of the repository's own model by position", () => {
    expect(diagramResources(saerskrivenWorkspace()).resources).toEqual([
      {
        uri: 'saer://diagram/read-and-render',
        name: diagramResourceName(1),
        mimeType: 'image/png',
        description: diagramResourceDescription,
      },
      {
        uri: 'saer://diagram/agent-and-desktop',
        name: diagramResourceName(2),
        mimeType: 'image/png',
        description: diagramResourceDescription,
      },
    ]);
  });

  it('leaves out a diagram whose id a URL parser would remove', () => {
    const dotted = treeHolding(
      saerskrivenYaml().replace('id: read-and-render', "id: '.'"),
    );
    expect({
      listed: diagramResources(dotted).resources.map(
        (resource) => resource.uri,
      ),
      completed: completedDiagrams(dotted, ''),
    }).toEqual({
      listed: ['saer://diagram/agent-and-desktop'],
      completed: ['agent-and-desktop'],
    });
  });

  it('lists none where the server carries no default model', () => {
    expect(diagramResources(rootWorkspace()).resources).toEqual([]);
  });

  it('percent-encodes every character of an id that means something in a URI', () => {
    expect(diagramUri('../a b/c?d#e')).toEqual(
      'saer://diagram/..%2Fa%20b%2Fc%3Fd%23e',
    );
  });

  it('completes the diagram argument with the ids that start with what was typed', () => {
    expect(completedDiagrams(saerskrivenWorkspace(), 'agent')).toEqual([
      'agent-and-desktop',
    ]);
    expect(completedDiagrams(rootWorkspace(), '')).toEqual([]);
  });

  it('looks a decoded name up among the diagrams and reaches no path', async () => {
    const read = await readDiagramResource(
      ecluse,
      noRasterizer,
      new URL('saer://diagram/..%2F..%2Fetc%2Fpasswd'),
      { diagram: '..%2F..%2Fetc%2Fpasswd' },
    );
    expect(read).toEqual(Either.left(ResourceFailure.NoSuchDiagram()));
  });

  it('fails on a name that is not percent-encoded text', async () => {
    const read = await readDiagramResource(
      ecluse,
      noRasterizer,
      new URL('saer://diagram/%E0'),
      { diagram: '%E0' },
    );
    expect(read).toEqual(Either.left(ResourceFailure.UndecodableName()));
  });

  it('fails apart from a missing diagram where the rasterizer draws nothing', async () => {
    const read = await readDiagramResource(
      ecluse,
      noRasterizer,
      new URL('saer://diagram/0'),
      { diagram: '0' },
    );
    expect(read).toEqual(Either.left(ResourceFailure.RasterizerFailed()));
  });

  it('fails with no model where the server carries no default model', async () => {
    const read = await readDiagramResource(
      rootWorkspace(),
      noRasterizer,
      new URL('saer://diagram/0'),
      { diagram: '0' },
    );
    expect(read).toEqual(Either.left(ResourceFailure.NoModel()));
  });

  describe.skipIf(rasterizerUnbuilt)('a diagram drawn', () => {
    it('carries the PNG blob and the text of the render', async () => {
      const read = Either.getOrThrow(
        await readDiagramResource(
          ecluse,
          builtRasterizer,
          new URL('saer://diagram/0'),
          { diagram: '0' },
        ),
      );
      const [image] = blobsOf(read);
      const prose = resourceProseOf(read);
      expect(image?.mimeType).toEqual('image/png');
      expect(Buffer.from(image?.bytes ?? []).subarray(0, 4)).toEqual(pngMagic);
      expect(prose.unread).toEqual([]);
      expect(prose.prose.map(opening)).toEqual([dataNotInstructions]);
    });
  });
});
