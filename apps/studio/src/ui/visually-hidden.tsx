import type { ReactNode } from 'react';
import styles from './visually-hidden.module.css';

/** Text available to assistive technology but not drawn on the page. */
export function VisuallyHidden({
  children,
  id,
}: {
  readonly children: ReactNode;
  readonly id?: string;
}) {
  return (
    <span className={styles.hidden} id={id}>
      {children}
    </span>
  );
}
