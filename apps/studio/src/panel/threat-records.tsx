import type { ThreatId } from '@saerskriven/model';
import { useEffect, useId, useRef, useState, type FocusEvent } from 'react';
import { announce } from '../canvas/announcements.js';
import { dispatch, modelStore, useModelStore } from '../store/store.js';
import { EnumField } from '../ui/enum-field.js';
import { ProseField, TextField, type RefusedDraft } from '../ui/text-field.js';
import {
  editedRecord,
  isRecordField,
  linkableRecords,
  otherThreats,
  recordFieldName,
  recordIdIn,
  recordsOn,
  textOf,
  type RecordFieldName,
  type RecordKind,
  type RecordPart,
  type ThreatRecord,
} from './records.js';
import styles from './threat-panel.module.css';

/** A refused draft the panel held for this threat, by the field it was typed in. */
export type HeldText = { readonly field: string; readonly text: string };

/** One kind of record on one threat, with the refusals its fields report. */
export type RecordGroupProps<Held extends ThreatRecord> = {
  readonly kind: RecordKind<Held>;
  readonly threatId: ThreatId;
  readonly held: HeldText | undefined;
  readonly refused: ReadonlySet<string>;
  readonly onChange: () => void;
  readonly onRefused: (
    field: RecordFieldName,
    draft: RefusedDraft | undefined,
  ) => void;
};

type FocusRequest =
  | { readonly kind: 'row'; readonly recordId: string }
  | { readonly kind: 'unlinked'; readonly index: number };

const capitalized = (noun: string): string =>
  `${noun.charAt(0).toUpperCase()}${noun.slice(1)}`;

function focusTarget(
  group: HTMLFieldSetElement | null,
  focus: FocusRequest,
): HTMLElement | null | undefined {
  if (focus.kind === 'row') {
    return [
      ...(group?.querySelectorAll<HTMLElement>('[data-record-row]') ?? []),
    ]
      .find((row) => row.dataset['recordRow'] === focus.recordId)
      ?.querySelector<HTMLElement>('input, textarea');
  }
  const unlinks = group?.querySelectorAll<HTMLElement>('[data-unlink-record]');
  return (
    unlinks?.[focus.index] ??
    unlinks?.[focus.index - 1] ??
    group?.querySelector<HTMLElement>('[data-add-record]')
  );
}

/**
 * A threat's records of one kind. Add opens an empty row that becomes a
 * record on its first commit and leaves nothing behind when it is left
 * empty. Every other row edits, relinks or re-statuses a record in place.
 */
export function RecordGroup<Held extends ThreatRecord>({
  kind,
  threatId,
  held,
  refused,
  onChange,
  onRefused,
}: RecordGroupProps<Held>) {
  const all = useModelStore((state) => kind.held(state.present));
  const records = recordsOn(all, threatId);
  const linkable = linkableRecords(all, threatId);
  const group = useRef<HTMLFieldSetElement>(null);
  const [draft, setDraft] = useState<Held | undefined>(() => {
    const heldId = recordIdIn(held?.field, kind.noun);
    return heldId === undefined || all.some(({ id }) => id === heldId)
      ? undefined
      : kind.restored(threatId, heldId);
  });
  const focus = useRef<FocusRequest | undefined>(undefined);
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const drafting =
    draft !== undefined && !records.some(({ id }) => id === draft.id);
  const rows = drafting ? [...records, draft] : records;
  const live = new Set<string>(
    rows.flatMap(({ id }) =>
      kind.parts.map((part) => recordFieldName(kind.noun, part, id)),
    ),
  );
  const stale = [...refused]
    .filter((field) => isRecordField(field, kind.noun))
    .find((field) => !live.has(field));
  const offered =
    linkable.find(({ record }) => record.id === chosen) ?? linkable.at(0);
  const noun = capitalized(kind.noun);

  useEffect(() => {
    if (stale !== undefined) {
      onRefused(stale, undefined);
    }
  }, [stale, onRefused]);

  useEffect(() => {
    const request = focus.current;
    if (request !== undefined) {
      focus.current = undefined;
      focusTarget(group.current, request)?.focus();
    }
  });

  const commit =
    (record: Held, part: RecordPart) =>
    (text: string): void => {
      const next = editedRecord(kind, record, part, text);
      if (next === undefined) {
        return;
      }
      if (!drafting || record.id !== draft.id) {
        dispatch(kind.replace(next));
        return;
      }
      dispatch(kind.add(next));
      if (
        kind
          .held(modelStore.getState().present)
          .some(({ id }) => id === next.id)
      ) {
        setDraft(undefined);
      }
    };

  const left = (event: FocusEvent<HTMLElement>): void => {
    const row = event.currentTarget;
    if (
      row.contains(event.relatedTarget) ||
      [
        ...row.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
          'input, textarea',
        ),
      ].some(({ value }) => value !== '')
    ) {
      return;
    }
    setDraft(undefined);
  };

  const unlink = (record: Held, index: number): void => {
    dispatch(kind.unlink(record, threatId));
    const kept = kind
      .held(modelStore.getState().present)
      .some(({ id }) => id === record.id);
    focus.current = { kind: 'unlinked', index };
    announce(`${noun} ${String(index + 1)} ${kept ? 'unlinked' : 'removed'}.`);
  };

  return (
    <fieldset className={styles.records} ref={group}>
      <legend>{kind.heading}</legend>
      {rows.map((record, index) => (
        <RecordRow
          draft={drafting && record.id === draft.id}
          held={held}
          key={record.id}
          kind={kind}
          name={`${noun} ${String(index + 1)}`}
          onBlur={left}
          onChange={onChange}
          onCommit={(part) => commit(record, part)}
          onRefused={(part) => (refusal) => {
            onRefused(recordFieldName(kind.noun, part, record.id), refusal);
          }}
          onStatus={(status) => {
            dispatch(kind.setStatus(record, status));
          }}
          onUnlink={() => {
            unlink(record, index);
          }}
          record={record}
          threatId={threatId}
        />
      ))}
      <button
        className={styles.recordAction}
        data-add-record
        onClick={() => {
          if (drafting) {
            focusTarget(group.current, {
              kind: 'row',
              recordId: draft.id,
            })?.focus();
            return;
          }
          const opened = kind.fresh(threatId);
          focus.current = { kind: 'row', recordId: opened.id };
          setDraft(opened);
        }}
        type="button"
      >
        Add {kind.noun}
      </button>
      {offered !== undefined && (
        <div className={styles.existing}>
          <EnumField
            label={`Existing ${kind.noun}`}
            labelOf={(id) =>
              linkable.find(({ record }) => record.id === id)?.label ?? id
            }
            onCommit={setChosen}
            options={linkable.map(({ record }) => record.id)}
            value={offered.record.id}
          />
          <button
            className={styles.recordAction}
            onClick={() => {
              dispatch(kind.link(offered.record, threatId));
              focus.current = { kind: 'row', recordId: offered.record.id };
              setChosen(undefined);
            }}
            type="button"
          >
            Link existing {kind.noun}
          </button>
        </div>
      )}
    </fieldset>
  );
}

type RecordRowProps<Held extends ThreatRecord> = {
  readonly kind: RecordKind<Held>;
  readonly record: Held;
  readonly threatId: ThreatId;
  readonly name: string;
  readonly draft: boolean;
  readonly held: HeldText | undefined;
  readonly onBlur: (event: FocusEvent<HTMLElement>) => void;
  readonly onChange: () => void;
  readonly onCommit: (part: RecordPart) => (text: string) => void;
  readonly onRefused: (
    part: RecordPart,
  ) => (refusal: RefusedDraft | undefined) => void;
  readonly onStatus: (status: Held['status']) => void;
  readonly onUnlink: () => void;
};

function RecordRow<Held extends ThreatRecord>({
  kind,
  record,
  threatId,
  name,
  draft,
  held,
  onBlur,
  onChange,
  onCommit,
  onRefused,
  onStatus,
  onUnlink,
}: RecordRowProps<Held>) {
  const sharedId = useId();
  const others = otherThreats(record, threatId);
  const heldIn = (part: RecordPart): string | undefined =>
    held?.field === recordFieldName(kind.noun, part, record.id)
      ? held.text
      : undefined;
  const labelOf = (part: RecordPart): string =>
    kind.parts.length === 1
      ? name
      : `${name} ${part === 'title' ? 'title' : 'description'}`;

  return (
    <div
      className={styles.record}
      data-record-row={record.id}
      onBlur={draft ? onBlur : undefined}
    >
      {kind.parts.map((part) =>
        part === 'title' ? (
          <TextField
            held={heldIn(part)}
            key={part}
            label={labelOf(part)}
            onChange={onChange}
            onCommit={onCommit(part)}
            onRefused={onRefused(part)}
            value={textOf(record, part)}
          />
        ) : (
          <ProseField
            compact
            held={heldIn(part)}
            key={part}
            label={labelOf(part)}
            onChange={onChange}
            onCommit={onCommit(part)}
            onRefused={onRefused(part)}
            value={textOf(record, part)}
          />
        ),
      )}
      {!draft && (
        <div className={styles.recordState}>
          <EnumField
            label={`${name} status`}
            onCommit={onStatus}
            options={kind.statuses}
            value={record.status}
          />
          <button
            aria-describedby={others > 0 ? sharedId : undefined}
            className={styles.recordAction}
            data-unlink-record
            onClick={onUnlink}
            type="button"
          >
            Unlink {name.toLowerCase()}
          </button>
        </div>
      )}
      {others > 0 && (
        <p className={styles.shared} id={sharedId}>
          Also on {others} other {others === 1 ? 'threat' : 'threats'}.
        </p>
      )}
    </div>
  );
}
