import { render, renderHook, screen } from '@testing-library/react';
import { currentTool, resetTools, selectTool } from '../canvas/tools.js';
import { initialState, placeholderModel } from '../store/state.js';
import { twoDiagramModel } from '../store/store.fixtures.js';
import { modelStore } from '../store/store.js';
import {
  CommandSurfaceProvider,
  commandForKey,
  keyboardOwner,
  nativeActivationTarget,
  useCommandKeys,
  useCommandSurface,
} from './binding.js';
import { recordingSurface } from './commands.fixtures.js';

const markup = (html: string): HTMLElement => {
  const holder = document.createElement('div');
  holder.innerHTML = html;
  document.body.append(holder);
  return holder;
};

const press = (target: Element, init: KeyboardEventInit): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
};

afterEach(() => {
  document.body.innerHTML = '';
  modelStore.setState(initialState(placeholderModel), true);
});

describe('keyboardOwner', () => {
  it('gives the page every press that is not aimed at a control that writes', () => {
    const holder = markup('<button type="button">Save</button>');

    expect(keyboardOwner(holder.firstElementChild)).toBe('page');
    expect(keyboardOwner(null)).toBe('page');
  });

  it('gives typing the presses aimed at a control that takes characters', () => {
    const holder = markup(
      '<input /><textarea></textarea><select><option>Actor</option></select><div contenteditable="true"><span>x</span></div>',
    );

    for (const child of holder.querySelectorAll(
      'input, textarea, select, option, span',
    )) {
      expect(keyboardOwner(child)).toBe('typing');
    }
  });

  it('gives an open overlay the keyboard whole, its own typeahead among it', () => {
    const holder = markup(
      '<div role="listbox"><div role="option">One</div></div><button aria-expanded="true" role="combobox"></button>',
    );

    expect(keyboardOwner(holder.querySelector('[role="option"]'))).toBe(
      'overlay',
    );
    expect(keyboardOwner(holder.querySelector('[role="combobox"]'))).toBe(
      'overlay',
    );
  });

  it('gives a closed listbox trigger its typeahead and nothing more', () => {
    const holder = markup(
      '<button aria-expanded="false" role="combobox">Severity</button>',
    );

    expect(keyboardOwner(holder.firstElementChild)).toBe('typing');
  });
});

describe('nativeActivationTarget', () => {
  it('finds a button or link and leaves other page content alone', () => {
    const holder = markup(
      '<button><span>Tool</span></button><a href="/model">Model</a><div>Canvas</div>',
    );

    expect(nativeActivationTarget(holder.querySelector('span'))).toBe(true);
    expect(nativeActivationTarget(holder.querySelector('a'))).toBe(true);
    expect(nativeActivationTarget(holder.querySelector('div'))).toBe(false);
  });
});

describe('commandForKey', () => {
  it('finds the command a press on the page runs', () => {
    const holder = markup('<div></div>');

    expect(commandForKey(press(holder, { key: 'a' }), 'other')?.id).toBe(
      'actor-tool',
    );
  });

  it('claims a chord only while its command is available in the model on screen', () => {
    const holder = markup('<div></div>');
    modelStore.setState(initialState(placeholderModel), true);
    expect(
      commandForKey(press(holder, { key: 'PageDown' }), 'other'),
    ).toBeUndefined();

    modelStore.setState(initialState(twoDiagramModel), true);
    expect(commandForKey(press(holder, { key: 'PageDown' }), 'other')?.id).toBe(
      'next-diagram',
    );
  });

  it('leaves a press a control has already acted on alone', () => {
    const holder = markup('<div></div>');
    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Delete',
    });
    holder.dispatchEvent(event);
    event.preventDefault();

    expect(commandForKey(event, 'other')).toBeUndefined();
  });

  it('suppresses a shortcut typed into a text field, and keeps the exempt ones', () => {
    const holder = markup('<input />');
    const field = holder.firstElementChild ?? holder;

    expect(commandForKey(press(field, { key: 'a' }), 'other')).toBeUndefined();
    expect(commandForKey(press(field, { key: 't' }), 'other')).toBeUndefined();
    expect(
      commandForKey(press(field, { key: 'a', ctrlKey: true }), 'other'),
    ).toBeUndefined();
    expect(
      commandForKey(press(field, { key: 'z', ctrlKey: true }), 'other')?.id,
    ).toBe('undo');
    expect(
      commandForKey(press(field, { key: 's', ctrlKey: true }), 'other')?.id,
    ).toBe('save');
    expect(
      commandForKey(press(field, { key: '?', shiftKey: true }), 'other'),
    ).toBeUndefined();
    expect(commandForKey(press(field, { key: 'F1' }), 'other')).toBeUndefined();
  });

  it('leaves Escape to a field holding a draft the model refused', () => {
    const holder = markup('<input />');
    const field = holder.firstElementChild ?? holder;

    expect(
      commandForKey(press(field, { key: 'Escape' }), 'other'),
    ).toBeUndefined();
    expect(commandForKey(press(holder, { key: 'Escape' }), 'other')?.id).toBe(
      'select-tool',
    );
  });

  it('keeps saving alive under a listbox trigger that is closed', () => {
    const holder = markup(
      '<button aria-expanded="false" role="combobox">Severity</button>',
    );
    const trigger = holder.firstElementChild ?? holder;

    expect(
      commandForKey(press(trigger, { key: 's', ctrlKey: true }), 'other')?.id,
    ).toBe('save');
    expect(
      commandForKey(press(trigger, { key: 'z', ctrlKey: true }), 'other')?.id,
    ).toBe('undo');
    expect(
      commandForKey(press(trigger, { key: 's' }), 'other'),
    ).toBeUndefined();
  });

  it('takes nothing out from under an open overlay', () => {
    const holder = markup(
      '<div role="listbox"><div role="option">One</div></div>',
    );
    const option = holder.querySelector('[role="option"]') ?? holder;

    expect(
      commandForKey(press(option, { key: 'Escape' }), 'other'),
    ).toBeUndefined();
    expect(commandForKey(press(option, { key: 'p' }), 'other')).toBeUndefined();
    expect(commandForKey(press(option, { key: 't' }), 'other')).toBeUndefined();
  });
});

describe('useCommandKeys', () => {
  beforeEach(() => {
    modelStore.setState(initialState(placeholderModel), true);
    resetTools();
  });

  it('runs the command a press names, and claims the press from the browser', () => {
    const recording = recordingSurface();
    renderHook(() => {
      useCommandKeys(recording.surface);
    });

    const event = press(document.body, { key: 's', ctrlKey: true });

    expect(recording.asked).toEqual(['save']);
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves a press no command answers to alone', () => {
    const recording = recordingSurface();
    renderHook(() => {
      useCommandKeys(recording.surface);
    });

    const event = press(document.body, { key: 'q' });

    expect(recording.asked).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  it('lets go of the page when it is unmounted', () => {
    const recording = recordingSurface();
    const { unmount } = renderHook(() => {
      useCommandKeys(recording.surface);
    });

    unmount();
    press(document.body, { key: 's', ctrlKey: true });

    expect(recording.asked).toEqual([]);
  });

  it('holds Hand for Space and restores the prior tool on release', () => {
    const recording = recordingSurface();
    selectTool('actor');
    renderHook(() => {
      useCommandKeys(recording.surface);
    });

    press(document.body, { key: ' ' });
    expect(currentTool().active).toBe('hand');

    document.body.dispatchEvent(
      new KeyboardEvent('keyup', { bubbles: true, key: ' ' }),
    );
    expect(currentTool().active).toBe('actor');
  });

  it('leaves Space to a focused native button', () => {
    const recording = recordingSurface();
    renderHook(() => {
      useCommandKeys(recording.surface);
    });
    const holder = markup('<button type="button">Actor</button>');

    const event = press(holder.firstElementChild ?? holder, { key: ' ' });

    expect(event.defaultPrevented).toBe(false);
    expect(currentTool().active).toBe('select');
  });
});

function Reader() {
  const surface = useCommandSurface();
  return (
    <button
      onClick={() => {
        surface.files.save();
      }}
      type="button"
    >
      Ask
    </button>
  );
}

describe('CommandSurfaceProvider', () => {
  it('hands the surface it was given to everything below it', () => {
    const recording = recordingSurface();
    render(
      <CommandSurfaceProvider surface={recording.surface}>
        <Reader />
      </CommandSurfaceProvider>,
    );

    screen.getByRole('button', { name: 'Ask' }).click();

    expect(recording.asked).toEqual(['save']);
  });
});
