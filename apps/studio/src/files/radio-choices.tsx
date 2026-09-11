import { DropdownMenu } from 'radix-ui';
import styles from './menu.module.css';

/** One choice of a {@link RadioChoices} group. */
export type RadioChoice<Value extends string> = {
  readonly value: Value;
  readonly label: string;
};

type RadioChoicesProps<Value extends string> = {
  readonly label: string;
  readonly choices: readonly RadioChoice<Value>[];
  readonly value: Value;
  readonly onChoose: (value: Value) => void;
};

/**
 * A menu group of which one item is chosen, marked by its checked state for
 * assistive technology and with a dot for everyone else. Radix hands back the chosen
 * value as a string, so a choice is looked up before it is handed on and a
 * value outside the group chooses nothing.
 */
export function RadioChoices<Value extends string>({
  label,
  choices,
  value,
  onChoose,
}: RadioChoicesProps<Value>) {
  return (
    <DropdownMenu.RadioGroup
      aria-label={label}
      onValueChange={(chosen) => {
        const choice = choices.find((option) => option.value === chosen);
        if (choice !== undefined) {
          onChoose(choice.value);
        }
      }}
      value={value}
    >
      {choices.map((choice) => (
        <DropdownMenu.RadioItem
          className={styles.item}
          key={choice.value}
          value={choice.value}
        >
          <span aria-hidden="true" className={styles.radioMark}>
            {choice.value === value ? '●' : '○'}
          </span>
          <span className={styles.grow}>{choice.label}</span>
        </DropdownMenu.RadioItem>
      ))}
    </DropdownMenu.RadioGroup>
  );
}
