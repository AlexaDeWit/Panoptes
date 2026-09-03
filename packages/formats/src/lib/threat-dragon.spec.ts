import { threatDragonWireSchema } from '@panoptes/wire-threat-dragon';
import { Either } from 'effect';
import { ecluseText } from './threat-dragon.fixtures.js';
import { threatDragonCodec } from './threat-dragon.js';

const reading = Either.getOrThrow(threatDragonCodec.read(ecluseText));

describe('the Threat Dragon codec', () => {
  it('pairs the read and the write with the schema they share', () => {
    expect(threatDragonCodec.wire).toBe(threatDragonWireSchema);
  });

  it('merges onto the document it read, and reads that back the same', () => {
    const written = threatDragonCodec.write(reading.model, reading.source);
    expect(written.divergences).toEqual([]);
    expect(
      Either.getOrThrow(threatDragonCodec.read(written.output)).model,
    ).toEqual(reading.model);
  });
});
