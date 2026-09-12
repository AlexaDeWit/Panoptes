import { Either } from 'effect';
import { ResvgFailure } from './resvg-failures.js';

export { ResvgFailure } from './resvg-failures.js';

const rendered = 0;

const wordSize = 4;

const outcomeWords = 5;

const mostEdge = 4_294_967_295;

const unreserved = 0;

const calls = ['alloc', 'dealloc', 'add_font', 'render', 'release'];

type Rasterizer = {
  readonly memory: WebAssembly.Memory;
  readonly alloc: (length: number) => number;
  readonly dealloc: (pointer: number, length: number) => void;
  readonly add_font: (pointer: number, length: number) => number;
  readonly render: (
    pointer: number,
    length: number,
    longEdge: number,
  ) => number;
  readonly release: (outcome: number) => void;
};

const modules = new WeakMap<Uint8Array, Promise<WebAssembly.Module>>();

/**
 * The bytes a rasterization runs on, because this package reads no file:
 * `wasm` is the module `nix build .#resvg-wasm` writes, and `fonts` are the
 * faces text is set in, offered to the renderer in the order they are listed.
 * A family the document names that no face carries falls back to the first.
 */
export type ResvgAssets = {
  readonly wasm: Uint8Array;
  readonly fonts: readonly Uint8Array[];
};

/** A drawing as PNG bytes, beside the pixel size it was drawn at. */
export type Raster = {
  readonly png: Uint8Array;
  readonly width: number;
  readonly height: number;
};

/**
 * Rasterizes an SVG document with caller-owned assets, scaled so its longer
 * side is `longEdge` pixels, or at the size the document names when `longEdge`
 * is 0. This returns rather than throws, {@link ResvgFailure} on the left: a
 * long edge that is not a whole number of pixels, an image past what the
 * module draws, a buffer holding no face, and a module that stopped partway
 * all arrive there.
 *
 * Each call runs its own instance of the module, so the faces one call offers
 * reach no other, and an instance that stopped partway is dropped rather than
 * called again to free what it held.
 */
export async function rasterizeSvg(
  source: string,
  assets: ResvgAssets,
  longEdge: number,
): Promise<Either.Either<Raster, ResvgFailure>> {
  if (!Number.isInteger(longEdge) || longEdge < 0 || longEdge > mostEdge) {
    return Either.left(
      ResvgFailure.Refused({
        sentence: `a long edge of ${longEdge} is not a pixel count from 0 to ${mostEdge}`,
      }),
    );
  }
  const started = await instantiated(assets);
  return Either.flatMap(started, (module) => drawn(module, source, longEdge));
}

async function instantiated(
  assets: ResvgAssets,
): Promise<Either.Either<Rasterizer, ResvgFailure>> {
  try {
    const { exports } = await WebAssembly.instantiate(
      await compiled(assets.wasm),
    );
    return rasterizes(exports)
      ? offered(exports, assets.fonts)
      : Either.left(
          ResvgFailure.Unusable({
            sentence: 'the module exports no rasterizer',
          }),
        );
  } catch (error) {
    return Either.left(ResvgFailure.Unusable({ sentence: sentenceOf(error) }));
  }
}

function rasterizes(
  exports: WebAssembly.Exports,
): exports is WebAssembly.Exports & Rasterizer {
  return (
    exports['memory'] instanceof WebAssembly.Memory &&
    calls.every((name) => typeof exports[name] === 'function')
  );
}

function compiled(wasm: Uint8Array): Promise<WebAssembly.Module> {
  const known = modules.get(wasm);
  if (known !== undefined) {
    return known;
  }
  const attempt = WebAssembly.compile(new Uint8Array(wasm)).catch(
    (error: unknown) => {
      modules.delete(wasm);
      throw error;
    },
  );
  modules.set(wasm, attempt);
  return attempt;
}

function offered(
  module: Rasterizer,
  fonts: readonly Uint8Array[],
): Either.Either<Rasterizer, ResvgFailure> {
  for (const [index, font] of fonts.entries()) {
    const pointer = handed(module, font);
    if (pointer === unreserved) {
      return Either.left(
        refusedRoom(font.length, `the font at index ${index}`),
      );
    }
    const faces = module.add_font(pointer, font.length);
    module.dealloc(pointer, font.length);
    if (faces === 0) {
      return Either.left(
        ResvgFailure.Unusable({
          sentence: `the font at index ${index} of ${fonts.length} holds no face the renderer reads`,
        }),
      );
    }
  }
  return Either.right(module);
}

function drawn(
  module: Rasterizer,
  source: string,
  longEdge: number,
): Either.Either<Raster, ResvgFailure> {
  const svg = new TextEncoder().encode(source);
  try {
    const pointer = handed(module, svg);
    if (pointer === unreserved) {
      return Either.left(refusedRoom(svg.length, 'the document'));
    }
    const outcome = module.render(pointer, svg.length, longEdge);
    const raster = read(module, outcome);
    module.release(outcome);
    module.dealloc(pointer, svg.length);
    return raster;
  } catch (error) {
    return Either.left(ResvgFailure.Unusable({ sentence: sentenceOf(error) }));
  }
}

function handed(module: Rasterizer, bytes: Uint8Array): number {
  const pointer = module.alloc(bytes.length);
  if (pointer !== unreserved) {
    new Uint8Array(module.memory.buffer, pointer, bytes.length).set(bytes);
  }
  return pointer;
}

function refusedRoom(bytes: number, what: string): ResvgFailure {
  return ResvgFailure.Unusable({
    sentence: `the module reserved none of the ${bytes} bytes ${what} needs`,
  });
}

function read(
  module: Rasterizer,
  outcome: number,
): Either.Either<Raster, ResvgFailure> {
  const words = new DataView(
    module.memory.buffer,
    outcome,
    outcomeWords * wordSize,
  );
  const status = words.getUint32(0, true);
  const width = words.getUint32(wordSize, true);
  const height = words.getUint32(2 * wordSize, true);
  const payload = words.getUint32(3 * wordSize, true);
  const length = words.getUint32(4 * wordSize, true);
  const bytes = new Uint8Array(module.memory.buffer, payload, length).slice();
  return status === rendered
    ? Either.right({ png: bytes, width, height })
    : Either.left(
        ResvgFailure.Refused({ sentence: new TextDecoder().decode(bytes) }),
      );
}

function sentenceOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
