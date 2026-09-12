import { blobsOf, resourceProseOf } from '../fixtures.js';
import { dataNotInstructions, prefaced } from './preface.js';
import { builtRasterizer, rasterizerUnbuilt } from './rasterizer.fixtures.js';
import {
  answerOf,
  ecluseWorkspace,
  rootWorkspace,
  saerskrivenWorkspace,
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
} from './resources.js';
import { noRasterizer } from './server.fixtures.js';

const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

const ecluse = ecluseWorkspace();

const opening = (text: string | undefined) => text?.split('\n')[0];

describe('the register resource', () => {
  it('carries the text saer_register answers with', () => {
    expect(readRegisterResource(ecluse).contents).toEqual([
      {
        uri: 'saer://register',
        mimeType: 'text/markdown',
        text: prefaced(renderRegisterResult(answerOf(register(ecluse, {})))),
      },
    ]);
  });

  it('refuses as text where the server carries no default model', () => {
    const read = readRegisterResource(rootWorkspace());
    expect(read.contents.map((entry) => entry.mimeType)).toEqual([
      'text/plain',
    ]);
    expect(resourceProseOf(read).prose.map(opening)).toEqual([
      dataNotInstructions,
    ]);
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
    const uri = new URL('saer://diagram/..%2F..%2Fetc%2Fpasswd');
    const read = await readDiagramResource(ecluse, noRasterizer, uri, {
      diagram: '..%2F..%2Fetc%2Fpasswd',
    });
    expect(resourceProseOf(read).prose[0]).toContain(
      'holds no diagram named "../../etc/passwd"',
    );
  });

  it('refuses a name that is not percent-encoded text', async () => {
    const read = await readDiagramResource(
      ecluse,
      noRasterizer,
      new URL('saer://diagram/%E0'),
      { diagram: '%E0' },
    );
    expect(read.contents.map((entry) => entry.mimeType)).toEqual([
      'text/plain',
    ]);
    expect(resourceProseOf(read).prose[0]).toContain('not percent-encoded');
  });

  describe.skipIf(rasterizerUnbuilt)('a diagram drawn', () => {
    it('carries the PNG blob and the text of the render', async () => {
      const read = await readDiagramResource(
        ecluse,
        builtRasterizer,
        new URL('saer://diagram/0'),
        { diagram: '0' },
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
