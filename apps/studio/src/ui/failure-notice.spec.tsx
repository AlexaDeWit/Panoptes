import { DetectionFailure, ReadFailure } from '@saerskriven/formats';
import { OperationFailure } from '@saerskriven/model';
import {
  assumptionId,
  diagramId,
  elementId,
  mitigationId,
  threatId,
} from '@saerskriven/model/fixtures';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Action } from '../store/actions.js';
import { isDirty } from '../store/selectors.js';
import { StudioFailure, initialState } from '../store/state.js';
import { sampleModel } from '../store/store.fixtures.js';
import { dispatch, modelStore, useModelStore } from '../store/store.js';
import { FailureNotice, describeFailure } from './failure-notice.js';

function StoredFailureNotice() {
  return (
    <FailureNotice failure={useModelStore((state) => state.lastFailure)} />
  );
}

const dirtyStart = {
  ...initialState(sampleModel),
  saved: { ...sampleModel },
};

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
  InvalidElementProperties: OperationFailure.InvalidElementProperties({
    elementId: elementId('element-api'),
    issues: [
      { path: ['kind'], code: 'custom', message: 'Element kind changed.' },
    ],
  }),
  InvalidElementRelationship: OperationFailure.InvalidElementRelationship({
    elementId: elementId('element-api'),
    issues: [
      {
        path: ['trustBoundaryIds', 0],
        code: 'custom',
        message: 'Unknown boundary.',
      },
    ],
  }),
  InvalidFragment: OperationFailure.InvalidFragment({
    issues: [
      {
        path: ['diagrams'],
        code: 'custom',
        message: 'Duplicate copied element.',
      },
    ],
  }),
  DuplicateDiagramId: OperationFailure.DuplicateDiagramId({
    diagramId: diagramId('diagram-main'),
  }),
  EmptyTitle: OperationFailure.EmptyTitle({
    diagramId: diagramId('diagram-main'),
  }),
  RefusedTitleCharacter: OperationFailure.RefusedTitleCharacter({
    diagramId: diagramId('diagram-main'),
    at: 2,
  }),
  UnknownDiagram: OperationFailure.UnknownDiagram({
    diagramId: diagramId('diagram-missing'),
  }),
  DiagramNotEmpty: OperationFailure.DiagramNotEmpty({
    diagramId: diagramId('diagram-main'),
    elements: 3,
  }),
  UnknownElement: OperationFailure.UnknownElement({
    elementId: elementId('element-missing'),
  }),
  UnknownThreat: OperationFailure.UnknownThreat({
    threatId: threatId('threat-missing'),
  }),
  UnknownMitigation: OperationFailure.UnknownMitigation({
    mitigationId: mitigationId('mitigation-missing'),
  }),
  UnknownAssumption: OperationFailure.UnknownAssumption({
    assumptionId: assumptionId('assumption-missing'),
  }),
  DuplicateElementId: OperationFailure.DuplicateElementId({
    elementId: elementId('element-twice'),
  }),
  DuplicateThreatId: OperationFailure.DuplicateThreatId({
    threatId: threatId('threat-twice'),
  }),
  DuplicateMitigationId: OperationFailure.DuplicateMitigationId({
    mitigationId: mitigationId('mitigation-twice'),
  }),
  DuplicateAssumptionId: OperationFailure.DuplicateAssumptionId({
    assumptionId: assumptionId('assumption-twice'),
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
  NotTextElement: OperationFailure.NotTextElement({
    elementId: elementId('element-process'),
  }),
  NotFlowElement: OperationFailure.NotFlowElement({
    elementId: elementId('element-process'),
  }),
  EmptyName: OperationFailure.EmptyName({
    elementId: elementId('element-unnamed'),
  }),
  RefusedCharacter: OperationFailure.RefusedCharacter({
    elementId: elementId('element-unnamed'),
    at: 3,
  }),
  RefusedMetadataCharacter: OperationFailure.RefusedMetadataCharacter({
    field: 'title',
    at: 3,
  }),
  RefusedContributorCharacter: OperationFailure.RefusedContributorCharacter({
    contributor: 0,
    at: 3,
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
  StoredRecoveryRejected: StudioFailure.StoredRecoveryRejected({
    reason: 'The stored snapshot is malformed or unsupported.',
  }),
  RecoveryUnavailable: StudioFailure.RecoveryUnavailable({
    reason: 'The browser refused storage.',
  }),
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
          tried: ['threat-dragon', 'saerskriven-yaml'],
        }),
      }),
    );

    expect(described.headline).toContain('notes.txt');
    expect(described.details[0]).toContain('threat-dragon, saerskriven-yaml');
  });

  it('distinguishes rejected recovery data from unavailable storage', () => {
    expect(
      describeFailure(studioFailures.StoredRecoveryRejected).headline,
    ).toContain('rejected');
    expect(describeFailure(studioFailures.RecoveryUnavailable).headline).toBe(
      'Local recovery is unavailable.',
    );
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
  beforeEach(() => {
    modelStore.setState(dirtyStart, true);
  });

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

  it('leaves one detail line open beside the headline', () => {
    const { container } = render(
      <FailureNotice failure={studioFailures.Read} />,
    );

    expect(container.querySelector('details')).toBeNull();
  });

  it('folds several detail lines behind a disclosure naming their count', () => {
    const issues = [issue, { ...issue, path: ['detail', 'threats', 1] }];
    const { container } = render(
      <FailureNotice
        failure={StudioFailure.Read({
          name: 'broken.json',
          failure: ReadFailure.InvalidWireDocument({ issues }),
        })}
      />,
    );
    const summary = screen.getByText(
      new RegExp(`^${String(issues.length)}\\b`, 'u'),
    );

    expect(summary.tagName).toBe('SUMMARY');
    expect(container.querySelector('details')).not.toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(issues.length);
  });

  it('clears itself without moving the model, the stacks or the dirty state', async () => {
    dispatch(Action.FileRefused({ operation: 'open', reason: 'no' }));
    render(<StoredFailureNotice />);
    const before = modelStore.getState();

    await userEvent.click(
      screen.getByRole('button', { name: 'Dismiss problem' }),
    );

    const after = modelStore.getState();
    expect(after.lastFailure).toBeUndefined();
    expect(after.present).toBe(before.present);
    expect(after.past).toBe(before.past);
    expect(after.future).toBe(before.future);
    expect(isDirty(after)).toBe(isDirty(before));
    expect(screen.getByTestId('failure-notice').textContent).toBe('');
  });

  it('shows a later refusal after a dismissal', async () => {
    dispatch(Action.FileRefused({ operation: 'open', reason: 'no' }));
    render(<StoredFailureNotice />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Dismiss problem' }),
    );

    act(() => {
      dispatch(
        Action.ReadFailed({
          name: 'notes.txt',
          failure: ReadFailure.MalformedText({ message: 'not YAML' }),
        }),
      );
    });

    expect(screen.getByTestId('failure-notice').textContent).toContain(
      'notes.txt',
    );
  });
});
