import { emptyModel } from '@panoptes/model';
import { FileLifecycle, initialState, placeholderModel } from './state.js';

describe('initialState', () => {
  it('starts clean, with the model as its own saved copy', () => {
    const state = initialState(placeholderModel);
    expect(state.present).toBe(placeholderModel);
    expect(state.saved).toBe(placeholderModel);
    expect(state.past).toEqual([]);
    expect(state.future).toEqual([]);
    expect(state.selection).toBeUndefined();
    expect(state.lastFailure).toBeUndefined();
    expect(state.file).toEqual(FileLifecycle.NoFile());
  });
});

describe('placeholderModel', () => {
  it('parses, so the walking skeleton opens on a diagram it can edit', () => {
    expect(placeholderModel).not.toBe(emptyModel);
    expect(placeholderModel.diagrams).toHaveLength(1);
  });
});
