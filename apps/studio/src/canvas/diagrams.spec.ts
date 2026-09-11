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
import { showDiagram, stepDiagram } from './diagrams.js';

const shown = (): string | undefined => activeDiagramId(modelStore.getState());

beforeEach(() => {
  modelStore.setState(initialState(twoDiagramModel), true);
  resetAnnouncements();
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
