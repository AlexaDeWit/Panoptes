import { developmentModel, developmentModelKey } from './development-model.js';
import { sampleModel } from './store.fixtures.js';

const inject = (value: unknown): void => {
  Object.defineProperty(window, developmentModelKey, {
    value,
    configurable: true,
  });
};

describe('developmentModel', () => {
  afterEach(() => {
    inject(undefined);
  });

  it('opens on nothing while the page names no model', () => {
    expect(developmentModel()).toBeUndefined();
  });

  it('reads the model a development session put on the page', () => {
    inject(sampleModel);

    expect(developmentModel()?.metadata.title).toBe(sampleModel.metadata.title);
  });

  it('passes over a document that does not parse rather than failing the boot', () => {
    inject({ metadata: 'not a model' });

    expect(developmentModel()).toBeUndefined();
  });
});
