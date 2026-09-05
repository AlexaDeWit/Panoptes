# The studio's threat panel

The threats of whatever is selected, edited where they are read. The canvas
selects, the panel follows, and an edit leaves as a store action, so the
badges on the diagram and the panel are two views of one model with nothing
synchronizing them.

## What it binds to

`threats.ts` holds the selectors and the pure functions the panel is built
from. `selectedElement` is the element `State.selection` names and
`attachedThreats` the threats that name it, in register order. A flow is a
selection like any other: it carries threats, so it opens the panel as a box
does. Status plays no part in the list, where it decides the badge: the panel
shows what has been recorded against the element, the canvas what is still
open.

With nothing selected the panel says so and offers no control that edits. The
panel holds no copy of model state. What it does hold is its own view state:
which threat is expanded, which control focus is being sent to, and what the
live region last said.

## The commit rule

One committed change is one `ReplaceThreat`, so one field is one undo step.
A listbox commits the value chosen. A text field commits what it holds when
it is left, and the title on Enter as well, rather than on every keystroke,
which would make an undo stack of single characters. A commit that changes
nothing dispatches nothing: a model operation returns a new model whatever it
was asked to do, so the store would push an undo entry and mark the file
dirty over an edit nobody made.

Text carrying a character the model's character set does not accept is not
committed at all, because the alternative is a model on screen that no codec
can write back to a file. The field says which character stopped it, under a
label that already says which field it is, and the panel announces the same
refusal with the field named, so a refusal that lands after focus has left is
not silent. What was typed stays on screen to be corrected, which holds under
one condition: the threat holding a refused draft stays expanded until the
text is corrected or cleared. Radix unmounts a collapsed item's fields, so a
collapse would take the draft with it, and the panel refuses the collapse
rather than the draft.

The refusal is the panel's only view state that another view can settle, so
it is dropped from both ends. The field reports every change to it, including
the one it makes on its own when the value under a draft moves, an undo among
those, and it reports after the render rather than during it, a parent having
no way to take a report from a child that is still rendering. The panel drops
it as well whenever nothing on screen is holding it, which is what a selection
moving to another element does. Neither a sentence about a draft that is gone
nor a threat held open by nothing survives.

Adding is one `AddThreat`, attached to the selected element and carrying the
number the model issues next. Deleting is one `RemoveThreat`. Both are
ordinary dispatches, so undo takes either back. An add is announced and moves
focus only once the store holds the threat: the reducer is total and records
a refusal rather than failing, so the panel asks it what it did rather than
assuming.

## Focus, and saying what happened

An added threat opens expanded with focus in its title. A deleted one hands
focus to the threat that took its place, to the one before it where it was
last, and to the add control where it was the only one. Both changes are
announced in the panel's own polite live region ([the controls](../ui/README.md)),
because a moved focus tells a screen reader that something happened and not
what it was.

Radix unmounts a collapsed item's fields, so a commit always comes first:
reaching the control that collapses an item, by pointer or by Tab, takes
focus out of the field, which is the commit. A commit the model refuses is
the exception, and the item stays open until it is settled. Which field holds
a refusal is kept in the item rather than in the panel, so a second field
committing cleanly does not report the first field's draft away.

The panel sits after the canvas in the DOM, so Tab reaches it after every
element and every flow. Which of the two a keyboard user should reach first
is the same decision as how a diagram is traversed, and belongs with the
toolbar rather than here ([the canvas](../canvas/README.md)).

## What is not attempted here

- The mitigations register, which the model holds as records of its own
  linked to threats, has no UI. The issue and the milestone defer it. The
  threat's own `mitigation` prose is a threat field and is edited here.
- Markdown is edited as its source. A preview beside the prose is deferred
  with the rest of the rendering surface.
- A threat names any number of elements, and the panel shows one element's
  threats with no list of the others, so `AttachThreat` and `DetachThreat`
  have no control here. Deleting therefore removes the threat from the model
  rather than detaching it from the element, and a threat naming several
  elements leaves all of them at once, which the item says beside the delete
  control rather than leaving to be discovered. Undo takes it back.
- Naming a new custom methodology is not offered: it is two free-text fields
  and a judgement about what the model is being read under. A threat that
  arrived carrying one shows it and can be moved onto an enumerated pair.
- A threat's id and number are not editable. The model refuses a changed
  number, a number being issued once, and the id is the threat's identity.
- One threat is expanded at a time, which keeps the panel short on an element
  carrying a dozen. Comparing two threats side by side is not offered.
- The list is the register's order, with no filter, sort or search over it.
