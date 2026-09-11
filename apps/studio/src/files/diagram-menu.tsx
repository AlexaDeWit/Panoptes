import type { Diagram, DiagramId } from '@saerskriven/model';
import { DropdownMenu } from 'radix-ui';
import type { ReactNode } from 'react';
import { showDiagram } from '../canvas/diagrams.js';
import { activeDiagram, severalDiagrams } from '../store/selectors.js';
import { useModelStore } from '../store/store.js';
import styles from './menu.module.css';

type DiagramChoicesProps = {
  readonly diagrams: readonly Diagram[];
  readonly active: DiagramId;
};

function DiagramChoices({ diagrams, active }: DiagramChoicesProps) {
  return (
    <DropdownMenu.RadioGroup
      aria-label="Diagram"
      onValueChange={(value) => {
        const chosen = diagrams.find((diagram) => diagram.id === value);
        if (chosen !== undefined) {
          showDiagram(chosen.id);
        }
      }}
      value={active}
    >
      {diagrams.map((diagram) => (
        <DropdownMenu.RadioItem
          className={styles.item}
          key={diagram.id}
          value={diagram.id}
        >
          <span aria-hidden="true" className={styles.radioMark}>
            {diagram.id === active ? '●' : '○'}
          </span>
          <span className={styles.grow}>{diagram.title}</span>
        </DropdownMenu.RadioItem>
      ))}
    </DropdownMenu.RadioGroup>
  );
}

/**
 * The diagram group of the studio menu: one radio item per diagram and the
 * two stepping commands, in the menu only while the model holds more than
 * one diagram, so a model of one reads as it always has.
 */
export function DiagramMenu({ children }: { readonly children: ReactNode }) {
  const diagrams = useModelStore((state) => state.present.diagrams);
  const active = useModelStore(activeDiagram);
  const several = useModelStore(severalDiagrams);
  if (!several || active === undefined) {
    return null;
  }
  return (
    <>
      <DropdownMenu.Separator className={styles.rule} />
      <DropdownMenu.Group>
        <DropdownMenu.Label className={styles.heading}>
          Diagram
        </DropdownMenu.Label>
        <DiagramChoices active={active.id} diagrams={diagrams} />
        {children}
      </DropdownMenu.Group>
    </>
  );
}

/**
 * The name of the diagram on screen, beside the menu button while the model
 * holds more than one, and a menu of the others under it.
 */
export function DiagramSwitcher() {
  const diagrams = useModelStore((state) => state.present.diagrams);
  const active = useModelStore(activeDiagram);
  const several = useModelStore(severalDiagrams);
  if (!several || active === undefined) {
    return null;
  }
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={`Diagram: ${active.title}`}
        className={styles.switcher}
        data-testid="diagram-switcher"
      >
        {active.title}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        align="start"
        className={styles.panel}
        sideOffset={6}
        tabIndex={0}
      >
        <DiagramChoices active={active.id} diagrams={diagrams} />
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
