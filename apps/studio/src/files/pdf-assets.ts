import type { PdfAssets } from '@saerskriven/render/pdf';
import { Data, Either } from 'effect';
import { typstFontUrls } from 'virtual:saerskriven-typst-assets';
import typstWasmUrl from 'virtual:saerskriven-typst-wasm?url';

/** Why the browser could not load the bytes needed to compile a PDF. */
export type PdfAssetFailure = Data.TaggedEnum<{
  Unavailable: { readonly reason: string };
}>;

/** Constructors for {@link PdfAssetFailure}. */
export const PdfAssetFailure = Data.taggedEnum<PdfAssetFailure>();

let loaded: PdfAssets | undefined;
let loading: Promise<Either.Either<PdfAssets, PdfAssetFailure>> | undefined;

/** The build-time Typst assets, fetched once and returned as bytes. */
export async function loadPdfAssets(): Promise<
  Either.Either<PdfAssets, PdfAssetFailure>
> {
  if (loaded !== undefined) {
    return Either.right(loaded);
  }
  loading ??= fetchAssets();
  const result = await loading;
  if (Either.isRight(result)) {
    loaded = result.right;
  } else {
    loading = undefined;
  }
  return result;
}

async function fetchAssets(): Promise<
  Either.Either<PdfAssets, PdfAssetFailure>
> {
  try {
    const [wasm, ...fonts] = await Promise.all(
      [typstWasmUrl, ...typstFontUrls].map(fetchBytes),
    );
    return Either.right({ wasm, fonts });
  } catch (cause) {
    return Either.left(
      PdfAssetFailure.Unavailable({
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
