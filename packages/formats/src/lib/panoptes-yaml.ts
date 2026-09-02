import { panoptesYamlWireSchema } from '@panoptes/wire-panoptes-yaml';
import type { Codec } from './codec.js';
import { readPanoptesYaml } from './panoptes-yaml-read.js';
import { writePanoptesYaml } from './panoptes-yaml-write.js';

/**
 * The Panoptes YAML format as one {@link Codec}: the wire schema from
 * `@panoptes/wire-panoptes-yaml`, the read that maps a file onto the
 * internal model, and the write that projects the model back.
 *
 * Both of the contract's write paths are the same path here. The format
 * holds the whole model, so a write that merges onto a source document and
 * a write that projects the model produce the same file, and neither has
 * anything to report.
 */
export const panoptesYamlCodec: Codec<typeof panoptesYamlWireSchema> = {
  wire: panoptesYamlWireSchema,
  read: readPanoptesYaml,
  write: writePanoptesYaml,
};
