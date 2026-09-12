import { renderRegister } from '@saerskriven/render';
import { answerOf, ecluseWorkspace } from './read-tools.fixtures.js';
import { readNamed } from './reading.js';
import { register, renderRegisterResult } from './register.js';

const ecluse = ecluseWorkspace();

describe('what saer_register writes', () => {
  it('carries the markdown the render package writes for the model', () => {
    const model = answerOf(readNamed(ecluse, undefined)).model;
    expect(answerOf(register(ecluse, {})).markdown).toEqual(
      renderRegister(model),
    );
  });

  it('opens its text with the reading before the document itself', () => {
    const rendered = renderRegisterResult(answerOf(register(ecluse, {})));
    expect(rendered[0]).toEqual('file: test-data/ecluse.json');
    expect(rendered.at(-1)).toEqual(answerOf(register(ecluse, {})).markdown);
  });
});
