import { elementTools } from './elements.js';
import {
  currentTool,
  finishPlacement,
  holdHandTool,
  lockTool,
  releaseHandTool,
  resetTools,
  selectTool,
} from './tools.js';

describe('the toolbox mode', () => {
  beforeEach(() => {
    resetTools();
  });

  it.each(elementTools)('selects the %s tool without locking it', (tool) => {
    selectTool(tool);

    expect(currentTool()).toMatchObject({ active: tool, locked: false });
  });

  it('returns an unlocked element tool to Select after placement', () => {
    selectTool('actor');

    finishPlacement();

    expect(currentTool()).toMatchObject({ active: 'select', locked: false });
  });

  it('keeps a locked element tool after placement', () => {
    lockTool('store');

    finishPlacement();

    expect(currentTool()).toMatchObject({ active: 'store', locked: true });
  });

  it('holds Hand only until Space is released', () => {
    lockTool('boundary-box');

    holdHandTool();
    expect(currentTool()).toMatchObject({ active: 'hand', locked: false });

    releaseHandTool();
    expect(currentTool()).toMatchObject({
      active: 'boundary-box',
      locked: true,
    });
  });

  it('leaves a hand chosen directly active after a spurious release', () => {
    selectTool('hand');

    releaseHandTool();

    expect(currentTool()).toMatchObject({ active: 'hand', locked: false });
  });
});
