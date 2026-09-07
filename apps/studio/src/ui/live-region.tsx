import type { ReactNode } from 'react';

import styles from './live-region.module.css';

/** What a {@link LiveRegion} is called, what it says, and how it looks. */
export type LiveRegionProps = {
  readonly label?: string;
  readonly testId: string;
  readonly className?: string;
  readonly children?: ReactNode;
};

export function LiveRegion({
  label,
  testId,
  className,
  children,
}: LiveRegionProps) {
  return (
    <section
      aria-label={label}
      aria-atomic={label === undefined ? 'true' : undefined}
      aria-live="polite"
      className={
        className === undefined
          ? styles.region
          : `${styles.region} ${className}`
      }
      data-testid={testId}
      role={label === undefined ? 'status' : undefined}
    >
      {children}
    </section>
  );
}
