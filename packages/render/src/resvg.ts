import { Either } from 'effect';
import { ResvgFailure } from './resvg-failures.js';

export { ResvgFailure } from './resvg-failures.js';

const rendered = 0;

const wordSize = 4;

const outcomeWords = 5;

const calls = ['alloc', 'dealloc', 'add_font', 'render', 'release'];

type Rasterizer = {
  readonly memory: WebAssembly.Memory;
  readonly alloc: (length: number) => number;
  readonly dealloc: (pointer: number, length: number) => void;
  readonly add_font: (pointer: number, length: number) => void;
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
 * is 0. A refusal returns as {@link ResvgFailure}.
 *
 * Each call runs its own instance of the module, so the faces one call offers
 * reach no other.
 */
export async function rasterizeSvg(
  source: string,
  assets: ResvgAssets,
  longEdge: number,
): Promise<Either.Either<Raster, ResvgFailure>> {
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
    if (!rasterizes(exports)) {
      return Either.left(
        ResvgFailure.Unusable({
          sentence: 'the module exports no rasterizer',
        }),
      );
    }
    for (const font of assets.fonts) {
      offer(exports, font);
    }
    return Either.right(exports);
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

function offer(module: Rasterizer, font: Uint8Array): void {
  const pointer = handed(module, font);
  module.add_font(pointer, font.length);
  module.dealloc(pointer, font.length);
}

function drawn(
  module: Rasterizer,
  source: string,
  longEdge: number,
): Either.Either<Raster, ResvgFailure> {
  const svg = new TextEncoder().encode(source);
  const pointer = handed(module, svg);
  try {
    const outcome = module.render(pointer, svg.length, longEdge);
    try {
      return read(module, outcome);
    } finally {
      module.release(outcome);
    }
  } finally {
    module.dealloc(pointer, svg.length);
  }
}

function handed(module: Rasterizer, bytes: Uint8Array): number {
  const pointer = module.alloc(bytes.length);
  new Uint8Array(module.memory.buffer, pointer, bytes.length).set(bytes);
  return pointer;
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
