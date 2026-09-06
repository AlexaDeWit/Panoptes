import { showingPlaceholder } from '../store/selectors.js';
import { useModelStore } from '../store/store.js';
import styles from './empty-state-hint.module.css';

/**
 * One line over the canvas saying what to do next, while the studio is still
 * on the model it opens with. The store answers for that
 * ([the selectors](../store/selectors.ts)), so nothing here holds a flag of
 * its own and the line goes at the first edit, the first file, and no other
 * time. It is the studio's chrome rather than part of the diagram: the canvas
 * package draws the model and nothing beside it.
 */
export function EmptyStateHint() {
  const showing = useModelStore(showingPlaceholder);
  if (!showing) {
    return null;
  }
  return (
    <p className={styles.hint} data-testid="empty-state-hint">
      Open a model, or pick a tool
    </p>
  );
}
