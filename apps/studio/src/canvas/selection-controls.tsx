import { boxOfPoints } from '@saerskriven/canvas';
import { pointSchema, sizeSchema, type ElementId } from '@saerskriven/model';
import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { CommandButton } from '../commands/command-button.js';
import { Action } from '../store/actions.js';
import { elementById, selectedElement } from '../store/selectors.js';
import type { State } from '../store/state.js';
import { dispatch, modelStore, useModelStore } from '../store/store.js';
import { announce } from './announcements.js';
import { focusElement, resizeNode } from './edits.js';
import { flowEnds } from './elements.js';
import { currentLayout } from './layout.js';
import {
  selectionControlEvent,
  focusSelectionControl,
  selectionControlFrom,
  type SelectionControl,
} from './selection-control.js';
import { currentTool, useTool } from './tools.js';
import styles from './selection-controls.module.css';

type OpenControl = {
  readonly kind: SelectionControl;
  readonly state: State;
  readonly transition: number;
};

/** The non-modal position, size, and endpoint editors reached through registered commands. */
export function SelectionControls() {
  const state = useModelStore((value) => value);
  const tool = useTool();
  const [held, setHeld] = useState<OpenControl | undefined>();
  useEffect(() => {
    const open = (event: Event) => {
      const kind = selectionControlFrom(event);
      const current = modelStore.getState();
      if (
        kind !== undefined &&
        current.selection.length > 0 &&
        current.inlineEditor === undefined &&
        currentTool().active === 'select'
      ) {
        setHeld({ kind, state: current, transition: currentTool().transition });
      }
    };
    document.addEventListener(selectionControlEvent, open);
    return () => {
      document.removeEventListener(selectionControlEvent, open);
    };
  }, []);
  const valid =
    held !== undefined &&
    held.state.present === state.present &&
    held.state.selection === state.selection &&
    held.state.inlineEditor === state.inlineEditor &&
    held.transition === tool.transition;
  if (held !== undefined && !valid) {
    setHeld(undefined);
  }
  if (held === undefined || !valid) {
    return null;
  }
  const close = () => {
    setHeld(undefined);
    const id = state.selection[0];
    if (id !== undefined) {
      focusElement(id);
    }
  };
  return (
    <SelectionEditor
      key={held.kind}
      control={held.kind}
      state={state}
      close={close}
    />
  );
}

function SelectionEditor({
  control,
  state,
  close,
}: {
  readonly control: SelectionControl;
  readonly state: State;
  readonly close: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  const onClose = useEffectEvent(close);
  useEffect(() => {
    const panel = root.current;
    const frame = requestAnimationFrame(() => {
      focusSelectionControl();
    });
    const blur = () => {
      onClose();
    };
    const key = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        event.target instanceof Node &&
        panel?.contains(event.target)
      ) {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', key);
    window.addEventListener('blur', blur);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('blur', blur);
      document.removeEventListener('keydown', key);
      if (panel?.contains(document.activeElement)) {
        document.querySelector<HTMLElement>('.react-flow')?.focus();
      }
    };
  }, []);
  return (
    <section
      aria-label={
        control === 'geometry' ? 'Position and size' : 'Flow endpoint'
      }
      data-selection-editor
      className={styles.panel}
      ref={root}
    >
      {control === 'geometry' ? (
        <GeometryEditor state={state} close={close} />
      ) : (
        <EndpointEditor state={state} side={control} close={close} />
      )}
    </section>
  );
}

function GeometryEditor({
  state,
  close,
}: {
  readonly state: State;
  readonly close: () => void;
}) {
  const nodes = currentLayout(state).nodes.filter((node) =>
    state.selection.includes(node.id),
  );
  const single =
    nodes.length === 1 && state.selection.length === 1 ? nodes[0] : undefined;
  const bounds = boxOfPoints(nodes.map((node) => node.position));
  const [position, setPosition] = useState({
    x: String(bounds?.minX ?? 0),
    y: String(bounds?.minY ?? 0),
  });
  const [size, setSize] = useState({
    width: String(single?.size.width ?? 1),
    height: String(single?.size.height ?? 1),
  });
  const [error, setError] = useState('');
  const resizable = single !== undefined && single.kind !== 'boundary-curve';
  if (bounds === undefined) {
    return (
      <>
        <p>Select a node to edit its geometry.</p>
        <button onClick={close} type="button">
          Close
        </button>
      </>
    );
  }
  const commit = (event: FormEvent) => {
    event.preventDefault();
    const at = pointSchema.safeParse({
      x: numeric(position.x),
      y: numeric(position.y),
    });
    const extent = sizeSchema.safeParse({
      width: numeric(size.width),
      height: numeric(size.height),
    });
    if (!at.success || (resizable && !extent.success)) {
      const message = 'Enter finite coordinates and positive dimensions.';
      setError(message);
      announce(message);
      return;
    }
    if (single !== undefined && resizable && extent.success) {
      resizeNode(single, { position: at.data, size: extent.data });
    } else {
      const offset = { x: at.data.x - bounds.minX, y: at.data.y - bounds.minY };
      if (offset.x !== 0 || offset.y !== 0) {
        dispatch(Action.MoveElements({ elementIds: state.selection, offset }));
      }
    }
    close();
    if (modelStore.getState().present !== state.present) {
      announce('Position and size updated.');
    }
  };
  return (
    <form onSubmit={commit}>
      <h2>Position and size</h2>
      {(['x', 'y'] as const).map((axis) => (
        <NumberField
          key={axis}
          label={axis.toUpperCase()}
          value={position[axis]}
          change={(value) => {
            setPosition({ ...position, [axis]: value });
          }}
        />
      ))}
      {resizable &&
        (['width', 'height'] as const).map((axis) => (
          <NumberField
            key={axis}
            label={axis === 'width' ? 'Width' : 'Height'}
            value={size[axis]}
            change={(value) => {
              setSize({ ...size, [axis]: value });
            }}
          />
        ))}
      {error !== '' && <p>{error}</p>}
      <div className={styles.actions}>
        <button type="submit">Apply geometry</button>
        <button onClick={close} type="button">
          Cancel
        </button>
      </div>
    </form>
  );
}

function numeric(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value);
}

function NumberField({
  label,
  value,
  change,
}: {
  readonly label: string;
  readonly value: string;
  readonly change: (value: string) => void;
}) {
  const inputId = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={inputId}>{label}</label>
      <span>
        <button
          aria-label={`Decrease ${label}`}
          onClick={() => {
            change(String(numeric(value) - 1));
          }}
          type="button"
        >
          −
        </button>
        <input
          id={inputId}
          aria-label={label}
          type="number"
          step="any"
          value={value}
          onChange={(event) => {
            change(event.target.value);
          }}
        />
        <button
          aria-label={`Increase ${label}`}
          onClick={() => {
            change(String(numeric(value) + 1));
          }}
          type="button"
        >
          +
        </button>
      </span>
    </div>
  );
}

function EndpointEditor({
  state,
  side,
  close,
}: {
  readonly state: State;
  readonly side: 'source' | 'target';
  readonly close: () => void;
}) {
  const id = selectedElement(state);
  const element = id === undefined ? undefined : elementById(state, id);
  const flow = element?.kind === 'flow' ? element : undefined;
  const other = side === 'source' ? flow?.target : flow?.source;
  const options = flowEnds(currentLayout(state)).filter(
    (node) => other?.kind !== 'attached' || node.id !== other.element,
  );
  const previous = flow?.[side];
  const [target, setTarget] = useState<ElementId | undefined>(
    previous?.kind === 'attached' ? previous.element : options[0]?.id,
  );
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (flow !== undefined && target !== undefined) {
          dispatch(
            Action.ReconnectFlow({
              elementId: flow.id,
              side,
              endpointId: target,
            }),
          );
          close();
          if (modelStore.getState().present !== state.present) {
            announce(`Changed flow ${side}.`);
          }
        }
      }}
    >
      <h2>Flow endpoint</h2>
      {flow === undefined ? (
        <p>Select one flow to reconnect it.</p>
      ) : (
        <label className={styles.field}>
          {side === 'source' ? 'Source' : 'Target'}
          <select
            aria-label={side === 'source' ? 'Source' : 'Target'}
            value={target ?? ''}
            onChange={(event) => {
              setTarget(
                options.find((node) => node.id === event.target.value)?.id,
              );
            }}
          >
            {options.map((node) => (
              <option key={node.id} value={node.id}>
                {node.name || node.id}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className={styles.actions}>
        <button
          disabled={flow === undefined || target === undefined}
          type="submit"
        >
          Apply endpoint
        </button>
        <button onClick={close} type="button">
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Endpoint commands available beside a selected flow. */
export function FlowEndpointCommands() {
  const state = useModelStore((value) => value);
  const id = selectedElement(state);
  const flow = id === undefined ? undefined : elementById(state, id);
  const tool = useTool();
  return flow?.kind === 'flow' &&
    state.inlineEditor === undefined &&
    tool.active === 'select' ? (
    <section aria-label="Reconnect flow" className={styles.endpoints}>
      <CommandButton command="reconnect-source" />
      <CommandButton command="reconnect-target" />
    </section>
  ) : null;
}
