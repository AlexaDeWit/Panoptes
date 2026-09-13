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
  recordFieldIn,
  recordFieldName,
  recordLabel,
  recordsOn,
  textOf,
  type RecordField,
  type RecordFieldName,
  type RecordKind,
  type RecordPart,
  type ThreatRecord,
} from './records.js';
import type { RefusedField } from './threat-editor.js';
import styles from './threat-panel.module.css';

type HeldText = Pick<RefusedField, 'field' | 'text'>;

type RecordGroupProps<Held extends ThreatRecord> = {
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
  | { readonly kind: 'text'; readonly recordId: string }
  | { readonly kind: 'add' }
  | { readonly kind: 'unlinked'; readonly index: number };

const rowSelector = '[data-record-row]';

function rowOf(
  group: HTMLFieldSetElement | null,
  recordId: string,
): HTMLElement | undefined {
  return [...(group?.querySelectorAll<HTMLElement>(rowSelector) ?? [])].find(
    (row) => row.dataset['recordRow'] === recordId,
  );
}

function focusTarget(
  group: HTMLFieldSetElement | null,
  focus: FocusRequest,
): HTMLElement | null | undefined {
  if (focus.kind === 'text') {
    return rowOf(group, focus.recordId)?.querySelector<HTMLElement>(
      'input, textarea',
    );
  }
  const add = group?.querySelector<HTMLElement>('[data-add-record]');
  if (focus.kind === 'add') {
    return add;
  }
  const unlinks = group?.querySelectorAll<HTMLElement>('[data-unlink-record]');
  return unlinks?.[focus.index] ?? unlinks?.[focus.index - 1] ?? add;
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
    const heldField = recordFieldIn(held?.field, kind.noun);
    return heldField === undefined ||
      !heldField.pending ||
      all.some(({ id }) => id === heldField.recordId)
      ? undefined
      : kind.restored(threatId, heldField.recordId);
  });
  const focus = useRef<FocusRequest | undefined>(undefined);
  const focusedRow = useRef<string | undefined>(undefined);
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const drafting =
    draft !== undefined && !records.some(({ id }) => id === draft.id);
  const rows = drafting ? [...records, draft] : records;
  const shown = new Set<string>(rows.map(({ id }) => id));
  const stale = [...refused, held?.field ?? '']
    .filter((field) => isRecordField(field, kind.noun))
    .find(
      (field) => !shown.has(recordFieldIn(field, kind.noun)?.recordId ?? field),
    );
  const offered =
    linkable.find(({ record }) => record.id === chosen) ?? linkable.at(0);

  useEffect(() => {
    if (stale !== undefined) {
      onRefused(stale, undefined);
    }
  }, [stale, onRefused]);

  useEffect(() => {
    const request = focus.current;
    focus.current = undefined;
    if (request !== undefined) {
      focusTarget(group.current, request)?.focus();
    }
    const lost = focusedRow.current;
    if (
      lost !== undefined &&
      rowOf(group.current, lost) === undefined &&
      !(group.current?.contains(document.activeElement) ?? false)
    ) {
      focusedRow.current = undefined;
      group.current?.querySelector<HTMLElement>('[data-add-record]')?.focus();
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
    announce(
      `${kind.title} ${recordLabel(record)} ${kept ? 'unlinked' : 'removed'}.`,
    );
  };

  const tracked = (event: FocusEvent<HTMLDivElement>): void => {
    if (event.type === 'focus') {
      focusedRow.current =
        document.activeElement?.closest<HTMLElement>(rowSelector)?.dataset[
          'recordRow'
        ];
    } else if (
      event.target.isConnected &&
      !event.currentTarget.contains(event.relatedTarget)
    ) {
      focusedRow.current = undefined;
    }
  };

  return (
    <fieldset className={styles.records} ref={group}>
      <legend>{kind.heading}</legend>
      <div className={styles.recordBody} onBlur={tracked} onFocus={tracked}>
        {rows.map((record, index) => (
          <RecordRow
            draft={drafting && record.id === draft.id}
            held={held}
            key={record.id}
            kind={kind}
            name={`${kind.title} ${String(index + 1)}`}
            onBlur={left}
            onChange={onChange}
            onCommit={(part) => commit(record, part)}
            onRefused={(field, refusal) => {
              onRefused(recordFieldName(field), refusal);
            }}
            onStatus={(status) => {
              if (drafting && record.id === draft.id) {
                setDraft({ ...draft, status });
              } else {
                dispatch(kind.setStatus(record, status));
              }
            }}
            onRemove={() => {
              if (drafting && record.id === draft.id) {
                focus.current = { kind: 'add' };
                setDraft(undefined);
              } else {
                unlink(record, index);
              }
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
                kind: 'text',
                recordId: draft.id,
              })?.focus();
              return;
            }
            const opened = kind.fresh(threatId);
            focus.current = { kind: 'text', recordId: opened.id };
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
                focus.current = { kind: 'text', recordId: offered.record.id };
                setChosen(undefined);
              }}
              type="button"
            >
              Link existing {kind.noun}
            </button>
          </div>
        )}
      </div>
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
    field: RecordField,
    refusal: RefusedDraft | undefined,
  ) => void;
  readonly onStatus: (status: Held['status']) => void;
  readonly onRemove: () => void;
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
  onRemove,
}: RecordRowProps<Held>) {
  const sharedId = useId();
  const others = otherThreats(record, threatId);
  const heldField = recordFieldIn(held?.field, kind.noun);
  const heldIn = (part: RecordPart): string | undefined =>
    heldField?.recordId === record.id && heldField.part === part
      ? held?.text
      : undefined;
  const labelOf = (part: RecordPart): string =>
    kind.parts.length === 1
      ? name
      : `${name} ${part === 'title' ? 'title' : 'description'}`;
  const fieldProps = (part: RecordPart) => ({
    held: heldIn(part),
    label: labelOf(part),
    onChange,
    onCommit: onCommit(part),
    onRefused: (refusal: RefusedDraft | undefined) => {
      onRefused(
        { noun: kind.noun, part, recordId: record.id, pending: draft },
        refusal,
      );
    },
    value: textOf(record, part),
  });

  return (
    <div
      className={styles.record}
      data-record-row={record.id}
      onBlur={draft ? onBlur : undefined}
    >
      {kind.parts.map((part) =>
        part === 'title' ? (
          <TextField key={part} {...fieldProps(part)} />
        ) : (
          <ProseField compact key={part} {...fieldProps(part)} />
        ),
      )}
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
          data-unlink-record={draft ? undefined : true}
          onClick={onRemove}
          type="button"
        >
          {draft ? 'Discard' : 'Unlink'} {name.toLowerCase()}
        </button>
      </div>
      {others > 0 && (
        <p className={styles.shared} id={sharedId}>
          Also on {others} other {others === 1 ? 'threat' : 'threats'}.
        </p>
      )}
    </div>
  );
}
