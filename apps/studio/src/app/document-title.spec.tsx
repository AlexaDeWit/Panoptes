import { act, render } from '@testing-library/react';
import { Action } from '../store/actions.js';
import { initialState, placeholderModel } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import { nativeSource } from '../store/store.fixtures.js';
import { DocumentTitle } from './document-title.js';

describe('DocumentTitle', () => {
  beforeEach(() => {
    modelStore.setState(initialState(placeholderModel), true);
  });

  it('names the tab for a model that has never been in a file', () => {
    render(<DocumentTitle />);

    expect(document.title).toBe('Untitled - Panoptes');
  });

  it('follows the file the model is saved into', () => {
    render(<DocumentTitle />);

    act(() => {
      dispatch(Action.Saved({ name: 'model.yaml', source: nativeSource }));
    });

    expect(document.title).toBe('model.yaml - Panoptes');
  });
});
