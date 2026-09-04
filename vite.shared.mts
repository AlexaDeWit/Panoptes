/// <reference types="vitest" />
// Root-defined vite configuration for React projects. A leaf's vite.config.mts
// is one line: `export default reactLib(import.meta.dirname)` for a library,
// `reactApp` for an application. Deviations belong here, behind a parameter.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cacheDir, sharedTest } from './vitest.shared.mts';

export const reactLib = (projectRoot: string) =>
  defineConfig({
    root: projectRoot,
    cacheDir: cacheDir(projectRoot),
    plugins: [react()],
    test: sharedTest(projectRoot, 'jsdom'),
  });

type ReactAppOptions = {
  readonly port?: number;
  readonly setupFiles?: string[];
};

export const reactApp = (
  projectRoot: string,
  { port = 4200, setupFiles = [] }: ReactAppOptions = {},
) =>
  defineConfig({
    root: projectRoot,
    cacheDir: cacheDir(projectRoot),
    plugins: [react()],
    server: { port, host: 'localhost' },
    preview: { port, host: 'localhost' },
    build: {
      outDir: './dist',
      emptyOutDir: true,
      reportCompressedSize: true,
      commonjsOptions: { transformMixedEsModules: true },
    },
    test: sharedTest(projectRoot, 'jsdom', setupFiles),
  });
