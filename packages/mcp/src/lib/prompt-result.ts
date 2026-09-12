import type { GetPromptResult } from '@modelcontextprotocol/server';
import { Data } from 'effect';
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
 * Why a prompt could not be built from its arguments: no model to read, no
 * element of that id or name, a name several elements share, or an element
 * of a kind the pass does not cover. None of them carries text, so nothing
 * out of a model file reaches the error a client receives.
 */
export type PromptFailure = Data.TaggedEnum<{
  NoModel: {};
  NoSuchElement: {};
  SharedName: {};
  UncoveredKind: {};
}>;

/**
 * Constructor for {@link PromptFailure}, plus Effect's `$is` and `$match`
 * helpers.
 */
export const PromptFailure = Data.taggedEnum<PromptFailure>();

/**
 * A prompt as the messages a host sends: the data in a message of its own
 * opened by the data-not-instructions line, then the brief.
 */
export function promptMessages({ data, brief }: PromptParts): GetPromptResult {
  return {
    messages: [userMessage(prefaced(data)), userMessage(brief.join('\n'))],
  };
}

function userMessage(text: string): GetPromptResult['messages'][number] {
  return { role: 'user', content: { type: 'text', text } };
}
