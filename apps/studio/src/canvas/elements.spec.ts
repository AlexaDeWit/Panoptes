import { layoutDiagram } from '@saerskriven/canvas';
import { addElement } from '@saerskriven/model';
import { diagramId } from '@saerskriven/model/fixtures';
import { Either } from 'effect';
import {
  boundaryElement,
  canvasModel,
  noteElement,
  readerElement,
  studioElement,
} from './canvas.fixtures.js';
import {
  centredPlacement,
  defaultSize,
  draggedPlacement,
  elementTools,
  flowEnds,
  freshBoundaryCurve,
  freshElement,
  freshFlow,
  placeholderNames,
  pointerPlacement,
} from './elements.js';
const layout = layoutDiagram(canvasModel.diagrams[0], canvasModel);

const mainDiagram = diagramId('diagram-main');

describe('placement geometry', () => {
  it.each(elementTools)('centres a default-sized %s on a click', (kind) => {
    const placed = centredPlacement(kind, { x: 100, y: 80 });
    const size = defaultSize(kind);

    expect(placed).toEqual({
      position: { x: 100 - size.width / 2, y: 80 - size.height / 2 },
      size,
    });
  });

  it('draws an element between either ordering of its corners', () => {
    expect(
      draggedPlacement('actor', { x: 180, y: 90 }, { x: 20, y: 30 }),
    ).toEqual({
      position: { x: 20, y: 30 },
      size: { width: 160, height: 60 },
    });
  });

  it('takes the shorter side for a process', () => {
    expect(
      draggedPlacement('process', { x: 100, y: 100 }, { x: 20, y: 40 }),
    ).toEqual({
      position: { x: 40, y: 40 },
      size: { width: 60, height: 60 },
    });
  });

  it('keeps a one-dimensional drag drawable', () => {
    expect(
      draggedPlacement('store', { x: 0, y: 0 }, { x: 50, y: 0 }).size,
    ).toEqual({ width: 50, height: 1 });
  });

  it('treats movement below four screen pixels as a click', () => {
    expect(
      pointerPlacement('actor', { x: 100, y: 80 }, { x: 102, y: 82 }, 3.9),
    ).toEqual(centredPlacement('actor', { x: 100, y: 80 }));
  });

  it('treats movement at four screen pixels as a drag', () => {
    expect(
      pointerPlacement('actor', { x: 100, y: 80 }, { x: 104, y: 84 }, 4),
    ).toEqual({
      position: { x: 100, y: 80 },
      size: { width: 4, height: 4 },
    });
  });
});

describe('freshElement', () => {
  it.each(elementTools)('builds a %s the model accepts', (kind) => {
    const added = addElement(
      canvasModel,
      mainDiagram,
      freshElement(kind, { x: 0, y: 400 }),
    );

    expect(Either.isRight(added)).toBe(true);
  });

  it('gives a placed element its placeholder name', () => {
    expect(freshElement('actor', { x: 0, y: 0 }).name).toBe(
      placeholderNames.actor,
    );
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

  it('draws a committed boundary curve through exactly its clicked waypoints', () => {
    const boundary = freshBoundaryCurve([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ]);

    expect(boundary).toMatchObject({
      kind: 'trust-boundary',
      shape: {
        kind: 'curve',
        waypoints: [
          { x: 10, y: 20 },
          { x: 30, y: 40 },
        ],
      },
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
