import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { emptyModel } from '@saerskriven/model';
import {
  CommandSurfaceProvider,
  unmountedSurface,
} from '../commands/binding.js';
import { resetAnnouncements } from '../canvas/announcements.js';
import { resetDiagramRenaming } from '../canvas/diagrams.js';
import { activeDiagramId } from '../store/selectors.js';
import { initialState, untitledDiagram } from '../store/state.js';
import {
  sampleModel,
  secondDiagram,
  twoDiagramModel,
} from '../store/store.fixtures.js';
import { modelStore } from '../store/store.js';
import { DiagramSwitcher } from './diagram-switcher.js';

const mounted = (): void => {
  render(
    <CommandSurfaceProvider surface={unmountedSurface}>
      <DiagramSwitcher />
    </CommandSurfaceProvider>,
  );
};

const switcher = (name: string | RegExp): HTMLElement =>
  screen.getByRole('button', { name });

const choice = (name: string): HTMLElement =>
  screen.getByRole('menuitemradio', { name });

const item = (name: string): HTMLElement =>
  screen.getByRole('menuitem', { name });

afterEach(() => {
  resetDiagramRenaming();
  resetAnnouncements();
});

describe('the diagram switcher', () => {
  it('names the diagram on screen for a model of one, and offers to add and rename', async () => {
    const user = userEvent.setup();
    modelStore.setState(initialState(sampleModel), true);
    mounted();

    await user.click(switcher('Diagram: Main'));
    await screen.findByRole('menu');

    expect(choice('Main').getAttribute('aria-checked')).toBe('true');
    expect(item('New diagram')).toBeDefined();
    expect(item('Rename diagram').getAttribute('data-disabled')).toBeNull();
  });

  it('lists every diagram by title and switches on a choice', async () => {
    const user = userEvent.setup();
    modelStore.setState(initialState(twoDiagramModel), true);
    mounted();

    await user.click(switcher('Diagram: Main'));
    await screen.findByRole('menu');
    await user.click(choice('Second'));

    expect(activeDiagramId(modelStore.getState())).toBe(secondDiagram);
    expect(switcher('Diagram: Second')).toBeDefined();
    expect(modelStore.getState().past).toEqual([]);
  });

  it('offers only a new diagram while the model holds none', async () => {
    const user = userEvent.setup();
    modelStore.setState(initialState(emptyModel), true);
    mounted();

    await user.click(switcher('Diagram: No diagram'));
    await screen.findByRole('menu');

    expect(screen.queryByRole('menuitemradio')).toBeNull();
    expect(item('Rename diagram').getAttribute('data-disabled')).not.toBeNull();

    await user.click(item('New diagram'));

    expect(modelStore.getState().present.diagrams).toHaveLength(1);
    expect(
      screen.getByRole('textbox', { name: 'Diagram title' }),
    ).toBeDefined();
  });

  it('adds a diagram, opens its title selected, and commits the title on Enter', async () => {
    const user = userEvent.setup();
    modelStore.setState(initialState(sampleModel), true);
    mounted();

    await user.click(switcher('Diagram: Main'));
    await user.click(
      await screen.findByRole('menuitem', { name: 'New diagram' }),
    );

    const field = screen.getByRole('textbox', { name: 'Diagram title' });
    expect(document.activeElement).toBe(field);
    expect(field).toHaveProperty('value', untitledDiagram);
    await user.keyboard('Request forgery{Enter}');

    const state = modelStore.getState();
    expect(state.present.diagrams.map((diagram) => diagram.title)).toEqual([
      'Main',
      'Request forgery',
    ]);
    expect(activeDiagramId(state)).toBe(state.present.diagrams[1].id);
    expect(state.past).toHaveLength(2);
    expect(switcher('Diagram: Request forgery')).toBeDefined();
  });

  it('renames in place, refuses an empty title, and cancels on Escape', async () => {
    const user = userEvent.setup();
    modelStore.setState(initialState(sampleModel), true);
    mounted();

    await user.click(switcher('Diagram: Main'));
    await user.click(
      await screen.findByRole('menuitem', { name: 'Rename diagram' }),
    );
    const field = screen.getByRole('textbox', { name: 'Diagram title' });
    await user.clear(field);
    await user.keyboard('{Enter}');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(modelStore.getState().present.diagrams[0].title).toBe('Main');

    await user.keyboard('Core');
    await user.keyboard('{Escape}');
    expect(modelStore.getState().present.diagrams[0].title).toBe('Main');
    expect(switcher('Diagram: Main')).toBeDefined();

    await user.click(switcher('Diagram: Main'));
    await user.click(
      await screen.findByRole('menuitem', { name: 'Rename diagram' }),
    );
    await user.keyboard('Core');
    act(() => {
      screen.getByRole('textbox', { name: 'Diagram title' }).blur();
    });
    expect(modelStore.getState().present.diagrams[0].title).toBe('Core');
    expect(modelStore.getState().past).toHaveLength(1);
  });
});
