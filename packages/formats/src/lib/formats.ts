import { modelMetadataSchema } from '@panoptes/model';

// Placeholder wiring probe: parses through the model layer so the workspace
// dependency is exercised. Replaced when this package gets its own slice.
export function formats(): string {
  const metadata = modelMetadataSchema.parse({
    title: 'model',
    owner: '',
    description: '',
  });
  return `formats of ${metadata.title}`;
}
