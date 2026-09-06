import { act, render, screen } from '@testing-library/react';
import { Action } from '../store/actions.js';
import { initialState, placeholderModel } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import { nativeSource, newProcess } from '../store/store.fixtures.js';
import { EmptyStateHint } from './empty-state-hint.js';

const line = (): HTMLElement | null => screen.queryByTestId('empty-state-hint');

describe('EmptyStateHint', () => {
  beforeEach(() => {
    modelStore.setState(initialState(placeholderModel), true);
  });

  it('says what to do next while the studio is on the model it opened with', () => {
    render(<EmptyStateHint />);

    expect(line()?.textContent).toBe('Open a model, or pick a tool');
  });

  it('goes as soon as an edit lands', () => {
    render(<EmptyStateHint />);

    act(() => {
      dispatch(
        Action.AddElement({
          diagramId: placeholderModel.diagrams[0].id,
          element: newProcess('process-added', 'Added'),
        }),
      );
    });

    expect(line()).toBeNull();
  });

  it('goes once the model lives in a file', () => {
    render(<EmptyStateHint />);

    act(() => {
      dispatch(Action.Saved({ name: 'model.yaml', source: nativeSource }));
    });

    expect(line()).toBeNull();
  });
});
