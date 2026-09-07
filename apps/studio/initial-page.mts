import { tokenStylesheet } from '@saerskriven/canvas/tokens';

/** Styles needed before the studio JavaScript mounts the application. */
export const initialPageStylesheet = `${tokenStylesheet}
.initial-page,
.no-script {
  position: fixed;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: var(--pn-space-2);
  background: var(--pn-colour-canvas);
  color: var(--pn-colour-text);
  font-family: var(--pn-font-family);
  font-size: var(--pn-font-size);
}

.no-script {
  margin: 0;
}

.initial-page__indicator {
  width: 2rem;
  height: 2rem;
  border: 0.25rem solid var(--pn-colour-grid);
  border-top-color: var(--pn-colour-accent);
  border-radius: 50%;
  animation: pn-initial-page-spin 0.8s linear infinite;
}

@keyframes pn-initial-page-spin {
  to {
    transform: rotate(1turn);
  }
}

@media (prefers-reduced-motion: reduce) {
  .initial-page__indicator {
    animation: none;
  }
}
`;
