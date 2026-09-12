import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { builtRasterizer, rasterizerUnbuilt } from './rasterizer.fixtures.js';
import {
  answerOf,
  drawableTree,
  ecluseWorkspace,
  refusalOf,
  rootWorkspace,
} from './read-tools.fixtures.js';
import { renderDiagram } from './render-diagram.js';
import { noRasterizer } from './server.fixtures.js';

const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

const ecluse = ecluseWorkspace();

const saerskriven = 'threat-modelling/saerskriven.yaml';

describe('what saer_render_diagram refuses', () => {
  it('names the reason where this install carries no rasterizer', async () => {
    expect(
      refusalOf(await renderDiagram(ecluse, noRasterizer, {}))[0],
    ).toContain('cannot draw a PNG');
  });

  it('asks for a diagram where the model holds several', async () => {
    const refused = refusalOf(
      await renderDiagram(rootWorkspace(), noRasterizer, {
        file: saerskriven,
      }),
    );
    expect(refused[0]).toContain('holds several diagrams');
    expect(refused.slice(1).join('\n')).toContain('read-and-render');
  });

  it('refuses a diagram the model does not hold', async () => {
    expect(
      refusalOf(
        await renderDiagram(ecluse, noRasterizer, { diagram: 'Nothing' }),
      )[0],
    ).toContain('holds no diagram named "Nothing"');
  });

  it('refuses an out path that leaves the root before it draws', async () => {
    expect(
      refusalOf(
        await renderDiagram(ecluse, noRasterizer, {
          out: '../escaped.png',
        }),
      )[0],
    ).toContain('is outside the root this server may read');
  });
});

describe.skipIf(rasterizerUnbuilt)('what saer_render_diagram draws', () => {
  it('answers with the bytes of a PNG and never an SVG', async () => {
    const drawn = answerOf(await renderDiagram(ecluse, builtRasterizer, {}));
    const [image] = drawn.blocks;
    expect(drawn.answer.image.mimeType).toEqual('image/png');
    expect(image?.type).toEqual('image');
    expect(
      image?.type === 'image'
        ? Buffer.from(image.data, 'base64').subarray(0, 4)
        : Buffer.alloc(0),
    ).toEqual(pngMagic);
  });

  it('declares PNG on every block it carries, and never SVG', async () => {
    const drawn = answerOf(
      await renderDiagram(drawableTree(), builtRasterizer, {
        out: 'diagram.png',
        width: 320,
      }),
    );
    expect(
      drawn.blocks.map((block) =>
        block.type === 'image' || block.type === 'resource_link'
          ? block.mimeType
          : block.type,
      ),
    ).toEqual(['image/png', 'image/png']);
  });

  it('draws the long edge at the width a call names', async () => {
    const drawn = answerOf(
      await renderDiagram(ecluse, builtRasterizer, { width: 640 }),
    );
    expect(Math.max(drawn.answer.image.width, drawn.answer.image.height)).toBe(
      640,
    );
  });

  it('draws the diagram a call names out of a model holding several', async () => {
    const drawn = answerOf(
      await renderDiagram(rootWorkspace(), builtRasterizer, {
        file: saerskriven,
        diagram: 'read-and-render',
        width: 320,
      }),
    );
    expect(drawn.answer.diagram.id).toEqual('read-and-render');
  });

  it('writes the file an out path names and links to it', async () => {
    const workspace = drawableTree();
    const drawn = answerOf(
      await renderDiagram(workspace, builtRasterizer, {
        out: 'diagram.png',
        width: 320,
      }),
    );
    const [, link] = drawn.blocks;
    expect(drawn.answer.written?.file).toEqual('diagram.png');
    expect(link?.type).toEqual('resource_link');
    expect(
      readFileSync(join(workspace.root, 'diagram.png')).subarray(0, 4),
    ).toEqual(pngMagic);
  });

  it('refuses an out path already holding a file rather than replacing it', async () => {
    const workspace = drawableTree();
    writeFileSync(join(workspace.root, 'taken.png'), 'not a picture');
    const refused = refusalOf(
      await renderDiagram(workspace, builtRasterizer, {
        out: 'taken.png',
        width: 320,
      }),
    );
    expect(refused[0]).toContain('is already there');
    expect(readFileSync(join(workspace.root, 'taken.png'), 'utf8')).toEqual(
      'not a picture',
    );
  });

  it('leaves no file behind where a call names no out path', async () => {
    const workspace = drawableTree();
    await renderDiagram(workspace, builtRasterizer, { width: 320 });
    expect(existsSync(join(workspace.root, 'diagram.png'))).toBe(false);
  });
});
