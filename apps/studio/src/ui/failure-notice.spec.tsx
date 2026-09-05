import { DetectionFailure, ReadFailure } from '@panoptes/formats';
import { OperationFailure } from '@panoptes/model';
import { render, screen } from '@testing-library/react';
import { StudioFailure } from '../store/state.js';
import { diagramId, elementId, threatId } from '../store/store.fixtures.js';
import { FailureNotice, describeFailure } from './failure-notice.js';

type ByTag<Union extends { readonly _tag: string }> = {
  readonly [Tag in Union['_tag']]: Extract<Union, { readonly _tag: Tag }>;
};

const issue = {
  path: ['detail', 'diagrams', 0],
  message: 'is required',
  code: 'invalid_type',
};

const readFailures: ByTag<ReadFailure> = {
  ExceededReadLimit: ReadFailure.ExceededReadLimit({
    limit: 'maxTextBytes',
    bound: 4,
    observed: 40,
  }),
  MalformedText: ReadFailure.MalformedText({ message: 'unexpected token' }),
  InvalidWireDocument: ReadFailure.InvalidWireDocument({ issues: [issue] }),
  InvalidModel: ReadFailure.InvalidModel({ issues: [issue] }),
};

const operationFailures: ByTag<OperationFailure> = {
  UnknownDiagram: OperationFailure.UnknownDiagram({
    diagramId: diagramId('diagram-missing'),
  }),
  UnknownElement: OperationFailure.UnknownElement({
    elementId: elementId('element-missing'),
  }),
  UnknownThreat: OperationFailure.UnknownThreat({
    threatId: threatId('threat-missing'),
  }),
  DuplicateElementId: OperationFailure.DuplicateElementId({
    elementId: elementId('element-twice'),
  }),
  DuplicateThreatId: OperationFailure.DuplicateThreatId({
    threatId: threatId('threat-twice'),
  }),
  ReusedThreatNumber: OperationFailure.ReusedThreatNumber({ number: 1 }),
  ChangedThreatNumber: OperationFailure.ChangedThreatNumber({
    threatId: threatId('threat-moved'),
    number: 2,
  }),
  InvalidFlowEndpoint: OperationFailure.InvalidFlowEndpoint({
    side: 'source',
    reference: elementId('element-missing'),
  }),
  NotResizable: OperationFailure.NotResizable({
    elementId: elementId('element-curve'),
  }),
};

const studioFailures: ByTag<StudioFailure> = {
  Operation: StudioFailure.Operation({
    failure: operationFailures.UnknownElement,
  }),
  Read: StudioFailure.Read({
    name: 'broken.json',
    failure: readFailures.InvalidWireDocument,
  }),
  File: StudioFailure.File({ reason: 'The folder is read only.' }),
};

describe('describeFailure', () => {
  for (const failure of Object.values(studioFailures)) {
    it(`words ${failure._tag} rather than showing its tag`, () => {
      const described = describeFailure(failure);

      expect(described.headline.length > 0).toBe(true);
      expect(described.headline).not.toContain(failure._tag);
    });
  }

  for (const failure of Object.values(readFailures)) {
    it(`words the read that stopped at ${failure._tag}, naming the file`, () => {
      const described = describeFailure(
        StudioFailure.Read({ name: 'model.json', failure }),
      );

      expect(described.headline).toContain('model.json');
      expect(described.details).toHaveLength(1);
    });
  }

  for (const failure of Object.values(operationFailures)) {
    it(`words the model refusing ${failure._tag}`, () => {
      const described = describeFailure(StudioFailure.Operation({ failure }));

      expect(described.details[0].length > 0).toBe(true);
      expect(described.details[0]).not.toContain(failure._tag);
    });
  }

  it('names every format tried where none claimed the file', () => {
    const described = describeFailure(
      StudioFailure.Read({
        name: 'notes.txt',
        failure: DetectionFailure.NoFormatClaimed({
          tried: ['threat-dragon', 'panoptes-yaml'],
        }),
      }),
    );

    expect(described.headline).toContain('notes.txt');
    expect(described.details[0]).toContain('threat-dragon, panoptes-yaml');
  });

  it('renders a path into the document a codec refused', () => {
    expect(describeFailure(studioFailures.Read).details).toEqual([
      'detail.diagrams.0: is required',
    ]);
  });

  it('says the root where an issue names no path at all', () => {
    const described = describeFailure(
      StudioFailure.Read({
        name: 'model.json',
        failure: ReadFailure.InvalidModel({
          issues: [{ path: [], message: 'is not a model', code: 'custom' }],
        }),
      }),
    );

    expect(described.details).toEqual(['(root): is not a model']);
  });
});

describe('FailureNotice', () => {
  it('holds a region in the page while there is nothing to say', () => {
    render(<FailureNotice failure={undefined} />);

    expect(screen.getByTestId('failure-notice').textContent).toBe('');
  });

  it('shows the refusal and every path under it', () => {
    render(<FailureNotice failure={studioFailures.Read} />);

    expect(
      screen.getByText(
        'broken.json is not a valid document of the format that claimed it.',
      ),
    ).toBeDefined();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
});
