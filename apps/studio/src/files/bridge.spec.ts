import {
  OpenOutcome,
  readWithin,
  reasonOf,
  type ChosenFile,
} from './bridge.js';
import { chosenFile } from './files.fixtures.js';

const unreadable = (size: number): ChosenFile => ({
  name: 'gone.json',
  size,
  text: () => Promise.reject(new Error('The file was moved.')),
});

describe('readWithin', () => {
  it('hands over the text of a file inside the bound', async () => {
    const outcome = await readWithin(chosenFile('model.yaml', 'a: 1'), 1024);

    expect(outcome).toEqual(
      OpenOutcome.Chosen({ name: 'model.yaml', text: 'a: 1' }),
    );
  });

  it('refuses a file past the bound without reading any of it', async () => {
    const file = unreadable(1025);

    const outcome = await readWithin(file, 1024);

    expect(outcome).toEqual(
      OpenOutcome.TooLarge({ name: 'gone.json', bound: 1024, observed: 1025 }),
    );
  });

  it('measures the bound in bytes rather than in characters', async () => {
    const outcome = await readWithin(chosenFile('accents.yaml', 'ééé'), 5);

    expect(outcome._tag).toBe('TooLarge');
  });

  it('reports a file that would not read rather than throwing', async () => {
    const outcome = await readWithin(unreadable(4), 1024);

    expect(outcome).toEqual(
      OpenOutcome.Unreadable({ reason: 'The file was moved.' }),
    );
  });
});

describe('reasonOf', () => {
  it('takes the message of what was thrown', () => {
    expect(reasonOf(new Error('NotAllowedError'))).toBe('NotAllowedError');
  });

  it('renders what was thrown where it is no error at all', () => {
    expect(reasonOf('refused')).toBe('refused');
  });
});
