import type { PdfAssets } from '@saerskriven/render/pdf';
import { drawingFace, ledBy } from '@saerskriven/render/png';
import type { ResvgAssets } from '@saerskriven/render/resvg';
import { Data, Either } from 'effect';
import resvgWasmUrl from 'virtual:saerskriven-resvg-wasm?url';
import { renderFaces } from 'virtual:saerskriven-render-faces';
import typstWasmUrl from 'virtual:saerskriven-typst-wasm?url';

/** Why the browser could not load the bytes a projection is drawn with. */
export type RenderAssetFailure = Data.TaggedEnum<{
  Unavailable: { readonly reason: string };
}>;

/** Constructors for {@link RenderAssetFailure}. */
export const RenderAssetFailure = Data.taggedEnum<RenderAssetFailure>();

type Assets = {
  readonly wasm: Uint8Array;
  readonly fonts: readonly Uint8Array[];
};

type Face = {
  readonly name: string;
  readonly bytes: Uint8Array;
};

type Loaded<Value> = () => Promise<Either.Either<Value, RenderAssetFailure>>;

const subject = 'this studio build';

/**
 * The Typst compiler module and the faces, in the order the compiler is given
 * them in. The bytes are fetched once per session and shared with
 * {@link loadPngAssets}, which reads the same faces.
 */
export function loadPdfAssets(): Promise<
  Either.Either<PdfAssets, RenderAssetFailure>
> {
  return assembled(typstModule, (faces) => Either.right(faces));
}

/**
 * The rasterizer module and the faces, led by the face the drawings are
 * lettered in. Handed the compiler's order instead, which leads with the Mono
 * face, a diagram comes out in Liberation Mono, so a build not carrying that
 * face is refused rather than drawn in whichever family came first.
 */
export function loadPngAssets(): Promise<
  Either.Either<ResvgAssets, RenderAssetFailure>
> {
  return assembled(resvgModule, (faces) =>
    ledBy(faces, (face) => face.name, drawingFace, subject),
  );
}

const faces: Loaded<readonly Face[]> = once(() =>
  guarded(() =>
    Promise.all(
      renderFaces.map(async (face) => ({
        name: face.name,
        bytes: await fetchBytes(face.url),
      })),
    ),
  ),
);

const typstModule: Loaded<Uint8Array> = once(() =>
  guarded(() => fetchBytes(typstWasmUrl)),
);

const resvgModule: Loaded<Uint8Array> = once(() =>
  guarded(() => fetchBytes(resvgWasmUrl)),
);

async function assembled(
  module: Loaded<Uint8Array>,
  lettered: (faces: readonly Face[]) => Either.Either<readonly Face[], string>,
): Promise<Either.Either<Assets, RenderAssetFailure>> {
  const [wasm, loaded] = await Promise.all([module(), faces()]);
  if (Either.isLeft(wasm)) {
    return Either.left(wasm.left);
  }
  if (Either.isLeft(loaded)) {
    return Either.left(loaded.left);
  }
  return Either.mapBoth(lettered(loaded.right), {
    onLeft: (reason) => RenderAssetFailure.Unavailable({ reason }),
    onRight: (ordered) => ({
      wasm: wasm.right,
      fonts: ordered.map((face) => face.bytes),
    }),
  });
}

function once<Value>(load: Loaded<Value>): Loaded<Value> {
  let held: Value | undefined;
  let loading: Promise<Either.Either<Value, RenderAssetFailure>> | undefined;
  return async () => {
    if (held !== undefined) {
      return Either.right(held);
    }
    loading ??= load();
    const outcome = await loading;
    if (Either.isRight(outcome)) {
      held = outcome.right;
    } else {
      loading = undefined;
    }
    return outcome;
  };
}

async function guarded<Value>(
  work: () => Promise<Value>,
): Promise<Either.Either<Value, RenderAssetFailure>> {
  try {
    return Either.right(await work());
  } catch (cause) {
    return Either.left(
      RenderAssetFailure.Unavailable({
        reason: cause instanceof Error ? cause.message : String(cause),
      }),
    );
  }
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} answered ${String(response.status)}.`);
  }
  return new Uint8Array(await response.arrayBuffer());
}
