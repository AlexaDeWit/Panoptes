const decimals = 3;

/**
 * One number as an SVG attribute carries it: fixed precision, no locale, no
 * exponent at any magnitude, and no negative zero, so one model gives the
 * same bytes on every run and every platform. The model's coordinates are
 * bare numbers and `toFixed` turns exponential from 1e21 up, so a magnitude
 * that far out has its digits written out instead.
 */
export function svgNumber(value: number): string {
  const fixed = value.toFixed(decimals);
  const plain = fixed.includes('e')
    ? expanded(value)
    : withoutTrailingZeros(fixed);
  return plain === '-0' ? '0' : plain;
}

function withoutTrailingZeros(fixed: string): string {
  const [whole, fraction] = fixed.split('.');
  const kept = fraction.replace(/0+$/u, '');
  return kept === '' ? whole : `${whole}.${kept}`;
}

function expanded(value: number): string {
  const [mantissa, exponent] = value.toExponential().split('e');
  const sign = mantissa.startsWith('-') ? '-' : '';
  const digits = mantissa.replace('-', '').replace('.', '');
  const zeros = Math.max(0, Number(exponent) - digits.length + 1);
  return `${sign}${digits}${'0'.repeat(zeros)}`;
}
