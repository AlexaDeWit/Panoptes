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

Three components carry no Radix primitive, because none of them takes an
edit. `LiveRegion` is the one way anything here announces: a region that
stays in the page while it has nothing to say and collapses rather than
hiding while it is empty, because a region inserted and filled in the same
frame announces nothing. `FailureNotice` renders `StudioFailure` inside one,
whatever produced it, so one region shows the model refusing an edit, a codec
refusing a file, and the platform refusing to hand one over. It words every
variant: nothing reaches a person as a tag, and a codec's paths are kept
because they say which line of a file was refused rather than that the file
was. The threat panel announces an added or deleted threat through the same
component ([the panel](../panel/README.md)), and the canvas palette says what
an edit did through it as well ([the canvas](../canvas/README.md)). Each
names its own region, so a landmark list says which one a reader reached. `ErrorBoundary` is the last stop
for a throw from anywhere below it, and is a class because React offers no
other way to catch one; it holds the only component state in this directory
for that reason. It needs no live region, because it replaces the tree it was
guarding rather than announcing into it.

## What a composed control owes

The primitive underneath is not the bar; the component here is. Every control
carries a label association, a keyboard path from Tab through commit, and the
role a screen reader expects, and a spec proves all three rather than a person
reading the markup. `jsx-a11y` in `.oxlintrc.json` is the static half of that
and the axe-core run in `apps/studio-e2e` is the runtime half, which audits
the page at rest and every open overlay in its own scope.

A control takes its value as a prop and reports an edit through one commit
callback, so the edit becomes a store action and is undoable. No form library
holds it and no control holds model state of its own. `EnumField` is the
worked example, and `SeverityField`, `StatusField` and `CategoryField` are it
three times: each reads its options from a model schema, so the field offers
what the model names and nothing else, and each hands its committed value to
the panel, which dispatches one `Action.ReplaceThreat` that the Undo control
takes back with nothing added ([the panel](../panel/README.md)). A commit that
would not change the value dispatches nothing, because a no-op operation still
returns a new model and so marks the file dirty ([the store's
README](../store/README.md)).

A text field is the one control that holds anything: what is typed is its own
until it is committed, which is what keeps text the model refuses on screen to
be corrected. It commits when it is left rather than as it is typed, so one
edit is one undo step, and it follows the value it is given whenever that
value moves, which is how an undo lands in a field a person is looking at.
Every change to whether the model is refusing what it holds is reported
through a second callback, because a refusal shown in the field alone is a
refusal nothing announces and nothing can keep on screen. The refusal it
shows is the character clause alone, the label above it already naming the
field; the sentence the callback carries names the field, for whatever reads
it away from the control.
