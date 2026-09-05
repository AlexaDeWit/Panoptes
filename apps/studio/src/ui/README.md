# Studio UI components

Behaviour comes from [Radix](https://www.radix-ui.com/) headless primitives,
imported from the single `radix-ui` package; nothing here adopts a component
kit. Styling is a CSS module per component, drawing every colour, space and
radius from the design tokens in [`../styles.css`](../styles.css), with Radix
state read through its own `data-state` and `data-highlighted` attributes
rather than through classes a component would have to keep in step. No
CSS-in-JS, no Tailwind, and no second stylesheet.

## Tokens

| Token                                                                | What it decides                    |
| -------------------------------------------------------------------- | ---------------------------------- |
| `--pn-font-family`, `--pn-font-size`, `--pn-line-height`             | The type scale                     |
| `--pn-colour-surface`, `--pn-colour-surface-raised`                  | What a control sits on             |
| `--pn-colour-text`, `--pn-colour-text-muted`                         | Text, at WCAG AA on either surface |
| `--pn-colour-border`                                                 | Every hairline                     |
| `--pn-colour-accent`, `--pn-colour-accent-text`                      | Selection and the focus indicator  |
| `--pn-space-1` to `--pn-space-4`                                     | Every gap and every pad            |
| `--pn-radius`                                                        | Every corner                       |
| `--pn-focus-ring`, `--pn-focus-ring-width`, `--pn-focus-ring-offset` | The one visible focus indicator    |

A control never suppresses the focus indicator and never invents its own: it
applies the focus tokens in `:focus-visible`, swapping the ring's colour only
where the accent is the background it would be drawn on.

## Adding a control

1. Take the primitive from `radix-ui`, and read its options from the model
   rather than retyping them.
2. Add a CSS module beside it, built from the tokens above.
3. Give it a visible `<label>` tied to the primitive's own control element.
4. Keep an overlay inside the control's own element rather than letting the
   primitive send it to the document body, so it sits in whichever landmark
   the panel declares.
5. Add a spec beside it.

## What is here that is not a control

Two components carry no Radix primitive, because neither takes an edit.
`FailureNotice` renders `StudioFailure`, whatever produced it, so one region
shows the model refusing an edit, a codec refusing a file, and the platform
refusing to hand one over. It words every variant: nothing reaches a person
as a tag, and a codec's paths are kept because they say which line of a file
was refused rather than that the file was. `ErrorBoundary` is the last stop
for a throw from anywhere below it, and is a class because React offers no
other way to catch one; it holds the only component state in this directory
for that reason. Both are live regions that stay in the page while they have
nothing to say, so what arrives in them is announced rather than appearing in
silence.

## What a composed control owes

The primitive underneath is not the bar; the component here is. Every control
carries a label association, a keyboard path from Tab through commit, and the
role a screen reader expects, and a spec proves all three rather than a person
reading the markup. `jsx-a11y` in `.oxlintrc.json` is the static half of that
and the axe-core run in `apps/studio-e2e` is the runtime half, which audits
the page at rest and every open overlay in its own scope.

A control holds no state of its own and no form library holds it either. It
takes its value as a prop and reports an edit through one commit callback, so
the edit becomes a store action and is undoable. `SeverityField` is the worked
example: `App` reads its value through the `editedThreat` selector and its
`onCommit` hands the changed field to `threatCommitter`, which dispatches one
`Action.ReplaceThreat` that the Undo control takes back with nothing added.
A later control commits through the same function with its own patch. A commit that would not change the value dispatches
nothing, because a no-op operation still returns a new model and so marks the
file dirty ([the store's README](../store/README.md)).
