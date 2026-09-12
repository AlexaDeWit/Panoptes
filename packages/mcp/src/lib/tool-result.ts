import type {
  CallToolResult,
  ContentBlock,
} from '@modelcontextprotocol/server';
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
    onLeft: refused,
    onRight: (answer) => answered(answer, render(answer), []),
  });
}

/** An answer and the content blocks a result carries after its text block. */
export type WithBlocks<Answer> = {
  readonly answer: Answer;
  readonly blocks: readonly ContentBlock[];
};

/**
 * One tool's outcome where the result carries content blocks past its text,
 * an image or a resource link among them. The blocks come out of the outcome
 * beside the answer rather than out of the answer itself, so bytes reach a
 * caller once as a block instead of twice with a copy in
 * `structuredContent`. The text block and its opening line are
 * {@link toolResult}'s, so a tool with blocks is held to the same rule.
 */
export function attachedToolResult<Answer extends Record<string, unknown>>(
  outcome: Either.Either<WithBlocks<Answer>, readonly string[]>,
  render: (answer: Answer) => readonly string[],
): CallToolResult {
  return Either.match(outcome, {
    onLeft: refused,
    onRight: ({ answer, blocks }) => answered(answer, render(answer), blocks),
  });
}

function refused(lines: readonly string[]): CallToolResult {
  return {
    content: [{ type: 'text', text: prefaced(lines) }],
    isError: true,
  };
}

function answered(
  answer: Record<string, unknown>,
  lines: readonly string[],
  blocks: readonly ContentBlock[],
): CallToolResult {
  return {
    content: [{ type: 'text', text: prefaced(lines) }, ...blocks],
    structuredContent: answer,
  };
}
