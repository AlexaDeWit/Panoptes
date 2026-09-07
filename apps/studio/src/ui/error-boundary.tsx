import { Component, type ReactNode } from 'react';
import styles from './error-boundary.module.css';

type BoundaryState = { readonly message: string | undefined };

/** The guarded content and an injectable page reload for specs. */
export type ErrorBoundaryProps = {
  readonly children: ReactNode;
  readonly reload?: () => void;
};

function reloadPage(): void {
  globalThis.location.reload();
}

/** Shows an unexpected render failure and offers a page reload. */
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
      <section aria-label="Saerskriven stopped" className={styles.stopped}>
        <h1 className={styles.headline}>Saerskriven stopped</h1>
        <p>
          The studio ran into something it has no handling for. Reloading uses
          the last completed recovery snapshot. Work after a failed recovery
          write may be gone.
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
