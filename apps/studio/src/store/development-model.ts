import { parseModel, type Model } from '@panoptes/model';
import { Either } from 'effect';

declare global {
  interface Window {
    readonly panoptesDevelopmentModel?: unknown;
  }
}

/**
 * The global a development session puts a model document on before the
 * studio's own modules run. The browser suite sets it to open a real model
 * while the file dialogs are still issue #37's, and nothing in the studio
 * writes it.
 */
export const developmentModelKey = 'panoptesDevelopmentModel';

/**
 * The model the studio starts on when a development session names one, and
 * nothing otherwise, which is always the case in a production build: Vite
 * settles the flag at build time, so neither the read nor the document it
 * would read reaches a user. A document that does not parse is passed over
 * and the studio opens on its placeholder, since a reader of the page has
 * nothing to do about a fixture a spec malformed.
 */
export function developmentModel(): Model | undefined {
  if (!import.meta.env.DEV) {
    return undefined;
  }
  const injected = window[developmentModelKey];
  return injected === undefined
    ? undefined
    : Either.getOrUndefined(parseModel(injected));
}
