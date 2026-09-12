import { renderRegister } from '@saerskriven/render';
import { Either } from 'effect';
import { promptProseOf } from '../fixtures.js';
import { coverageOf, renderCoverage } from './coverage.js';
import { dataNotInstructions } from './preface.js';
import { PromptFailure, promptMessages } from './prompt-result.js';
import {
  answerOf,
  ecluseWorkspace,
  rootWorkspace,
  saerskrivenWorkspace,
} from './read-tools.fixtures.js';
import { readNamed } from './reading.js';
import { reviewBrief, reviewModel } from './review-model.js';

describe('what review_model renders', () => {
  it.each([
    ['the Écluse fixture', ecluseWorkspace()],
    ["the repository's own model", saerskrivenWorkspace()],
  ])('renders the coverage and the register of %s', (_name, workspace) => {
    const reading = answerOf(readNamed(workspace, undefined));
    const [data, brief] = promptProseOf(
      promptMessages(Either.getOrThrow(reviewModel(workspace, {}))),
    ).prose;
    expect(data?.split('\n')[0]).toEqual(dataNotInstructions);
    expect(data).toContain(renderCoverage(coverageOf(reading)).join('\n'));
    expect(data).toContain(renderRegister(reading.model));
    expect(brief).toEqual(reviewBrief.join('\n'));
  });

  it('fails with no model where there is none to review', () => {
    expect(reviewModel(rootWorkspace(), {})).toEqual(
      Either.left(PromptFailure.NoModel()),
    );
  });
});
