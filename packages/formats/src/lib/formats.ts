import { modelMetadataSchema } from '@panoptes/model';

const placeholderMetadata = modelMetadataSchema.parse({
  title: 'model',
  owner: '',
  description: '',
  contributors: [],
});

/**
 * Placeholder that reaches the model layer until this package's own slice
 * lands.
 */
export function formats(): string {
  return `formats of ${placeholderMetadata.title}`;
}
