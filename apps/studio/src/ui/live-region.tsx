import type { ReactNode } from 'react';

import styles from './live-region.module.css';

/** What a {@link LiveRegion} is called, what it says, and how it looks. */
export type LiveRegionProps = {
  readonly label: string;
  readonly testId: string;
  readonly className?: string;
  readonly children?: ReactNode;
};

/**
 * A region that announces what arrives in it. It stays in the page while it
 * has nothing to say, so a screen reader is already observing it when the
 * first message comes: a region inserted and filled in the same frame
 * announces nothing. `className` is the caller's look for it, applied over
 * the collapse the empty region does on its own.
 */
export function LiveRegion({
  label,
  testId,
  className,
  children,
}: LiveRegionProps) {
  return (
    <section
      aria-label={label}
      aria-live="polite"
      className={
        className === undefined
          ? styles.region
          : `${styles.region} ${className}`
      }
      data-testid={testId}
    >
      {children}
    </section>
  );
}
