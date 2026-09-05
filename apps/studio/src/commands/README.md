# The studio's commands

One home per command. Every command the studio offers is named once, in
`registry.ts`, with the words a person reads, the chord that presses it, and
the dispatch it runs. A control does not hold a handler and a key press does
not hold a second copy of one: both go through the registry, so what a button
does and what its shortcut does cannot drift apart.

## What a command is

`registry.ts` is one record, keyed by command id, and every lookup is over
that key rather than a search. Each entry carries:

- **the label**, which is what a menu, a toolbox tooltip or a bare
  `CommandButton` says;
- **the shortcuts**, one or more chords, in the order they are offered;
- **`inTextFields`**, whether the chord still fires while a person is typing;
- **the dispatch**, either a `run` against the `CommandSurface` or `pending`
  naming the issue that will give the command one.

`pending` is a command whose surface has not landed. The chord is registered,
shown and claimed from the browser now, so the shortcut a person learns does
not move when the surface arrives, and the entry flips from `pending` to
`runs` in the issue that builds it. Nothing else about the command changes.

`CommandSurface` is what a command reaches that is not a module-level
function: the file bridge, whose fallback picker only a component can hold,
and React Flow's viewport, which lives as long as the canvas is mounted. The
store's own dispatches and the canvas edits need no surface, which is why a
control runs those with nothing mounted above it. The app builds the one
surface, in `app.tsx`, because that is the single place holding both the file
session and the viewport.

## Chords, and how a platform writes them

`shortcuts.ts` holds the chord. A chord is a set of modifiers and one key
from a closed list, so a binding names a key the studio decided on rather
than any string a keyboard can produce, and two commands reaching for one
chord is a comparison over a known alphabet. The registry's spec is what
holds that every command has a shortcut and no two share one.

`Mod` is the platform's command modifier: Command on Apple hardware, Control
everywhere else. The platform is read once at load, from the user agent data
where a browser offers it and `navigator.platform` where it does not, and
each chord is then written three ways.

| Where                | Apple          | Elsewhere         |
| -------------------- | -------------- | ----------------- |
| Tooltip, menu, panel | `⇧⌘S`          | `Ctrl+Shift+S`    |
| `aria-keyshortcuts`  | `Shift+Meta+S` | `Control+Shift+S` |

The attribute is spelled as ARIA asks rather than as a person reads it: it is
the one attribute that says which key runs a control, and assistive
technology reads the binding from it. The spelling a person reads is the
tooltip and the control's accessible description, which is what
`CommandButton` renders beside the button rather than inside it: inside, the
accessible name of Save would read "Save Ctrl+S".

## Who holds the keyboard

`binding.tsx` installs every chord once, on the document rather than on the
control that holds focus, which is what makes a command reachable from
wherever a person is. Three rules decide whether a press is the studio's:

- **A press a control has already acted on is not.** It arrives with its
  default prevented, which is how one Delete removes one element while the
  canvas still binds that key itself (`../canvas/diagram-canvas.tsx`).
  Consolidating that binding into this one is issue #179's follow-up.
- **A press an open overlay owns is not.** A listbox or a menu is handling
  the same keys, Escape and every letter of its typeahead among them, so
  nothing is taken out from under it.
- **A press typed into a text field is not**, unless the command is exempt.
  Saving, saving as, undo, redo and clearing are the exemptions, so naming an
  element never deletes one and a save mid-sentence still saves.

A press that is the studio's is claimed from the browser, whether or not the
command has a dispatch yet: a chord the studio advertises must not do
something else instead.

## What a later slice does

- Flip a `pending` entry to `runs` in the issue that lands its surface. The
  burger menu (#174) carries close, the toolbox (#175) the tool modes and the
  connector (#175, #178) the start of a flow, and multi-select (#156) select
  all.
- Render a command through `CommandButton`, or read `commandById` for a
  surface that draws its own control. Never hold a label or a chord beside a
  control: the menu, the toolbox, the panel and the zoom cluster read both
  from here.
- Bind a new command by adding an entry, not by adding a listener. The spec
  beside the registry fails a chord that collides with one already bound.
- The tool commands add an element today, which is what the palette's buttons
  do, so the shortcut each button shows is true of the button. When the
  toolbox lands (#175) they select a mode instead, and the palette goes with
  the change.
