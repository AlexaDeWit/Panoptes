import type { CallToolResult } from '@modelcontextprotocol/server';
import { Either } from 'effect';
import { prefaced } from './preface.js';

/**
 * One tool's outcome as the result a client receives: the answer as
 * `structuredContent` beside its rendering, or the lines saying why there is
 * no answer as an `isError` result. Every tool of this server builds its
 * result here, so the text of an answer and the text of a refusal both open
 * with the line saying the text is data. A tool that assembled a result of
 * its own would escape that, which is what the spec deriving its check from
 * `tools/list` is there to catch.
 */
export function toolResult<Answer extends Record<string, unknown>>(
  outcome: Either.Either<Answer, readonly string[]>,
  render: (answer: Answer) => readonly string[],
): CallToolResult {
  return Either.match(outcome, {
    onLeft: (lines) => ({
      content: [{ type: 'text', text: prefaced(lines) }],
      isError: true,
    }),
    onRight: (answer) => ({
      content: [{ type: 'text', text: prefaced(render(answer)) }],
      structuredContent: answer,
    }),
  });
}
