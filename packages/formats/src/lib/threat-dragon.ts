import { threatDragonWireSchema } from '@panoptes/wire-threat-dragon';
import type { Codec } from './codec.js';
import { readThreatDragon } from './threat-dragon-read.js';
import { writeThreatDragon } from './threat-dragon-write.js';

/**
 * The Threat Dragon v2 format as one {@link Codec}: the wire schema from
 * `@panoptes/wire-threat-dragon`, the read that maps a file onto the
 * internal model, and the write that puts the model back.
 *
 * The contract's two write paths differ here, the format holding less than
 * the model does. Given the document a read returned the write merges onto
 * it, which is what keeps the styling, ports and per-type flags Panoptes
 * does not model; given none it projects the model into Threat Dragon's own
 * canonical form, and everything outside the model is gone.
 */
export const threatDragonCodec: Codec<typeof threatDragonWireSchema> = {
  wire: threatDragonWireSchema,
  read: readThreatDragon,
  write: writeThreatDragon,
};
