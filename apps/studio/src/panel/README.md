# The studio's threat panel

The threats of whatever is selected, edited where they are read. The canvas
selects, the panel follows, and an edit leaves as a store action, so the
badges on the diagram and the panel are two views of one model with nothing
synchronizing them.

## Where it is

The panel is an overlay on the canvas rather than a column beside it: it
floats over the right edge of the canvas container, mounted from
`../canvas/diagram-canvas.tsx`, and it is on the page only while something is
selected. With nothing selected there is no panel and the diagram has the
whole canvas, which is why the panel is the only place a threat is added
from. It is held clear of the zoom cluster in the corner below it rather than
drawn over it, and the diagram is not resized when it opens: what the panel
covers is dealt with by panning, not by taking the room off the canvas ([the
canvas](../canvas/README.md)). The normal pane is 460 pixels wide. Widen pane
adds half the default coverage, and Restore pane width returns to normal.
The icon button sits left of the heading and supports the keyboard.
Widening and restoring leave the diagram viewport unchanged. The overlay retains that choice across
selection changes and closing during the session. CSS bounds either width to
the canvas, including on narrow or zoomed viewports.

The pane observes its own box and the canvas with `ResizeObserver`. It reports
its actual coverage, including the outer inset, to the canvas. Selection changes and reopening the pane reveal a covered node using that
measurement. Resizing an open pane does not move the diagram. The default
comes from `panelCover` in the canvas tokens, projected as `--pn-panel-cover`.

`threat-overlay.tsx` is the mount: it reads the selection, decides whether
there is a panel at all, holds the drafts and answers for the keyboard.
`threat-panel.tsx` is the panel itself, bound to one subject.

## What it binds to

`threats.ts` holds the selectors and pure functions for the panel.
`panelSubject` returns one element, the count of several selected elements, or
nothing. `attachedThreats` returns threats only for a single selection. A flow
is an element here because it carries threats.

For several selected elements, the panel states the count and offers no field.
There is no single element to record a threat against.

The panel holds no copy of model state. It holds which threat is expanded,
where focus is being sent, and the draft a field is holding after a refusal.

## The keyboard, and closing

Selection alone never moves focus here. T runs the registered Focus threats
command and lands on "Add a threat" for the one selected element. The command
uses `panel-focus.ts`, a channel of its own rather than a field of the store.
Focus does not belong in the model or its undo stacks. Enter on the focused
control adds a threat and moves focus to its title.

The visible Close threats button and Escape close the panel and return focus
to the element, which
stays selected, so a second Escape is the studio's own and clears the
selection ([the commands](../commands/README.md)). The panel claims that first
press, which is what keeps one Escape from doing both. A listbox open inside
the panel is handling Escape itself, so the press is left to it. What is
closed is the element rather than the panel: it stays closed for as long as it
is the selection, whatever is then moved, resized or undone on it. Moving the
selection or running Focus threats opens it again.

Closing takes nothing with it. A refused draft is held per element in the
overlay, which outlives the panel, so a draft survives the panel closing, the
selection moving to another element and coming back, and is put back in the
field it was typed in with the threat it was typed on expanded. What drops a
draft is the text being settled, by a correction or by an edit landing under
it, the threat it named leaving the element, or the file it was typed in
changing: a model that arrives carrying the same ids is a different sitting,
and starts on what the model says. Which file that is, is its name, so a save
that writes another one starts the drafts afresh as an open does; keying them
on the sitting rather than the name is a follow-up, the state carrying nothing
else that tells the two apart.

## Reading and writing

Each summary shows the number, wrapping title, labelled severity, and separate
status. The severity marker uses the canvas tone class. Its text remains
readable in forced colours. The summary remains the accordion control, and
hidden content has no layout box or keyboard controls.

The pane starts below the chrome card, offset by the height the card measures
into `--pn-chrome-block-size` rather than by a constant, and ends above the
zoom controls.
The heading, width control, and close button sit outside the scrollable body.
A long element name scrolls within a three-line heading, reachable by Tab.
Severity and status share a row when space permits. Description and Mitigation
start at eight lines and grow with content to 24 lines. They retain the
browser's manual vertical resize control.

## Mitigations and assumptions

An expanded threat carries a Mitigations group and an Assumptions group,
after its Mitigation prose field and before its delete control. They live
here and nowhere else: a record only has meaning on a threat, so the studio
gives records no panel, list or tab of their own. `threat-records.tsx` draws
one group, `records.ts` holds what differs between the two kinds and the pure
functions the groups read.

- **Add** opens an empty row with focus in its first field (a mitigation's
  title, an assumption's text). Nothing enters the model until a field in
  that row commits, and that commit is one `AddMitigation` or `AddAssumption`
  linked to this threat. A new mitigation starts `proposed` and a new
  assumption `unconfirmed`. Focus leaving a row whose fields are all empty
  closes it, with no record and no undo entry. The row keeps its place and
  its focus when it becomes a record, so typing a title and pressing Tab
  lands in the same row's description. The empty row already carries the
  status control, which holds the starting status until the first commit
  uses it, and a Discard control where a record row has Unlink. Nothing
  moves when the row becomes a record, so Tab from its text reaches the
  status and a click on Add or Link existing lands where it was aimed. A
  pointer press on Discard keeps focus in the text, so typed text is
  discarded rather than committed. From the keyboard, Tab out of typed text
  commits it, and the control reads Unlink by the time it has focus: to
  discard from the keyboard, clear the text first.
- **Link existing** offers the model's records of that kind that are not on
  this threat, by title or first line of text, and links the one chosen.
- Each row edits the record's text in place, changes its status in place and
  unlinks it. A record on other threats says how many, and the unlink
  control is described by that count. Unlinking a record from its last
  threat removes it, which is the model operation's rule rather than the
  studio's, and one undo brings it back linked. The announcement names the
  record by its title or first line. A row that goes while it holds focus,
  by an unlink or an undo, leaves focus in its group.

Every edit is one store action carrying one model operation, so each is one
undo step, reaches other tabs through the same sync as every other edit,
and leaves every threat's status alone. A record text commit that changes
nothing dispatches nothing. Refused record text is held as threat text is
([the commit rule](#the-commit-rule)): the field keeps the draft, the threat
stays expanded, and the draft survives the panel closing. A refused draft in
an empty row keeps the row open and reopens that row, with the status picked
in it, when the panel opens again. A draft for a record no longer on the
threat is dropped, whether the panel was open or closed when the record
went.

Control names carry the kind and the row's position: "Mitigation 2 title",
"Mitigation 2 description", "Mitigation 2 status", "Unlink mitigation 2",
"Assumption 1", "Add assumption", "Existing mitigation", "Link existing
mitigation". Positions renumber when a row above is unlinked.

## Element security properties

Select one actor, process, store, flow or trust boundary and expand **Security
properties** above its threats. The fields follow the selected element kind. Controls mount on the first opening
and remain mounted during later collapses, preserving drafts while a field loses
focus. The pane ignores canvas-only parent renders during a drag.
**Not recorded** leaves a fact absent. Flags also offer **Yes** and **No**.
Protocol and privilege level use a recording choice plus a text field, so a
recorded empty string stays distinct from an absent value.

Relationship editors offer only valid targets in the same diagram. Each row
names one recorded target. Change a row, remove it, or add another target.
Repeated names show IDs. If these labels still collide, every option gets a
distinct numbered prefix.
Existing order and duplicate declarations remain until explicitly edited.
A recorded list can be empty. **Not recorded** removes the list itself.
Geometry does not determine these assertions and editing one side does not
invent reciprocal entries.

Each committed field change is one undo step. Unchanged commits leave history
and dirty state alone. Text commits on blur or Enter. Invalid text stays beside
its field with an inline error and an announcement. Refused property drafts
survive closing or changing selection, using the same file lifetime as threat
drafts. A changed model value clears a stale draft. Model validation failures
use the shared failure notice.

Deleting an element removes its entries from recorded lists. Copies retain
only relationships between copied elements, and pasting remaps those IDs.
Saving and recovery preserve these facts through the native v1 codec.

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
it is dropped from both ends. The field reports every change to it, the text
included, which is what lets the draft be put back later, and including the
change it makes on its own when the value under a draft moves, an undo among
those. It reports after the render rather than during it, a parent having no
way to take a report from a child that is still rendering. The panel drops it
as well whenever nothing on screen is holding it, which is what the threat
leaving the element does. Neither a sentence about a draft that is gone nor a
threat held open by nothing survives.

Adding is one `AddThreat`, attached to the selected element and carrying the
number the model issues next. Deleting is one `RemoveThreat`. Both are
ordinary dispatches, so undo takes either back.

## Focus, and saying what happened

An added threat opens expanded with focus in its title. The focused field
reports the new threat, so the studio adds no status message. A deleted threat
hands focus to the next threat, the previous threat, or the add control. That
focus does not report the deletion, so the shared polite status does.

A refusal also uses the shared status while its inline error remains beside
the field. The next action that changes canvas or panel state clears the
status. It does not clear the inline error or its draft.

Radix unmounts a collapsed item's fields, so a commit always comes first:
reaching the control that collapses an item, by pointer or by Tab, takes
focus out of the field, which is the commit. A commit the model refuses is
the exception, and the item stays open until it is settled. Which field holds
a refusal is kept in the item rather than in the panel, so a second field
committing cleanly does not report the first field's draft away.

The panel sits after the canvas in the DOM, so Tab reaches it after every
element and every flow. Which of the two a keyboard user should reach first
is the same decision as how a diagram is traversed, and belongs with the
toolbar rather than here ([the canvas](../canvas/README.md)). It is a region
rather than a dialog: it takes no focus of its own when it opens, traps none
while it is open, and leaves every shortcut in the studio live while a person
is in it.

## What is not attempted here

- Records have no surface outside the threat editor, by design. A record is
  reached through a threat, and removing one means unlinking it from every
  threat it is on. The model's explicit remove operations have no control.
- The threat's own `mitigation` prose is still a threat field and is edited
  here beside its mitigation records, until the model drops the field.
- The collapsed threat summary shows no record counts or flags.
- Link existing lists every unlinked record of its kind, with no search or
  filter over them.
- Markdown is edited as its source. A preview beside the prose is deferred
  with the rest of the rendering surface.
- A shared threat lists its attached elements by name. The list is read-only,
  so `AttachThreat` and `DetachThreat` have no control here. Deleting therefore removes the threat from the model
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
- An element the panel covers cannot be clicked, the panel being over it. The
  keyboard reaches it, and selecting it pans it into the clear, so nothing is
  out of reach; the pointer alone is limited, as it is under a boundary.
