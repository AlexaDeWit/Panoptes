import { diagramId } from '@saerskriven/model/fixtures';
import { recordingSurface } from '../commands/commands.fixtures.js';
import { commandById, runCommand } from '../commands/registry.js';
import { activeDiagramId } from '../store/selectors.js';
import { initialState } from '../store/state.js';
import {
  mainDiagram,
  sampleModel,
  secondDiagram,
  twoDiagramModel,
} from '../store/store.fixtures.js';
import { modelStore } from '../store/store.js';
import { currentAnnouncement, resetAnnouncements } from './announcements.js';
import {
  createDiagram,
  renameActiveDiagram,
  resetDiagramRenaming,
  showDiagram,
  stepDiagram,
  useDiagramRenaming,
  endRenamingDiagram,
} from './diagrams.js';
import { renderHook, act } from '@testing-library/react';
import { untitledDiagram } from '../store/state.js';

const shown = (): string | undefined => activeDiagramId(modelStore.getState());

beforeEach(() => {
  modelStore.setState(initialState(twoDiagramModel), true);
  resetAnnouncements();
  resetDiagramRenaming();
});

describe('showDiagram', () => {
  it('puts the diagram on screen and says which', () => {
    expect(showDiagram(secondDiagram)).toBe(true);
    expect(shown()).toBe(secondDiagram);
    expect(currentAnnouncement().message).toContain('Second');
    expect(modelStore.getState().past).toEqual([]);
  });

  it('says nothing for the diagram already on screen, or for one the model lacks', () => {
    expect(showDiagram(mainDiagram)).toBe(false);
    expect(showDiagram(diagramId('diagram-missing'))).toBe(false);
    expect(shown()).toBe(mainDiagram);
    expect(currentAnnouncement().message).toBe('');
  });
});

describe('stepDiagram', () => {
  it('steps along the list and wraps at either end', () => {
    expect(stepDiagram('next')).toBe(true);
    expect(shown()).toBe(secondDiagram);
    expect(stepDiagram('next')).toBe(true);
    expect(shown()).toBe(mainDiagram);
    expect(stepDiagram('previous')).toBe(true);
    expect(shown()).toBe(secondDiagram);
  });

  it('has nowhere to step in a model of one diagram', () => {
    modelStore.setState(initialState(sampleModel), true);
    expect(stepDiagram('next')).toBe(false);
    expect(shown()).toBe(mainDiagram);
  });

  it('is what the two registered commands run', () => {
    const { surface } = recordingSurface();
    runCommand(commandById('next-diagram'), surface);
    expect(shown()).toBe(secondDiagram);
    runCommand(commandById('previous-diagram'), surface);
    expect(shown()).toBe(mainDiagram);
  });
});

describe('createDiagram', () => {
  it('adds an untitled diagram after the others, shows it, and opens its title', () => {
    const { result } = renderHook(useDiagramRenaming);
    expect(result.current).toBe(false);

    act(() => {
      expect(createDiagram()).toBe(true);
    });

    const state = modelStore.getState();
    expect(state.present.diagrams).toHaveLength(3);
    expect(state.present.diagrams[2].title).toBe(untitledDiagram);
    expect(state.present.diagrams[2].elements).toEqual([]);
    expect(shown()).toBe(state.present.diagrams[2].id);
    expect(state.past).toHaveLength(1);
    expect(result.current).toBe(true);
    expect(currentAnnouncement().message).toContain(untitledDiagram);

    act(() => {
      endRenamingDiagram();
    });
    expect(result.current).toBe(false);
  });
});

describe('renameActiveDiagram', () => {
  it('retitles the diagram on screen as one undo step and says so', () => {
    expect(renameActiveDiagram('Renamed')).toBe(true);
    const state = modelStore.getState();
    expect(state.present.diagrams[0].title).toBe('Renamed');
    expect(state.past).toHaveLength(1);
    expect(currentAnnouncement().message).toContain('Renamed');
  });

  it('does nothing for an unchanged or refused title', () => {
    expect(renameActiveDiagram('Main')).toBe(false);
    expect(renameActiveDiagram('')).toBe(false);
    expect(modelStore.getState().past).toEqual([]);
  });

  it('is what the registered rename command opens and the new-diagram command runs', () => {
    const { surface } = recordingSurface();
    const { result } = renderHook(useDiagramRenaming);
    act(() => {
      runCommand(commandById('rename-diagram'), surface);
    });
    expect(result.current).toBe(true);
    act(() => {
      endRenamingDiagram();
      runCommand(commandById('new-diagram'), surface);
    });
    expect(modelStore.getState().present.diagrams).toHaveLength(3);
    expect(result.current).toBe(true);
  });
});
