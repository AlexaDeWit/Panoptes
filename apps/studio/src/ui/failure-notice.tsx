import { DetectionFailure, ReadFailure } from '@saerskriven/formats';
import { OperationFailure, type ParseIssue } from '@saerskriven/model';
import { Action } from '../store/actions.js';
import { StudioFailure } from '../store/state.js';
import { dispatch } from '../store/store.js';
import styles from './failure-notice.module.css';
import { LiveRegion } from './live-region.js';

/** A refusal as a person reads it: one sentence, and the paths under it. */
export type FailureDescription = {
  readonly headline: string;
  readonly details: readonly string[];
};

/** Formats every failure variant and retains schema paths. */
export function describeFailure(failure: StudioFailure): FailureDescription {
  return StudioFailure.$match(failure, {
    Operation: ({ failure: refusal }) => ({
      headline: 'The model refused the edit.',
      details: [describeOperation(refusal)],
    }),
    Read: ({ name, failure: refusal }) => describeRead(name, refusal),
    File: ({ reason }) => ({
      headline: 'Saerskriven could not reach the file.',
      details: [reason],
    }),
    StoredRecoveryRejected: ({ reason }) => ({
      headline: 'Saerskriven rejected the stored recovery snapshot.',
      details: [reason],
    }),
    RecoveryUnavailable: ({ reason }) => ({
      headline: 'Local recovery is unavailable.',
      details: [reason],
    }),
  });
}

/** What a {@link FailureNotice} shows, and nothing while there is none. */
export type FailureNoticeProps = {
  readonly failure: StudioFailure | undefined;
};

/** Announces the last failure in a live region until dismissal or resolution. */
export function FailureNotice({ failure }: FailureNoticeProps) {
  const described =
    failure === undefined ? undefined : describeFailure(failure);

  return (
    <LiveRegion
      className={styles.notice}
      label="Problems"
      testId="failure-notice"
    >
      {described !== undefined && (
        <>
          <p className={styles.headline}>{described.headline}</p>
          {described.details.length > 0 && (
            <FailureDetails details={described.details} />
          )}
          <button
            className={styles.dismiss}
            onClick={() => {
              dispatch(Action.DismissFailure());
            }}
            type="button"
          >
            Dismiss problem
          </button>
        </>
      )}
    </LiveRegion>
  );
}

function FailureDetails({ details }: { readonly details: readonly string[] }) {
  const lines = (
    <ul className={styles.details}>
      {details.map((detail, index) => (
        <li key={`${String(index)} ${detail}`}>{detail}</li>
      ))}
    </ul>
  );
  return details.length > 1 ? (
    <details>
      <summary>{details.length} refusal details</summary>
      {lines}
    </details>
  ) : (
    lines
  );
}

function describeRead(
  name: string,
  failure: ReadFailure | DetectionFailure,
): FailureDescription {
  return DetectionFailure.$is('NoFormatClaimed')(failure)
    ? {
        headline: `No format claimed ${name}.`,
        details: [`Saerskriven tried ${failure.tried.join(', ')}.`],
      }
    : ReadFailure.$match(failure, {
        ExceededReadLimit: ({ limit, bound, observed }) => ({
          headline: `${name} is past a read bound, so nothing read it.`,
          details: [
            `${limit}: the bound is ${String(bound)}, the file reached ${String(observed)}.`,
          ],
        }),
        MalformedText: ({ message }) => ({
          headline: `${name} is not valid text of the format that claimed it.`,
          details: [message],
        }),
        InvalidWireDocument: ({ issues }) => ({
          headline: `${name} is not a valid document of the format that claimed it.`,
          details: issueLines(issues),
        }),
        InvalidModel: ({ issues }) => ({
          headline: `${name} is a valid document, and the model it maps to is not.`,
          details: issueLines(issues),
        }),
      });
}

function describeOperation(failure: OperationFailure): string {
  return OperationFailure.$match(failure, {
    InvalidElementProperties: ({ issues }) =>
      `The element properties were refused: ${issueLines(issues).join(' ')}`,
    InvalidElementRelationship: ({ issues }) =>
      `The element has invalid boundary relationships: ${issueLines(issues).join(' ')}`,
    InvalidFragment: ({ issues }) =>
      `The copied graph was refused. ${issueLines(issues).join(' ')}`,
    UnknownDiagram: ({ diagramId }) =>
      `The model holds no diagram ${diagramId}.`,
    DuplicateDiagramId: ({ diagramId }) =>
      `The model already holds a diagram ${diagramId}.`,
    EmptyTitle: ({ diagramId }) =>
      `Diagram ${diagramId} cannot be left without a title.`,
    RefusedTitleCharacter: ({ diagramId }) =>
      `The title for diagram ${diagramId} carries a character the model does not accept.`,
    DiagramNotEmpty: ({ diagramId, elements }) =>
      `Diagram ${diagramId} cannot be removed while it holds elements, and it holds ${String(elements)}.`,
    UnknownElement: ({ elementId }) =>
      `The model holds no element ${elementId}.`,
    UnknownThreat: ({ threatId }) => `The model holds no threat ${threatId}.`,
    UnknownMitigation: ({ mitigationId }) =>
      `The model holds no mitigation ${mitigationId}.`,
    UnknownAssumption: ({ assumptionId }) =>
      `The model holds no assumption ${assumptionId}.`,
    DuplicateElementId: ({ elementId }) =>
      `The model already holds an element ${elementId}.`,
    DuplicateThreatId: ({ threatId }) =>
      `The model already holds a threat ${threatId}.`,
    DuplicateMitigationId: ({ mitigationId }) =>
      `The model already holds a mitigation ${mitigationId}.`,
    DuplicateAssumptionId: ({ assumptionId }) =>
      `The model already holds an assumption ${assumptionId}.`,
    ReusedThreatNumber: ({ number }) =>
      `Threat number ${String(number)} was issued already.`,
    ChangedThreatNumber: ({ threatId, number }) =>
      `Threat ${threatId} cannot take number ${String(number)}, a number being issued once.`,
    InvalidFlowEndpoint: ({ side, reference }) =>
      `The flow's ${side} names ${reference}, which cannot be one.`,
    NotResizable: ({ elementId }) => `Element ${elementId} has no size to set.`,
    NotTextElement: ({ elementId }) =>
      `Element ${elementId} is not a canvas note.`,
    NotFlowElement: ({ elementId }) => `Element ${elementId} is not a flow.`,
    EmptyName: ({ elementId }) =>
      `Element ${elementId} cannot be left without a name.`,
    RefusedCharacter: ({ elementId }) =>
      `The text for element ${elementId} carries a character the model does not accept.`,
  });
}

function issueLines(issues: readonly ParseIssue[]): readonly string[] {
  return issues.map(
    (issue) =>
      `${issue.path.length > 0 ? issue.path.join('.') : '(root)'}: ${issue.message}`,
  );
}
