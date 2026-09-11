import type { Model } from '@saerskriven/model';
import { diagramId, parsedFixture } from '@saerskriven/model/fixtures';
import { renderRegister, renderSvg, renderTypst } from '@saerskriven/render';
import { PdfFailure, type PdfAssets } from '@saerskriven/render/pdf';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Either } from 'effect';
import { initialState, FileLifecycle } from '../store/state.js';
import { modelStore } from '../store/store.js';
import {
  foreignSource,
  mainDiagram,
  sampleModel,
} from '../store/store.fixtures.js';
import { SaveOutcome } from './bridge.js';
import { useExportCommands, type PdfExport } from './export-commands.js';
import { PdfAssetFailure } from './pdf-assets.js';
import { specBridge, type SpecBridge } from './files.fixtures.js';

const assets: PdfAssets = { wasm: new Uint8Array(), fonts: [] };

const pdfExport = (answer: ReturnType<PdfExport['compile']>): PdfExport => ({
  assets: () => Promise.resolve(Either.right(assets)),
  compile: () => answer,
});

const session = (
  bridge: SpecBridge,
  pdf = pdfExport(Promise.resolve(Either.right(new Uint8Array()))),
) => renderHook(() => useExportCommands(bridge, pdf)).result;

const openedState = (model: Model = sampleModel) => ({
  ...initialState(model),
  file: FileLifecycle.Opened({ name: 'model.json', source: foreignSource }),
});

const flow = (id: string, target: string): Record<string, unknown> => ({
  kind: 'flow',
  id,
  name: id,
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
  source: { kind: 'attached', element: sampleModel.diagrams[0].elements[0].id },
  target: { kind: 'attached', element: target },
  waypoints: [],
  bidirectional: false,
});

const unplacedModel = parsedFixture({
  ...sampleModel,
  diagrams: [
    {
      ...sampleModel.diagrams[0],
      elements: [
        ...sampleModel.diagrams[0].elements,
        flow('flow-1', sampleModel.diagrams[0].elements[1].id),
        flow('flow-2', 'flow-1'),
      ],
    },
  ],
});

beforeEach(() => {
  modelStore.setState(openedState(), true);
});

describe('the studio exports', () => {
  it('writes every text projection directly from render under the file name', async () => {
    const bridge = specBridge();
    const result = session(bridge);

    act(() => {
      result.current.commands.diagram(mainDiagram);
      result.current.commands.register();
      result.current.commands.typst();
    });

    await waitFor(() => {
      expect(bridge.writes).toHaveLength(3);
    });
    expect(bridge.writes.map((write) => write.name)).toEqual([
      'model.svg',
      'model.md',
      'model.typ',
    ]);
    expect(bridge.writes.map((write) => write.text)).toEqual([
      renderSvg(sampleModel.diagrams[0], sampleModel).svg,
      renderRegister(sampleModel),
      renderTypst(sampleModel).typst,
    ]);
  });

  it('compiles the render projection and writes the PDF as binary content', async () => {
    const bridge = specBridge();
    const bytes = new Uint8Array([37, 80, 68, 70, 45]);
    const compile = vi.fn<PdfExport['compile']>(() =>
      Promise.resolve(Either.right(bytes)),
    );
    const result = session(bridge, {
      assets: () => Promise.resolve(Either.right(assets)),
      compile,
    });

    act(() => {
      result.current.commands.pdf();
    });

    await waitFor(() => {
      expect(bridge.writes).toHaveLength(1);
    });
    expect(compile).toHaveBeenCalledWith(
      renderTypst(sampleModel).typst,
      assets,
    );
    expect(bridge.writes[0]).toMatchObject({ name: 'model.pdf', text: '' });
    expect(bridge.writes[0].bytes).toEqual(bytes);
  });

  it('reports every unplaced endpoint after it still writes the export', async () => {
    modelStore.setState(openedState(unplacedModel), true);
    const bridge = specBridge();
    const result = session(bridge);

    act(() => {
      result.current.commands.diagram(mainDiagram);
    });

    await waitFor(() => {
      expect(result.current.notice).toBeDefined();
    });
    expect(bridge.writes).toHaveLength(1);
    expect(result.current.notice).toEqual({
      headline:
        'warning: a flow endpoint names an element the canvas draws as no box, so its flow is not in the drawing.',
      details: ['flow "flow-2" target names "flow-1"'],
    });
  });

  it('reports a compiler refusal and writes nothing', async () => {
    const bridge = specBridge();
    const result = session(
      bridge,
      pdfExport(
        Promise.resolve(
          Either.left(
            PdfFailure.Refused({ sentences: ['unknown function: nope'] }),
          ),
        ),
      ),
    );

    act(() => {
      result.current.commands.pdf();
    });

    await waitFor(() => {
      expect(result.current.notice).toEqual({
        headline: 'Saerskriven could not compile the PDF.',
        details: ['unknown function: nope'],
      });
    });
    expect(bridge.writes).toEqual([]);
  });

  it('reports unavailable assets before it asks the compiler', async () => {
    const bridge = specBridge();
    const compile = vi.fn<PdfExport['compile']>();
    const result = session(bridge, {
      assets: () =>
        Promise.resolve(
          Either.left(PdfAssetFailure.Unavailable({ reason: 'offline' })),
        ),
      compile,
    });

    act(() => {
      result.current.commands.pdf();
    });

    await waitFor(() => {
      expect(result.current.notice).toEqual({
        headline: 'Saerskriven could not load the PDF compiler.',
        details: ['offline'],
      });
    });
    expect(compile).not.toHaveBeenCalled();
    expect(bridge.writes).toEqual([]);
  });

  it('reports an absent PDF document and writes nothing', async () => {
    const bridge = specBridge();
    const result = session(
      bridge,
      pdfExport(Promise.resolve(Either.left(PdfFailure.NoDocument()))),
    );

    act(() => {
      result.current.commands.pdf();
    });

    await waitFor(() => {
      expect(result.current.notice?.headline).toBe(
        'The Typst compiler produced no PDF.',
      );
    });
    expect(bridge.writes).toEqual([]);
  });

  it('reports a refused write and lets the report be dismissed', async () => {
    const bridge = specBridge({
      save: SaveOutcome.Refused({ reason: 'NotAllowedError' }),
    });
    const result = session(bridge);

    act(() => {
      result.current.commands.register();
    });

    await waitFor(() => {
      expect(result.current.notice?.headline).toBe(
        'Saerskriven could not write the export.',
      );
    });
    act(() => {
      result.current.dismissNotice();
    });
    expect(result.current.notice).toBeUndefined();
  });

  it('says nothing when the export picker is cancelled', async () => {
    const bridge = specBridge();
    vi.spyOn(bridge, 'exportFile')
      .mockResolvedValueOnce(SaveOutcome.Refused({ reason: 'NotAllowedError' }))
      .mockResolvedValueOnce(SaveOutcome.Cancelled());
    const result = session(bridge);

    act(() => {
      result.current.commands.register();
    });
    await waitFor(() => {
      expect(result.current.notice).toBeDefined();
    });

    act(() => {
      result.current.commands.register();
    });
    await waitFor(() => {
      expect(result.current.notice).toBeUndefined();
    });
  });

  it('uses the only diagram when the registry supplies no id', async () => {
    const bridge = specBridge();
    const result = session(bridge);

    act(() => {
      result.current.commands.diagram();
    });

    await waitFor(() => {
      expect(bridge.writes[0]?.name).toBe('model.svg');
    });
  });

  it('writes nothing when no diagram or id chooses one', () => {
    modelStore.setState(
      openedState({
        ...sampleModel,
        diagrams: [
          sampleModel.diagrams[0],
          { id: diagramId('other'), title: 'Other', elements: [] },
        ],
      }),
      true,
    );
    const bridge = specBridge();
    const result = session(bridge);

    act(() => {
      result.current.commands.diagram();
      result.current.commands.diagram(diagramId('missing'));
    });

    expect(bridge.writes).toEqual([]);
  });

  it('uses Untitled when the model has no open file', async () => {
    modelStore.setState(initialState(sampleModel), true);
    const bridge = specBridge();
    const result = session(bridge);

    act(() => {
      result.current.commands.register();
    });

    await waitFor(() => {
      expect(bridge.writes[0]?.name).toBe('Untitled.md');
    });
  });
});
