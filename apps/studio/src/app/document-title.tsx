import { useEffect } from 'react';
import { windowTitle } from '../store/selectors.js';
import { useModelStore } from '../store/store.js';

/**
 * Names the browser tab after the model on screen, as {@link windowTitle}
 * says it. It draws nothing, and it is mounted at the root rather than beside
 * the file controls so that one dispatch settles the tab whatever moved the
 * file.
 */
export function DocumentTitle() {
  const title = useModelStore(windowTitle);

  useEffect(() => {
    document.title = title;
  }, [title]);

  return null;
}
