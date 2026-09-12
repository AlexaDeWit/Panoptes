import { drawingFace } from '@saerskriven/render/png';
import { Either } from 'effect';
import { RenderAssetFailure } from './render-assets.js';

const response = (byte: number): Response =>
  new Response(new Uint8Array([byte]));

const monoFace = 'LiberationMono-Regular.ttf';

const asked = (input: RequestInfo | URL): string =>
  input instanceof Request ? input.url : String(input);

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock('virtual:saerskriven-render-faces');
});

describe('the bytes a projection is drawn with', () => {
  it('loads every build asset once and shares the faces between the two', async () => {
    const fetchBytes = vi.fn<typeof fetch>(() => Promise.resolve(response(7)));
    vi.stubGlobal('fetch', fetchBytes);
    const loader = await import('./render-assets.js');

    const pdf = Either.getOrThrow(await loader.loadPdfAssets());
    const again = Either.getOrThrow(await loader.loadPdfAssets());
    const png = Either.getOrThrow(await loader.loadPngAssets());

    expect(pdf.wasm).toEqual(new Uint8Array([7]));
    expect(pdf.fonts).toHaveLength(5);
    expect(again.fonts).toEqual(pdf.fonts);
    expect(png.fonts).toHaveLength(5);
    expect(fetchBytes).toHaveBeenCalledTimes(7);
  });

  it('leads the rasterizer with the face the drawings are lettered in', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) =>
        Promise.resolve(response(asked(input).includes('Mono') ? 1 : 2)),
      ),
    );
    const loader = await import('./render-assets.js');

    const pdf = Either.getOrThrow(await loader.loadPdfAssets());
    const png = Either.getOrThrow(await loader.loadPngAssets());

    expect(pdf.fonts[0]).toEqual(new Uint8Array([1]));
    expect(png.fonts[0]).toEqual(new Uint8Array([2]));
  });

  it('refuses a build carrying no face to letter a drawing in, naming it', async () => {
    vi.doMock('virtual:saerskriven-render-faces', () => ({
      renderFaces: [{ name: monoFace, url: `/${monoFace}` }],
    }));
    vi.stubGlobal('fetch', () => Promise.resolve(response(3)));
    const loader = await import('./render-assets.js');

    const refused = await loader.loadPngAssets();

    expect(Either.isRight(await loader.loadPdfAssets())).toBe(true);
    expect(refused).toEqual(
      Either.left(
        RenderAssetFailure.Unavailable({
          reason: `this studio build holds no ${drawingFace}, which text is set in`,
        }),
      ),
    );
  });

  it('reports an HTTP refusal and retries on the next call', async () => {
    let refused = true;
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() =>
        Promise.resolve(
          refused ? new Response('', { status: 404 }) : response(8),
        ),
      ),
    );
    const loader = await import('./render-assets.js');

    const denied = await loader.loadPdfAssets();
    expect(Either.isLeft(denied)).toBe(true);
    if (Either.isRight(denied)) {
      throw new Error('The refused asset load unexpectedly succeeded.');
    }
    expect(denied.left.reason).toContain('answered 404.');
    refused = false;

    expect(Either.isRight(await loader.loadPdfAssets())).toBe(true);
  });

  it('reports a fetch rejection as text', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
    const loader = await import('./render-assets.js');

    expect(await loader.loadPngAssets()).toEqual(
      Either.left(RenderAssetFailure.Unavailable({ reason: 'offline' })),
    );
  });
});
