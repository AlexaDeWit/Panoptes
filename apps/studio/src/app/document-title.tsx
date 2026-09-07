import { useEffect } from 'react';
import { showingPlaceholder, windowTitle } from '../store/selectors.js';
import { useModelStore } from '../store/store.js';

const landingTitle = 'Saerskriven: Open-source threat modelling studio';

/** Names the tab after the landing page or the model on screen. */
export function DocumentTitle() {
  const title = useModelStore((state) =>
    showingPlaceholder(state) ? landingTitle : windowTitle(state),
  );

  useEffect(() => {
    document.title = title;
  }, [title]);

  return null;
}
