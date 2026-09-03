import { svgNumber } from './numbers.js';

const magnitudes = Array.from({ length: 69 }, (_, step) => 10 ** (step - 8));

const plainNumber = /^-?\d+(\.\d{1,3})?$/u;

describe('svgNumber', () => {
  it('writes a whole coordinate without a decimal part', () => {
    expect(svgNumber(120)).toBe('120');
  });

  it('keeps the decimals a coordinate carries', () => {
    expect(svgNumber(12.5)).toBe('12.5');
  });

  it('rounds off what binary arithmetic leaves behind', () => {
    expect(svgNumber(0.1 + 0.2)).toBe('0.3');
  });

  it('keeps a negative coordinate negative', () => {
    expect(svgNumber(-40.25)).toBe('-40.25');
  });

  it('writes a value that rounds to negative zero as zero', () => {
    expect(svgNumber(-0.0001)).toBe('0');
  });

  it('writes zero as zero', () => {
    expect(svgNumber(0)).toBe('0');
  });

  it('keeps the trailing zeros of a whole hundred', () => {
    expect(svgNumber(1200)).toBe('1200');
  });

  it('writes out the magnitude where toFixed turns exponential', () => {
    expect(svgNumber(1e21)).toBe('1000000000000000000000');
    expect(Number(svgNumber(1e21))).toBe(1e21);
  });

  it('writes out a magnitude far past that one', () => {
    expect(svgNumber(1e30)).toBe(`1${'0'.repeat(30)}`);
    expect(Number(svgNumber(1e30))).toBe(1e30);
  });

  it('writes out the digits of a mantissa, not just the leading one', () => {
    expect(Number(svgNumber(1.5e21))).toBe(1.5e21);
    expect(Number(svgNumber(-1e30))).toBe(-1e30);
  });

  it('writes no exponent and no separator at any magnitude', () => {
    const written = magnitudes.flatMap((magnitude) =>
      [1, 1.5, -3.25, 7].map((factor) => svgNumber(factor * magnitude)),
    );
    expect(written.filter((value) => !plainNumber.test(value))).toEqual([]);
  });

  it('had a range of magnitudes to probe', () => {
    expect(magnitudes[0]).toBe(1e-8);
    expect(magnitudes.at(-1)).toBe(1e60);
  });
});
