import type { GetPromptResult } from '@modelcontextprotocol/server';
import { Either } from 'effect';
import { prefaced } from './preface.js';

/**
 * A prompt as two parts: the lines read out of a model, which may carry any
 * text its author chose, and the brief Saerskriven writes, which carries none.
 */
export type PromptParts = {
  readonly data: readonly string[];
  readonly brief: readonly string[];
};

/**
 * One prompt's outcome as the messages a host sends: the data in a message of
 * its own opened by the data-not-instructions line, then the brief. A refusal
 * is one message of its lines under the same opening line, since a prompt has
 * no error result to carry it.
 */
export function promptResult(
  outcome: Either.Either<PromptParts, readonly string[]>,
): GetPromptResult {
  return Either.match(outcome, {
    onLeft: (lines) => ({ messages: [userMessage(prefaced(lines))] }),
    onRight: ({ data, brief }) => ({
      messages: [userMessage(prefaced(data)), userMessage(brief.join('\n'))],
    }),
  });
}

function userMessage(text: string): GetPromptResult['messages'][number] {
  return { role: 'user', content: { type: 'text', text } };
}
