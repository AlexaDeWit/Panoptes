# The studio's browser suite

Browser tests cover layout, focus, pointer and touch gestures, file input,
downloads, and accessibility. Use unit tests for behaviour that does not need
a browser.

## Running the suite

Run inside `nix develop`:

```sh
pnpm nx e2e @saerskriven/studio-e2e
```

Browsers come from the flake. `src/version-pairing.spec.ts` checks that the
catalog's `@playwright/test` version matches the flake's driver.

`playwright.config.ts` starts the development server and a Pages preview.
The projects run in order:

- `chromium` runs the main browser specs.
- `pages` checks the production build below `/Saerskriven/`, including PDF
  assets, the social card, its text alternative, and the release version.
- `frame-time` measures an Écluse drag with one worker and one retry. Earlier
  project failures skip it. Other browser work must not compete with this measurement.

The Pages build uses a separate Vite cache to avoid reloading the development
page during tests. Its output and the Playwright reports stay under this
project's ignored `test-output/` directory.

## Waiting on the canvas

Wait for `canvasSettled` from `src/studio.fixtures.ts` before sending a canvas
gesture. Opening a model fits its diagram after React Flow measures the
canvas. A click sent during that fit can land at the wrong position.
The fixture polls the viewport transform until consecutive readings match.

## The round-trip coverage matrix

The studio requirements from [M4](https://github.com/AlexaDeWit/Saerskriven/milestone/5)
map to the browser specs below. Paths are relative to `src/`.

| Behaviour                                                             | Specs                                                    |
| --------------------------------------------------------------------- | -------------------------------------------------------- |
| Boot and initial diagram                                              | `smoke.spec.ts`, `empty-state.spec.ts`                   |
| Threat Dragon and native YAML open/save                               | `files.spec.ts`, `round-trip.spec.ts`                    |
| Lossless open/edit/save, geometry, and threat data                    | `round-trip.spec.ts`                                     |
| SVG, markdown, Typst, and PDF export parity                           | `exports.spec.ts`, `pages-export.spec.ts`                |
| Selection, tab order, node movement, and boundary hit targets         | `canvas.spec.ts`                                         |
| Group selection, movement, and deletion                               | `multi-selection.spec.ts`                                |
| Toolbox placement, curve drawing, deletion, and Hand mode             | `editing.spec.ts`                                        |
| Pointer and keyboard connections, handle visibility, and cancellation | `connectors.spec.ts`                                     |
| Flow paths, labels, and badges during a drag                          | `flow-drag.spec.ts`                                      |
| Flow bend insertion, movement, removal, and format round trips        | `flow-bends.spec.ts`                                     |
| Pinned flow ends, bidirectional flows, and their round trips          | `flow-anchors.spec.ts`                                   |
| Side, corner, and keyboard resizing                                   | `resize.spec.ts`                                         |
| Hover, selection, focus, and cursor cues                              | `selection-cues.spec.ts`                                 |
| Inline names and Note text                                            | `renaming.spec.ts`                                       |
| Threat fields, badges, pane layout, focus, and draft retention        | `panel.spec.ts`                                          |
| Undo and redo across canvas and panel edits                           | `commands.spec.ts`, `redo.spec.ts`, `round-trip.spec.ts` |
| Menu navigation, dirty state, open/close guards, and loss reports     | `menu.spec.ts`                                           |
| Shortcuts and their reference                                         | `commands.spec.ts`                                       |
| Fit, zoom, and viewport placement                                     | `viewport.spec.ts`                                       |
| Clipboard, geometry fields, reconnection, arrangement, and snapping   | `interaction-controls.spec.ts`                           |
| Touch panning, scrolling, and startup overlays                        | `interaction-nits.spec.ts`                               |
| Edit announcements                                                    | `edit-status.spec.ts`                                    |
| Reload recovery                                                       | `recovery.spec.ts`                                       |
| Switching between, adding, and renaming the diagrams of a model       | `diagrams.spec.ts`                                       |
| System and saved colour preferences                                   | `dark-mode.spec.ts`, `appearance.spec.ts`                |
| axe-core checks of the page and open controls                         | `accessibility.spec.ts`                                  |
| Drag frame times                                                      | `drag-frame-time.spec.ts`                                |

`tests/` holds unit specs for shared browser helpers: shortcut chords against
the command registry, and the path comparison used by the round-trip test.

The browser suite does not check the browser-owned `beforeunload` prompt.
The file-menu unit specs cover its registration. Dedicated boundary deletion
coverage is absent. The canvas package owns detailed glyph and stylesheet
checks. Automated accessibility checks do not replace manual screen-reader
review. The configured browser projects use Chromium only.

Current interaction limitations live in the
[canvas documentation](../studio/src/canvas/README.md#what-is-not-attempted-here).
