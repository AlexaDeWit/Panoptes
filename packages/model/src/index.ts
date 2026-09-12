export {
  acceptedTextSchema,
  firstRefusedCharacter,
  isEmptyName,
} from './lib/text.js';
export * from './lib/ids.js';
export * from './lib/geometry.js';
export * from './lib/elements.js';
export * from './lib/categories.js';
export * from './lib/threats.js';
export * from './lib/mitigations.js';
export * from './lib/assumptions.js';
export {
  diagramSchema,
  modelMetadataChangeSchema,
  modelMetadataSchema,
  type Diagram,
  type ModelMetadata,
  type ModelMetadataChange,
} from './lib/model.js';
export * from './lib/parse.js';
export { diagramsNamed, elementIdsIn } from './lib/references.js';
export * from './lib/empty.js';
export * from './lib/operation-failures.js';
export * from './lib/operations.js';
export * from './lib/threat-operations.js';
export * from './lib/mitigation-operations.js';
export * from './lib/assumption-operations.js';
export * from './lib/metadata-operations.js';
export * from './lib/coverage.js';

export * from './lib/fragment.js';

export * from './lib/element-properties.js';
