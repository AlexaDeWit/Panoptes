import { parsedFixture } from '@panoptes/model/fixtures';
import type {
  ThreatDragonDiagram,
  ThreatDragonThreat,
} from '@panoptes/wire-threat-dragon';
import { renderDivergences } from './divergence.js';
import {
  diagramsById,
  mergeDiagram,
  numberDiagrams,
} from './threat-dragon-diagrams.js';
import type { ModelInput } from './threat-dragon.fixtures.js';

const diagram = (id: string): ModelInput['diagrams'][number] => ({
  id,
  title: `Diagram ${id}`,
  elements: [],
});

const model = (ids: readonly string[]) =>
  parsedFixture({
    metadata: { title: '', owner: '', description: '', contributors: [] },
    diagrams: ids.map(diagram),
    threats: [],
    lastIssuedThreatNumber: 0,
    mitigations: [],
    assumptions: [],
  } satisfies ModelInput);

const held = (ids: readonly number[]): ThreatDragonDiagram[] =>
  ids.map((id) => ({
    id,
    title: `Diagram ${id}`,
    diagramType: 'STRIDE',
    thumbnail: './public/content/images/thumbnail.stride.jpg',
    version: '2.6.2',
  }));

const numbering = (
  ids: readonly string[],
  source: readonly number[],
  declaredTop?: number,
) =>
  numberDiagrams(
    model(ids),
    diagramsById({
      version: '2.6.2',
      summary: { title: '' },
      detail: { diagrams: held(source), diagramTop: declaredTop },
    }),
    declaredTop,
  );

describe('numbering the diagrams of a model', () => {
  it('keeps the number the source document gave a diagram it holds', () => {
    expect(numbering(['0', '3'], [0, 3], 4).numbers).toEqual([0, 3]);
  });

  it('takes a free number a diagram names itself, so a projection matches', () => {
    expect(numbering(['0', '3'], []).numbers).toEqual([0, 3]);
  });

  it('numbers a new diagram above every number in use, never into a gap', () => {
    const numbered = numbering(['0', '3', 'perimeter'], [0, 3]);
    expect(numbered.numbers).toEqual([0, 3, 4]);
  });

  it('numbers two named diagrams consecutively, taking no number twice', () => {
    expect(numbering(['a', 'b'], [0, 3]).numbers).toEqual([4, 5]);
  });

  it('numbers a diagram the model named, and says the name has no home', () => {
    const numbered = numbering(['0', 'perimeter'], [0], 1);
    expect(numbered.numbers).toEqual([0, 1]);
    expect(renderDivergences(numbered.divergences)).toBe(
      'diagram "perimeter": the name, which the format numbers a diagram rather than naming one, written as 1 (no place in the format)',
    );
  });
});

describe('the diagram high-water mark', () => {
  it('repeats what the file declared where no number was issued', () => {
    expect(numbering(['0', '3'], [0, 3], 9).diagramTop.value).toBe(9);
  });

  it('covers what a file declaring no mark of its own already holds', () => {
    expect(numbering(['0', '3'], [0, 3]).diagramTop.value).toBe(4);
  });

  it('rises to cover a number this write assigned', () => {
    expect(numbering(['0', 'perimeter'], [0], 8).diagramTop.value).toBe(9);
  });
});

describe('drawing one diagram of the model', () => {
  const cells = new Map<string, readonly ThreatDragonThreat[]>();

  it('takes what Threat Dragon writes for a diagram of no methodology', () => {
    expect(
      mergeDiagram(model(['a']).diagrams[0], undefined, 0, cells).diagram,
    ).toEqual({
      id: 0,
      title: 'Diagram a',
      diagramType: 'Generic',
      thumbnail: './public/content/images/thumbnail.jpg',
      cells: undefined,
    });
  });

  it('keeps the methodology and the thumbnail a held diagram declared', () => {
    expect(
      mergeDiagram(model(['0']).diagrams[0], held([0])[0], 0, cells).diagram,
    ).toMatchObject({
      diagramType: 'STRIDE',
      thumbnail: './public/content/images/thumbnail.stride.jpg',
    });
  });

  it('drops a cell the model no longer draws, and says what it held', () => {
    const source: ThreatDragonDiagram = {
      ...held([0])[0],
      cells: [
        {
          id: 'cell-gone',
          shape: 'store',
          position: { x: 0, y: 0 },
          size: { width: 10, height: 10 },
          data: { type: 'tm.Store' },
        },
      ],
    };
    const merged = mergeDiagram(model(['0']).diagrams[0], source, 0, cells);
    expect(merged.diagram.cells).toEqual([]);
    expect(renderDivergences(merged.divergences)).toBe(
      'element "cell-gone": the store cell the source document held (removed by an edit)',
    );
  });
});
