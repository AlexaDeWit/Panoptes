import { modelMetadataSchema } from '@panoptes/model';

const placeholderMetadata = modelMetadataSchema.parse({
  title: 'model',
  owner: '',
  description: '',
  contributors: [],
});

/**
 * Placeholder canvas the studio mounts until the interactive canvas wires
 * React Flow to the primitives beside it. data-testid anchors the browser
 * smoke, and the text gives the element a box for that smoke to see.
 */
export function PanoptesCanvas() {
  return <div data-testid="canvas-container">{placeholderMetadata.title}</div>;
}
