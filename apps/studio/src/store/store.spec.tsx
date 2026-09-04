import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { Action } from './actions.js';
import {
  actorElement,
  mainDiagram,
  newProcess,
  sampleModel,
} from './fixtures.js';
import { elementCount } from './selectors.js';
import { initialState } from './state.js';
import { dispatch, modelStore, useModelStore } from './store.js';

const painted: number[] = [];

function ElementCount() {
  const count = useModelStore(elementCount);
  useEffect(() => {
    painted.push(count);
  });
  return <span data-testid="count">{count}</span>;
}

const addProcess = Action.AddElement({
  diagramId: mainDiagram,
  element: newProcess('process-added', 'Added'),
});

describe('the model store', () => {
  beforeEach(() => {
    modelStore.setState(initialState(sampleModel), true);
    painted.length = 0;
  });

  it('shows a dispatched edit through a selector, with nothing invalidated by hand', () => {
    render(<ElementCount />);
    expect(screen.getByTestId('count').textContent).toBe('3');
    act(() => {
      dispatch(addProcess);
    });
    expect(screen.getByTestId('count').textContent).toBe('4');
    act(() => {
      dispatch(Action.Undo());
    });
    expect(screen.getByTestId('count').textContent).toBe('3');
  });

  it('leaves a component alone while a slice it does not read moves', () => {
    render(<ElementCount />);
    expect(painted).toEqual([3]);
    act(() => {
      dispatch(Action.Select({ elementId: actorElement }));
    });
    expect(painted).toEqual([3]);
    act(() => {
      dispatch(addProcess);
    });
    expect(painted).toEqual([3, 4]);
  });
});
