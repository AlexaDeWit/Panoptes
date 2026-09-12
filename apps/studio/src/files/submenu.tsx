import { ChevronRightIcon } from '@radix-ui/react-icons';
import { DropdownMenu } from 'radix-ui';
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import styles from './menu.module.css';

/** The element a {@link Submenu} lines its start edge up with: row one of the chrome card, on screen at every width. */
export const SubmenuEdge = createContext<RefObject<HTMLElement | null>>({
  current: null,
});

type Placement = {
  readonly align: 'start' | 'end';
  readonly alignOffset: number;
  readonly sideOffset: number;
};

const besideRow: Placement = { align: 'start', alignOffset: 0, sideOffset: 0 };

const placementOf = (
  edge: Element,
  row: Element,
  content: HTMLElement,
): Placement => {
  const trigger = row.getBoundingClientRect();
  const height =
    content.scrollHeight + content.offsetHeight - content.clientHeight;
  const below = document.documentElement.clientHeight - trigger.bottom;
  const above = trigger.top;
  const under = below >= height || (above < height && below >= above);
  return {
    align: under ? 'start' : 'end',
    alignOffset: trigger.height,
    sideOffset: edge.getBoundingClientRect().left - trigger.right,
  };
};

const slack = 1;

const entersSubmenu = (
  event: PointerEvent,
  submenu: HTMLElement | null,
): boolean => {
  if (submenu === null) {
    return false;
  }
  if (event.relatedTarget instanceof Node) {
    return submenu.contains(event.relatedTarget);
  }
  const box = submenu.getBoundingClientRect();
  return (
    event.clientX >= box.left - slack &&
    event.clientX <= box.right + slack &&
    event.clientY >= box.top - slack &&
    event.clientY <= box.bottom + slack
  );
};

type SubmenuProps = {
  readonly children: ReactNode;
  readonly label?: string;
  readonly trigger: ReactNode;
};

/**
 * A second level of the menu, at the start edge of {@link SubmenuEdge}. It
 * opens under its own row where its whole height fits there, over the row
 * where it fits there instead, and otherwise on the roomier side, scrolling. It
 * never covers its row, so the press after a hover lands on the row or a
 * submenu item.
 *
 * Radix keeps a submenu open only while the pointer heads right, the side it
 * fixes, so a pointer that leaves the row straight into this submenu keeps it
 * open whichever way it moved.
 */
export function Submenu({ children, label, trigger }: SubmenuProps) {
  const edge = useContext(SubmenuEdge);
  const row = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState(besideRow);
  const place = useCallback(
    (node: HTMLDivElement | null) => {
      content.current = node;
      if (node !== null && edge.current !== null && row.current !== null) {
        setPlacement(placementOf(edge.current, row.current, node));
      }
    },
    [edge],
  );

  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger
        aria-label={label}
        className={styles.item}
        onPointerLeave={(event) => {
          if (entersSubmenu(event, content.current)) {
            event.preventDefault();
          }
        }}
        ref={row}
      >
        {trigger}
        <ChevronRightIcon aria-hidden="true" className={styles.chord} />
      </DropdownMenu.SubTrigger>
      <DropdownMenu.SubContent
        align={placement.align}
        alignOffset={placement.alignOffset}
        avoidCollisions={false}
        className={`${styles.panel} ${styles.submenu}`}
        ref={place}
        sideOffset={placement.sideOffset}
        tabIndex={0}
      >
        {children}
      </DropdownMenu.SubContent>
    </DropdownMenu.Sub>
  );
}
