import { layoutDiagram } from '@panoptes/canvas';
import { addElement } from '@panoptes/model';
import { diagramId } from '@panoptes/model/fixtures';
import { Either } from 'effect';
import {
  boundaryElement,
  canvasModel,
  noteElement,
  readerElement,
  studioElement,
} from './canvas.fixtures.js';
import {
  flowEnds,
  freePosition,
  freshElement,
  freshFlow,
  paletteKinds,
  paletteNames,
} from './elements.js';
import { emptyLayout } from './layout.js';

const layout = layoutDiagram(canvasModel.diagrams[0], canvasModel);

const mainDiagram = diagramId('diagram-main');

describe('freePosition', () => {
  it('places an element below everything the diagram draws', () => {
    const position = freePosition(layout);

    expect(position.x).toBe(layout.bounds.x);
    expect(position.y).toBeGreaterThan(layout.bounds.y + layout.bounds.height);
  });

  it('places an element on an empty diagram at all', () => {
    expect(freePosition(emptyLayout)).toEqual({ x: 0, y: 40 });
  });
});

describe('freshElement', () => {
  it.each(paletteKinds)('builds a %s the model accepts', (kind) => {
    const added = addElement(
      canvasModel,
      mainDiagram,
      freshElement(kind, { x: 0, y: 400 }),
    );

    expect(Either.isRight(added)).toBe(true);
  });

  it('names the element what the button that added it says', () => {
    expect(freshElement('actor', { x: 0, y: 0 }).name).toBe(paletteNames.actor);
  });

  it('gives every element an id of its own', () => {
    const first = freshElement('process', { x: 0, y: 0 });
    const second = freshElement('process', { x: 0, y: 0 });

    expect(first.id).not.toBe(second.id);
  });

  it('draws a boundary curve through waypoints rather than as a box', () => {
    const boundary = freshElement('boundary-curve', { x: 10, y: 20 });

    expect(boundary).toMatchObject({
      kind: 'trust-boundary',
      shape: { kind: 'curve' },
    });
  });
});

describe('freshFlow', () => {
  it('attaches both ends to the elements it runs between', () => {
    const flow = freshFlow(readerElement, studioElement);

    expect(flow).toMatchObject({
      kind: 'flow',
      source: { kind: 'attached', element: readerElement },
      target: { kind: 'attached', element: studioElement },
      waypoints: [],
    });
  });

  it('builds a flow the model accepts', () => {
    expect(
      Either.isRight(
        addElement(
          canvasModel,
          mainDiagram,
          freshFlow(readerElement, studioElement),
        ),
      ),
    ).toBe(true);
  });
});

describe('flowEnds', () => {
  it('offers the elements a flow runs between', () => {
    expect(flowEnds(layout).map((node) => node.id)).toEqual([
      readerElement,
      studioElement,
    ]);
  });

  it('offers no trust boundary, which a flow crosses rather than ends on', () => {
    expect(flowEnds(layout).some((node) => node.id === boundaryElement)).toBe(
      false,
    );
  });

  it('offers no text note, which is about the diagram rather than a part of it', () => {
    expect(flowEnds(layout).some((node) => node.id === noteElement)).toBe(
      false,
    );
  });
});
