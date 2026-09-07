import { Either } from 'effect';
import { PdfAssetFailure } from './pdf-assets.js';

const response = (byte: number): Response =>
  new Response(new Uint8Array([byte]));

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadPdfAssets', () => {
  it('loads every build asset once and caches the bytes', async () => {
    const fetchBytes = vi.fn<typeof fetch>(() => Promise.resolve(response(7)));
    vi.stubGlobal('fetch', fetchBytes);
    const loader = await import('./pdf-assets.js');

    const first = Either.getOrThrow(await loader.loadPdfAssets());
    const second = Either.getOrThrow(await loader.loadPdfAssets());

    expect(first.wasm).toEqual(new Uint8Array([7]));
    expect(first.fonts).toHaveLength(5);
    expect(second).toBe(first);
    expect(fetchBytes).toHaveBeenCalledTimes(6);
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
    const loader = await import('./pdf-assets.js');

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
    const loader = await import('./pdf-assets.js');

    expect(await loader.loadPdfAssets()).toEqual(
      Either.left(PdfAssetFailure.Unavailable({ reason: 'offline' })),
    );
  });
});
