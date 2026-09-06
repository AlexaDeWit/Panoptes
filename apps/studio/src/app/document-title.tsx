import { useEffect } from 'react';
import { windowTitle } from '../store/selectors.js';
import { useModelStore } from '../store/store.js';

const productName = 'Panoptes';

/**
 * Names the browser tab after the model on screen: the file it lives in, or
 * "Untitled" while it lives in none. It draws nothing, and it is mounted at
 * the root rather than beside the file controls so that one dispatch settles
 * the tab whatever moved the file.
 */
export function DocumentTitle() {
  const name = useModelStore(windowTitle);

  useEffect(() => {
    document.title = `${name} - ${productName}`;
  }, [name]);

  return null;
}
