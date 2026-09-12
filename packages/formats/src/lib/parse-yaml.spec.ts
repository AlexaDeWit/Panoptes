import { Either } from 'effect';
import { parseYaml } from './parse-yaml.js';
import { readLimits } from './read-limits.js';

describe('bounded YAML line endings', () => {
  it.each(['\n', '\r\n', '\r'])(
    'reads a mapping after a comment with %j endings',
    (ending) => {
      const text = ['# comment', 'severity:', '  high: "#123456"', ''].join(
        ending,
      );
      expect(parseYaml(text)).toEqual(
        Either.right({ severity: { high: '#123456' } }),
      );
    },
  );

  it('preserves escaped carriage returns and normalizes raw block-scalar line endings', () => {
    const text = 'escaped: "first\\rsecond"\rblock: |\r  first\r  second\r';
    expect(parseYaml(text)).toEqual(
      Either.right({ escaped: 'first\rsecond', block: 'first\nsecond\n' }),
    );
  });

  it('reports the same malformed-input location for CR and LF sources', () => {
    const lines = ['severity:', '  high: [', ''];
    expect(parseYaml(lines.join('\r'))).toEqual(parseYaml(lines.join('\n')));
    expect(Either.isLeft(parseYaml(lines.join('\r')))).toBe(true);
  });

  it('checks the original byte count before normalization', () => {
    const text = '\r'.repeat(readLimits.maxTextBytes + 1);
    expect(Either.getLeft(parseYaml(text))).toMatchObject({
      value: {
        _tag: 'ExceededReadLimit',
        limit: 'maxTextBytes',
        observed: text.length,
      },
    });
  });

  it('keeps the shared alias bound after normalizing CR-only input', () => {
    const aliases = Array.from(
      { length: readLimits.maxAliasCount + 1 },
      () => '*a',
    ).join(',');
    const read = parseYaml(`a: &a []\rb: [${aliases}]\r`);
    expect(Either.getLeft(read)).toMatchObject({
      value: { _tag: 'ExceededReadLimit', limit: 'maxAliasCount' },
    });
  });
});
