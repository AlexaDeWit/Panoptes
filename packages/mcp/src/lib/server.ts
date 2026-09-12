import { McpServer } from '@modelcontextprotocol/server';
import {
  fileArgumentSchema,
  inspect,
  inspectResultSchema,
  renderInspection,
} from './inspect.js';
import { toolResult } from './tool-result.js';
import type { ModelWorkspace } from './workspace.js';

/** The name the server reports to a host, and the prefix every tool carries. */
export const serverName = 'saerskriven';

/** What the server object needs: where it may read, and which build it is. */
export type SaerskrivenServerOptions = {
  readonly workspace: ModelWorkspace;
  readonly version: string;
};

const inspectDescription = [
  'Read one Saerskriven threat model file and report what it holds: the file format detected from its content, the model metadata, one line per diagram with its element and threat counts, the totals over the whole model, and every place the file and the model do not correspond exactly.',
  'Call this first on a model you have not read in this session. The `revision` it returns is the handle an edit has to quote back, so a tool that writes will ask you for a fresh one.',
  'Pass `file` as a path relative to the server root. Leave it out when the server was started with a default model; with no default and no `file`, the result lists the model files under the root instead of reading one.',
  'This tool never writes. A path that leaves the server root is refused rather than read.',
].join(' ');

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
  return server;
}
