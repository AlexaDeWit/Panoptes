import type { SvgDocument } from './svg-document.js';

type UnplacedFlow = SvgDocument['unplaced'][number];

/** The shared warning for flow endpoints a projection could not place. */
export function renderUnplacedWarning(
  unplaced: readonly UnplacedFlow[],
): string {
  return unplaced.length > 0
    ? [
        'warning: a flow endpoint names an element the canvas draws as no box, so its flow is not in the drawing.',
        ...unplaced.map(
          (endpoint) =>
            `  flow ${quoted(endpoint.flow)} ${endpoint.side} names ${quoted(endpoint.element)}`,
        ),
        '',
      ].join('\n')
    : '';
}

function quoted(value: string): string {
  return JSON.stringify(value);
}
