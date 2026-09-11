import { DropdownMenu } from 'radix-ui';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
} from 'react';
import { announce } from '../canvas/announcements.js';
import {
  endRenamingDiagram,
  renameActiveDiagram,
  showDiagram,
  useDiagramRenaming,
} from '../canvas/diagrams.js';
import { activeDiagram } from '../store/selectors.js';
import { useModelStore } from '../store/store.js';
import {
  refusedName,
  useTextDraft,
  type RefusedDraft,
} from '../ui/text-field.js';
import styles from './menu.module.css';
import { MenuCommand } from './menu-items.js';
import { RadioChoices } from './radio-choices.js';

const noDiagram = 'No diagram';

/**
 * The diagram control joined to the menu button: the title of the diagram on
 * screen, and under it every diagram of the model to switch to, a New
 * diagram command, and Rename diagram, which turns the title into a field.
 * The field is drawn only while it is open on the diagram shown, so a
 * change of diagram under it closes it and clears the stale id. Enter and
 * Escape hand focus back to the button; a blur commits what it can, closes
 * either way, and leaves focus where the click put it, as the canvas name
 * field does.
 */
export function DiagramSwitcher() {
  const diagrams = useModelStore((state) => state.present.diagrams);
  const active = useModelStore(activeDiagram);
  const renaming = useDiagramRenaming();
  const trigger = useRef<HTMLButtonElement>(null);
  const editing = active !== undefined && renaming === active.id;
  const wasEditing = useRef(false);
  const blurred = useRef(false);

  useEffect(() => {
    if (wasEditing.current && !editing) {
      if (!blurred.current) {
        trigger.current?.focus();
      }
      blurred.current = false;
    }
    wasEditing.current = editing;
  }, [editing]);

  useEffect(() => {
    if (renaming !== undefined && renaming !== active?.id) {
      endRenamingDiagram();
    }
  }, [renaming, active]);

  if (editing) {
    return (
      <TitleField
        key={active.id}
        onClose={(by) => {
          blurred.current = by === 'blur';
          endRenamingDiagram();
        }}
        title={active.title}
      />
    );
  }
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={`Diagram: ${active?.title ?? noDiagram}`}
        className={styles.switcher}
        data-testid="diagram-switcher"
        ref={trigger}
      >
        {active?.title ?? noDiagram}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        align="start"
        className={styles.panel}
        sideOffset={6}
        tabIndex={0}
      >
        {active !== undefined && (
          <>
            <RadioChoices
              choices={diagrams.map((diagram) => ({
                value: diagram.id,
                label: diagram.title,
              }))}
              label="Diagram"
              onChoose={showDiagram}
              value={active.id}
            />
            <DropdownMenu.Separator className={styles.rule} />
          </>
        )}
        <MenuCommand command="new-diagram" />
        {active !== undefined && <MenuCommand command="rename-diagram" />}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

type TitleFieldProps = {
  readonly title: string;
  readonly onClose: (by: 'keyboard' | 'blur') => void;
};

function TitleField({ title, onClose }: TitleFieldProps) {
  const field = useRef<HTMLInputElement>(null);
  const refusalId = useId();
  const settled = useRef(false);
  const report = useCallback((refused: RefusedDraft | undefined) => {
    if (refused !== undefined) {
      announce(refused.said);
    }
  }, []);
  const draft = useTextDraft(
    'Diagram title',
    title,
    undefined,
    (text) => {
      renameActiveDiagram(text);
    },
    report,
    refusedName,
  );

  useEffect(() => {
    field.current?.focus();
    field.current?.select();
  }, []);

  const close = (by: 'keyboard' | 'blur'): void => {
    settled.current = true;
    onClose(by);
  };
  const keyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (draft.commit()) {
        close('keyboard');
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close('keyboard');
    }
  };
  const blur = (): void => {
    if (settled.current) {
      return;
    }
    draft.commit();
    close('blur');
  };

  return (
    <div className={styles.titleEditor}>
      <input
        aria-describedby={draft.refusal === undefined ? undefined : refusalId}
        aria-invalid={draft.refusal !== undefined}
        aria-label="Diagram title"
        className={styles.titleField}
        data-testid="diagram-title"
        onBlur={blur}
        onChange={(event) => {
          draft.change(event.target.value);
        }}
        onKeyDown={keyDown}
        ref={field}
        type="text"
        value={draft.text}
      />
      {draft.refusal !== undefined && (
        <p className={styles.titleRefusal} id={refusalId}>
          {draft.refusal.shown}
        </p>
      )}
    </div>
  );
}
