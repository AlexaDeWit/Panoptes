import { Component, type ReactNode } from 'react';
import styles from './error-boundary.module.css';

type BoundaryState = { readonly message: string | undefined };

/**
 * What an {@link ErrorBoundary} guards, and what its control does. `reload`
 * is the studio starting again, which is a page load in a browser and is
 * taken as a prop so a spec can watch it without a window moving.
 */
export type ErrorBoundaryProps = {
  readonly children: ReactNode;
  readonly reload?: () => void;
};

function reloadPage(): void {
  globalThis.location.reload();
}

/**
 * The last stop for a throw from anywhere below it. Nothing in the studio
 * uses a throw as an error channel, so what reaches here is a defect rather
 * than a refusal a view was meant to render: the whole tree below is gone,
 * and this shows what was thrown and offers the reload that starts again
 * from the file on disk.
 *
 * It is a class because React offers no other way to catch a render error,
 * and it holds the one piece of state a component here is allowed to hold
 * for the same reason. Everything else about the studio's state lives in the
 * store.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  BoundaryState
> {
  override state: BoundaryState = { message: undefined };

  static getDerivedStateFromError(cause: unknown): BoundaryState {
    return {
      message: cause instanceof Error ? cause.message : String(cause),
    };
  }

  override render(): ReactNode {
    const { message } = this.state;
    if (message === undefined) {
      return this.props.children;
    }

    return (
      <section aria-label="Panoptes stopped" className={styles.stopped}>
        <h1 className={styles.headline}>Panoptes stopped</h1>
        <p>
          The studio ran into something it has no handling for, so what was on
          screen is gone. Reloading starts again from the file on disk, and
          anything unsaved is not in it.
        </p>
        <p className={styles.detail}>{message}</p>
        <button
          className={styles.reload}
          onClick={this.props.reload ?? reloadPage}
          type="button"
        >
          Reload the studio
        </button>
      </section>
    );
  }
}
