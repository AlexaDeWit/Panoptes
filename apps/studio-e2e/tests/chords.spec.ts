import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { registeredChords } from '../src/chords.js';

const registry = readFileSync(
  join(import.meta.dirname, '../../../apps/studio/src/commands/registry.ts'),
  'utf8',
);

const asChordCall = (chord: string): string => {
  const pressed = chord.split('+');
  const key = pressed.at(-1) ?? '';
  const held = pressed.slice(0, -1);
  if (held.length === 0) {
    return `bare('${key}')`;
  }
  return held.includes('Shift') ? `modShift('${key}')` : `mod('${key}')`;
};

const asRegistrySource = (chords: readonly string[]): string =>
  `shortcuts: [${chords.map(asChordCall).join(', ')}],`;

const declaredIds: readonly string[] = registry.match(/\bid: '[^']+',/gu) ?? [];

describe('the chords the browser suite presses', () => {
  it('are the chords the registry binds, written as the registry writes them', () => {
    const adrift = Object.entries(registeredChords).filter(
      ([, chords]) => !registry.includes(asRegistrySource(chords)),
    );

    expect(adrift.map(([id]) => id)).toEqual([]);
  });

  it('name every command the registry declares, and no command it does not', () => {
    expect(declaredIds).toHaveLength(Object.keys(registeredChords).length);
    const unknown = Object.keys(registeredChords).filter(
      (id) => !declaredIds.includes(`id: '${id}',`),
    );

    expect(unknown).toEqual([]);
  });

  it('reads a registry that declares its commands, which is what this holds it against', () => {
    expect(declaredIds.length > 0).toBe(true);
    expect(registry).toContain("shortcuts: [mod('s')],");
  });
});
