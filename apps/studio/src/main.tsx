import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { App } from './app/app';
import { DocumentTitle } from './app/document-title';
import { DesignTokens } from './theme';
import { ErrorBoundary } from './ui/error-boundary';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('index.html has no #root element');
}

ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    <DesignTokens />
    <DocumentTitle />
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
