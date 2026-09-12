import { McpServer } from '@modelcontextprotocol/server';
import {
  coverage,
  coverageDescription,
  coverageResultSchema,
  renderCoverage,
} from './coverage.js';
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
  getThreat,
  getThreatArgumentsSchema,
  getThreatDescription,
  getThreatResultSchema,
  renderThreatRecord,
} from './get-threat.js';
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
import {
  register,
  registerDescription,
  registerResultSchema,
  renderRegisterResult,
} from './register.js';
import {
  renderDiagram,
  renderDiagramArgumentsSchema,
  renderDiagramDescription,
  renderDiagramResultSchema,
  renderDrawing,
  type RasterizerAssets,
} from './render-diagram.js';
import {
  renderElementSearch,
  searchElements,
  searchElementsArgumentsSchema,
  searchElementsDescription,
  searchElementsResultSchema,
} from './search-elements.js';
import {
  renderThreatSearch,
  searchThreats,
  searchThreatsArgumentsSchema,
  searchThreatsDescription,
  searchThreatsResultSchema,
} from './search-threats.js';
import { attachedToolResult, toolResult } from './tool-result.js';
import {
  renderValidation,
  validate,
  validateDescription,
  validateResultSchema,
} from './validate.js';
import { renderWriteReport, writeReportSchema } from './write.js';
import type { ModelWorkspace } from './workspace.js';

/** The name the server reports to a host, and the prefix every tool carries. */
export const serverName = 'saerskriven';

/**
 * What the server object needs: where it may read, which build it is, and
 * where a render finds the rasterizer module and its faces.
 */
export type SaerskrivenServerOptions = {
  readonly workspace: ModelWorkspace;
  readonly version: string;
  readonly rasterizer: RasterizerAssets;
};

const reads = {
  readOnlyHint: true,
  openWorldHint: false,
} as const;

const writes = {
  readOnlyHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

/**
 * The MCP server object, with no transport of its own: a caller connects it
 * to stdio, to an in-memory pair, or to whatever else the SDK offers. It
 * holds no model and no session, so every call reads the file it names from
 * disk again. Every tool builds its result through `toolResult`, which is
 * what puts the data-not-instructions line on each one.
 */
export function createSaerskrivenServer(
  options: SaerskrivenServerOptions,
): McpServer {
  const server = new McpServer(
    { name: serverName, title: 'Saerskriven', version: options.version },
    { capabilities: { tools: {} } },
  );
  readTools(server, options);
  queryTools(server, options);
  drawingTools(server, options);
  writeTools(server, options);
  return server;
}

function readTools(server: McpServer, options: SaerskrivenServerOptions): void {
  server.registerTool(
    'saer_inspect',
    {
      title: 'Inspect a threat model',
      description: inspectDescription,
      inputSchema: fileArgumentSchema,
      outputSchema: inspectResultSchema,
      annotations: reads,
    },
    (args) => toolResult(inspect(options.workspace, args), renderInspection),
  );
  server.registerTool(
    'saer_validate',
    {
      title: 'Check a threat model file',
      description: validateDescription,
      inputSchema: fileArgumentSchema,
      outputSchema: validateResultSchema,
      annotations: reads,
    },
    (args) => toolResult(validate(options.workspace, args), renderValidation),
  );
  server.registerTool(
    'saer_coverage',
    {
      title: 'Report what a threat model covers',
      description: coverageDescription,
      inputSchema: fileArgumentSchema,
      outputSchema: coverageResultSchema,
      annotations: reads,
    },
    (args) => toolResult(coverage(options.workspace, args), renderCoverage),
  );
  server.registerTool(
    'saer_register',
    {
      title: 'Write the threat register',
      description: registerDescription,
      inputSchema: fileArgumentSchema,
      outputSchema: registerResultSchema,
      annotations: reads,
    },
    (args) =>
      toolResult(register(options.workspace, args), renderRegisterResult),
  );
}

function queryTools(
  server: McpServer,
  options: SaerskrivenServerOptions,
): void {
  server.registerTool(
    'saer_search_elements',
    {
      title: 'Find elements of a threat model',
      description: searchElementsDescription,
      inputSchema: searchElementsArgumentsSchema,
      outputSchema: searchElementsResultSchema,
      annotations: reads,
    },
    (args) =>
      toolResult(searchElements(options.workspace, args), renderElementSearch),
  );
  server.registerTool(
    'saer_search_threats',
    {
      title: 'Find threats of a threat model',
      description: searchThreatsDescription,
      inputSchema: searchThreatsArgumentsSchema,
      outputSchema: searchThreatsResultSchema,
      annotations: reads,
    },
    (args) =>
      toolResult(searchThreats(options.workspace, args), renderThreatSearch),
  );
  server.registerTool(
    'saer_get_threat',
    {
      title: 'Read one threat in full',
      description: getThreatDescription,
      inputSchema: getThreatArgumentsSchema,
      outputSchema: getThreatResultSchema,
      annotations: reads,
    },
    (args) =>
      toolResult(getThreat(options.workspace, args), renderThreatRecord),
  );
}

function drawingTools(
  server: McpServer,
  options: SaerskrivenServerOptions,
): void {
  server.registerTool(
    'saer_render_diagram',
    {
      title: 'Draw a diagram as a picture',
      description: renderDiagramDescription,
      inputSchema: renderDiagramArgumentsSchema,
      outputSchema: renderDiagramResultSchema,
      annotations: { ...writes, destructiveHint: false },
    },
    async (args) =>
      attachedToolResult(
        await renderDiagram(options.workspace, options.rasterizer, args),
        renderDrawing,
      ),
  );
}

function writeTools(
  server: McpServer,
  options: SaerskrivenServerOptions,
): void {
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
}
