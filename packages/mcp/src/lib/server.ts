import { McpServer } from '@modelcontextprotocol/server';
import {
  createArgumentsSchema,
  createDescription,
  createModel,
} from './create.js';
import {
  editArgumentsSchema,
  editDescription,
  editModel,
  editResultSchema,
  renderEdit,
} from './edit.js';
import {
  importArgumentsSchema,
  importDescription,
  importIntoModel,
  importResultSchema,
  renderImport,
} from './import.js';
import {
  fileArgumentSchema,
  inspect,
  inspectDescription,
  inspectResultSchema,
  renderInspection,
} from './inspect.js';
import { toolResult } from './tool-result.js';
import { renderWriteReport, writeReportSchema } from './write.js';
import type { ModelWorkspace } from './workspace.js';

/** The name the server reports to a host, and the prefix every tool carries. */
export const serverName = 'saerskriven';

/** What the server object needs: where it may read, and which build it is. */
export type SaerskrivenServerOptions = {
  readonly workspace: ModelWorkspace;
  readonly version: string;
};

const writes = {
  readOnlyHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

/**
 * The MCP server object, with no transport of its own: a caller connects it
 * to stdio, to an in-memory pair, or to whatever else the SDK offers. It
 * holds no model and no session, so every call reads the file it names from
 * disk again. Every tool builds its result through {@link toolResult}, which
 * is what puts the data-not-instructions line on each one.
 */
export function createSaerskrivenServer(
  options: SaerskrivenServerOptions,
): McpServer {
  const server = new McpServer(
    { name: serverName, title: 'Saerskriven', version: options.version },
    { capabilities: { tools: {} } },
  );
  server.registerTool(
    'saer_inspect',
    {
      title: 'Inspect a threat model',
      description: inspectDescription,
      inputSchema: fileArgumentSchema,
      outputSchema: inspectResultSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (args) => toolResult(inspect(options.workspace, args), renderInspection),
  );
  server.registerTool(
    'saer_edit',
    {
      title: 'Edit a threat model',
      description: editDescription,
      inputSchema: editArgumentsSchema,
      outputSchema: editResultSchema,
      annotations: { ...writes, destructiveHint: true },
    },
    (args) => toolResult(editModel(options.workspace, args), renderEdit),
  );
  server.registerTool(
    'saer_create',
    {
      title: 'Start a threat model',
      description: createDescription,
      inputSchema: createArgumentsSchema,
      outputSchema: writeReportSchema,
      annotations: { ...writes, destructiveHint: false },
    },
    (args) =>
      toolResult(createModel(options.workspace, args), renderWriteReport),
  );
  server.registerTool(
    'saer_import',
    {
      title: 'Convert a foreign threat model',
      description: importDescription,
      inputSchema: importArgumentsSchema,
      outputSchema: importResultSchema,
      annotations: { ...writes, destructiveHint: false },
    },
    (args) =>
      toolResult(importIntoModel(options.workspace, args), renderImport),
  );
  return server;
}
