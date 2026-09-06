import { act, render } from '@testing-library/react';
import { Action } from '../store/actions.js';
import { initialState, placeholderModel } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import { nativeSource } from '../store/store.fixtures.js';
import { DocumentTitle, landingTitle } from './document-title.js';

describe('DocumentTitle', () => {
  beforeEach(() => {
    modelStore.setState(initialState(placeholderModel), true);
  });

  it('names the landing page before a model changes', () => {
    render(<DocumentTitle />);

    expect(document.title).toBe(landingTitle);
  });

  it('follows the file the model is saved into', () => {
    render(<DocumentTitle />);

    act(() => {
      dispatch(Action.Saved({ name: 'model.yaml', source: nativeSource }));
    });

    expect(document.title).toBe('model.yaml - Saerskriven');
  });
});
