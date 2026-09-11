import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DropdownMenu } from 'radix-ui';
import { activeDiagramId } from '../store/selectors.js';
import { initialState } from '../store/state.js';
import {
  mainDiagram,
  sampleModel,
  secondDiagram,
  twoDiagramModel,
} from '../store/store.fixtures.js';
import { modelStore } from '../store/store.js';
import { DiagramMenu, DiagramSwitcher } from './diagram-menu.js';

function OpenMenu() {
  return (
    <DropdownMenu.Root open>
      <DropdownMenu.Trigger>Menu</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item>Always</DropdownMenu.Item>
        <DiagramMenu>
          <DropdownMenu.Item>Step</DropdownMenu.Item>
        </DiagramMenu>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

const choice = (name: string): HTMLElement =>
  screen.getByRole('menuitemradio', { name });

describe('the diagram group of the menu', () => {
  it('is absent from a model of one diagram', async () => {
    modelStore.setState(initialState(sampleModel), true);
    render(<OpenMenu />);
    await screen.findByRole('menuitem', { name: 'Always' });
    expect(screen.queryByRole('menuitemradio')).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Step' })).toBeNull();
  });

  it('lists every diagram by title, the one on screen checked, and switches on a choice', async () => {
    const user = userEvent.setup();
    modelStore.setState(initialState(twoDiagramModel), true);
    render(<OpenMenu />);

    await screen.findByRole('menuitem', { name: 'Step' });
    expect(choice('Main').getAttribute('aria-checked')).toBe('true');
    expect(choice('Second').getAttribute('aria-checked')).toBe('false');

    await user.click(choice('Second'));

    expect(activeDiagramId(modelStore.getState())).toBe(secondDiagram);
  });
});

describe('the diagram switcher', () => {
  it('is absent from a model of one diagram', () => {
    modelStore.setState(initialState(sampleModel), true);
    render(<DiagramSwitcher />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('names the diagram on screen and offers the others', async () => {
    const user = userEvent.setup();
    modelStore.setState(initialState(twoDiagramModel), true);
    render(<DiagramSwitcher />);

    const trigger = screen.getByRole('button', { name: 'Diagram: Main' });
    await user.click(trigger);
    await screen.findByRole('menu');
    await user.click(choice('Second'));

    expect(activeDiagramId(modelStore.getState())).toBe(secondDiagram);
    expect(
      screen.getByRole('button', { name: 'Diagram: Second' }),
    ).toBeDefined();
    expect(modelStore.getState().past).toEqual([]);
    expect(activeDiagramId(modelStore.getState())).not.toBe(mainDiagram);
  });
});
