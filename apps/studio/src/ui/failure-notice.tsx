import { DetectionFailure, ReadFailure } from '@panoptes/formats';
import { OperationFailure, type ParseIssue } from '@panoptes/model';
import { StudioFailure } from '../store/state.js';
import styles from './failure-notice.module.css';

/** A refusal as a person reads it: one sentence, and the paths under it. */
export type FailureDescription = {
  readonly headline: string;
  readonly details: readonly string[];
};

/**
 * A refusal in words. Every variant is worded, so nothing reaches a person
 * as a tag, and a refusal a codec produced keeps its paths: they are what
 * says which line of a file was refused rather than that the file was.
 */
export function describeFailure(failure: StudioFailure): FailureDescription {
  return StudioFailure.$match(failure, {
    Operation: ({ failure: refusal }) => ({
      headline: 'The model refused the edit.',
      details: [describeOperation(refusal)],
    }),
    Read: ({ name, failure: refusal }) => describeRead(name, refusal),
    File: ({ reason }) => ({
      headline: 'Panoptes could not reach the file.',
      details: [reason],
    }),
  });
}

/** What a {@link FailureNotice} shows, and nothing while there is none. */
export type FailureNoticeProps = {
  readonly failure: StudioFailure | undefined;
};

/**
 * The last refusal, wherever it arose. The region is always in the page, so
 * a refusal that arrives while the person is elsewhere is announced rather
 * than appearing in silence, and it holds nothing at all while there is
 * nothing to say.
 */
export function FailureNotice({ failure }: FailureNoticeProps) {
  const described =
    failure === undefined ? undefined : describeFailure(failure);

  return (
    <section
      aria-label="Problems"
      aria-live="polite"
      className={styles.notice}
      data-testid="failure-notice"
    >
      {described !== undefined && (
        <>
          <p className={styles.headline}>{described.headline}</p>
          {described.details.length > 0 && (
            <ul className={styles.details}>
              {described.details.map((detail, index) => (
                <li key={`${String(index)} ${detail}`}>{detail}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function describeRead(
  name: string,
  failure: ReadFailure | DetectionFailure,
): FailureDescription {
  return DetectionFailure.$is('NoFormatClaimed')(failure)
    ? {
        headline: `No format claimed ${name}.`,
        details: [`Panoptes tried ${failure.tried.join(', ')}.`],
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
    UnknownDiagram: ({ diagramId }) =>
      `The model holds no diagram ${diagramId}.`,
    UnknownElement: ({ elementId }) =>
      `The model holds no element ${elementId}.`,
    UnknownThreat: ({ threatId }) => `The model holds no threat ${threatId}.`,
    DuplicateElementId: ({ elementId }) =>
      `The model already holds an element ${elementId}.`,
    DuplicateThreatId: ({ threatId }) =>
      `The model already holds a threat ${threatId}.`,
    ReusedThreatNumber: ({ number }) =>
      `Threat number ${String(number)} was issued already.`,
    ChangedThreatNumber: ({ threatId, number }) =>
      `Threat ${threatId} cannot take number ${String(number)}, a number being issued once.`,
    InvalidFlowEndpoint: ({ side, reference }) =>
      `The flow's ${side} names ${reference}, which cannot be one.`,
    NotResizable: ({ elementId }) => `Element ${elementId} has no size to set.`,
  });
}

function issueLines(issues: readonly ParseIssue[]): readonly string[] {
  return issues.map(
    (issue) =>
      `${issue.path.length > 0 ? issue.path.join('.') : '(root)'}: ${issue.message}`,
  );
}
