## 0.2.0 (2026-09-08)

### Features

- **CLI:** Use `saer` as the command. The macOS and Linux installer embeds the release tag and binary SHA-256 hashes, then verifies the download before installation. Optional GitHub attestation verification checks build origin. ([#295](https://github.com/AlexaDeWit/Saerskriven/pull/295))
- **Nix:** Add the pinned CLI to downstream development shells without a separate Node, Deno, browser, or Typst installation. ([#291](https://github.com/AlexaDeWit/Saerskriven/pull/291))
- **Studio:** Copy, cut, paste, and duplicate selections. Reconnect flows, edit geometry, arrange elements, and enable snapping. Zoom controls follow the selection, and background clicks consistently clear it. ([#293](https://github.com/AlexaDeWit/Saerskriven/pull/293))
- **Threat pane:** See severity and status in collapsed summaries. Choose a wider pane for writing, keep its heading visible, and see which elements share a threat. ([#294](https://github.com/AlexaDeWit/Saerskriven/pull/294))

### Fixes

- **Studio:** Simplify menu labels and move the version badge onto the canvas. ([#292](https://github.com/AlexaDeWit/Saerskriven/pull/292))
- **Studio:** Stop delayed focus retries from closing the next element's name editor during keyboard placement. ([#296](https://github.com/AlexaDeWit/Saerskriven/pull/296))

### Release verification

- Rehearse release builds and artifact attestations on pull requests. Native Linux and macOS checks exercise installation, upgrades, compatibility links, and rejection of corrupted downloads. ([#289](https://github.com/AlexaDeWit/Saerskriven/pull/289), [#295](https://github.com/AlexaDeWit/Saerskriven/pull/295))

### Upgrading

The executable is now `saer`. The installer defaults to `~/.local/bin/saer`
and adds `saerskriven -> saer` for compatibility. It can migrate an older
`saerskriven` installation and refuses to overwrite an unrelated `saer` command.

Release downloads now use `saer-<version>-<target>` filenames, with `.exe` on
Windows. Update scripts that construct download URLs from the old filenames.
The CLI arguments remain compatible.

The Nix package keeps a separate release pin. Its update to `0.2.0` follows
publication, once the new assets and their attestations exist.

### Contributors

- Alexandra de Wit (@AlexaDeWit)

## 0.1.0 (2026-09-08)

### 🚀 Features

- project structure, shared config layer, CI, and licence ([#4](https://github.com/AlexaDeWit/Saerskriven/pull/4))
- oxlint with type-aware tsgolint as the root lint target ([#63](https://github.com/AlexaDeWit/Saerskriven/pull/63))
- oxfmt --check as the root format gate, replacing Prettier ([#65](https://github.com/AlexaDeWit/Saerskriven/pull/65))
- enforce module boundaries over the layer tags ([#66](https://github.com/AlexaDeWit/Saerskriven/pull/66))
- playwright smoke harness with nixpkgs browsers ([#69](https://github.com/AlexaDeWit/Saerskriven/pull/69))
- element and diagram schema for the model core ([#74](https://github.com/AlexaDeWit/Saerskriven/pull/74))
- threat, mitigation, and assumption schema ([#76](https://github.com/AlexaDeWit/Saerskriven/pull/76))
- parseModel boundary with cross-entity refinements ([#78](https://github.com/AlexaDeWit/Saerskriven/pull/78))
- graph edit operations for the model core ([#80](https://github.com/AlexaDeWit/Saerskriven/pull/80))
- threat operations and coverage queries for the model core ([#81](https://github.com/AlexaDeWit/Saerskriven/pull/81))
- Threat Dragon v2 read codec and the model extensions it needs ([#85](https://github.com/AlexaDeWit/Saerskriven/pull/85))
- the Panoptes YAML format and the wire package that declares it ([#90](https://github.com/AlexaDeWit/Saerskriven/pull/90))
- Threat Dragon v2 write codec and its round-trip gate ([#92](https://github.com/AlexaDeWit/Saerskriven/pull/92))
- the Threat Dragon wire schema as its own package, with its id bound ([#95](https://github.com/AlexaDeWit/Saerskriven/pull/95), [#91](https://github.com/AlexaDeWit/Saerskriven/issues/91))
- Panoptes' own threat model as the second fixture ([#108](https://github.com/AlexaDeWit/Saerskriven/pull/108), [#52](https://github.com/AlexaDeWit/Saerskriven/issues/52))
- ⚠️ rename project to Saerskriven ([#227](https://github.com/AlexaDeWit/Saerskriven/pull/227))
- **canvas:** shared SVG primitives and React Flow wrappers ([#100](https://github.com/AlexaDeWit/Saerskriven/pull/100))
- **canvas:** place flow labels where nothing else is drawn ([#115](https://github.com/AlexaDeWit/Saerskriven/pull/115))
- **canvas:** one token module, and a stylesheet generated from it ([#188](https://github.com/AlexaDeWit/Saerskriven/pull/188))
- **canvas:** a drafting-table widget language and a graph-paper ground ([#197](https://github.com/AlexaDeWit/Saerskriven/pull/197))
- **cli:** ship the CLI as a release executable, versioned by nx release ([#102](https://github.com/AlexaDeWit/Saerskriven/pull/102))
- **cli:** validate and render commands, tested against the packaged build ([#118](https://github.com/AlexaDeWit/Saerskriven/pull/118))
- **cli:** PDF of diagram plus register, compiled by Typst's WebAssembly build ([#138](https://github.com/AlexaDeWit/Saerskriven/pull/138))
- **formats:** codec contract and divergence reporting ([#83](https://github.com/AlexaDeWit/Saerskriven/pull/83))
- **formats:** detect a file's format and open it by content ([#97](https://github.com/AlexaDeWit/Saerskriven/pull/97), [#84](https://github.com/AlexaDeWit/Saerskriven/issues/84))
- **formats:** read limits and the adversarial fixtures that pin them ([#98](https://github.com/AlexaDeWit/Saerskriven/pull/98))
- **formats:** own the alias accounting the YAML read is bounded by ([#105](https://github.com/AlexaDeWit/Saerskriven/pull/105))
- **model:** ids are at least two characters, except a diagram's ([#94](https://github.com/AlexaDeWit/Saerskriven/pull/94))
- **model:** every string is text of a defined character set ([#111](https://github.com/AlexaDeWit/Saerskriven/pull/111))
- **release:** publish CLI and Pages in one workflow ([#275](https://github.com/AlexaDeWit/Saerskriven/pull/275))
- **render:** the threat register as markdown, built as mdast ([#99](https://github.com/AlexaDeWit/Saerskriven/pull/99), [#32](https://github.com/AlexaDeWit/Saerskriven/issues/32))
- **render:** a diagram as a standalone SVG document ([#104](https://github.com/AlexaDeWit/Saerskriven/pull/104))
- **studio:** model store with the undo spine ([#122](https://github.com/AlexaDeWit/Saerskriven/pull/122))
- **studio:** adopt Radix primitives and gate the studio's accessibility ([#123](https://github.com/AlexaDeWit/Saerskriven/pull/123))
- **studio:** open and save through the codecs ([#135](https://github.com/AlexaDeWit/Saerskriven/pull/135))
- **studio:** the interactive canvas, drawn from the store ([#139](https://github.com/AlexaDeWit/Saerskriven/pull/139))
- **studio:** add, connect, delete and resize on the canvas ([#153](https://github.com/AlexaDeWit/Saerskriven/pull/153))
- **studio:** edit every threat field in a panel bound to the selection ([#152](https://github.com/AlexaDeWit/Saerskriven/pull/152))
- **studio:** one command registry with a shortcut shown beside every command ([#189](https://github.com/AlexaDeWit/Saerskriven/pull/189))
- **studio:** zoom and fit in a floating cluster, and a fit on every open ([#202](https://github.com/AlexaDeWit/Saerskriven/pull/202))
- **studio:** follow the system colour scheme from the dark palette ([#205](https://github.com/AlexaDeWit/Saerskriven/pull/205))
- **studio:** a burger menu holds the file and edit commands ([#208](https://github.com/AlexaDeWit/Saerskriven/pull/208))
- **studio:** one Save as, placing the file in the format it is named in ([#221](https://github.com/AlexaDeWit/Saerskriven/pull/221))
- **studio:** overlay the threat panel on the canvas, on selection alone ([#220](https://github.com/AlexaDeWit/Saerskriven/pull/220))
- **studio:** draw connector handles from tokens and start a flow by chord ([#211](https://github.com/AlexaDeWit/Saerskriven/pull/211))
- **studio:** draw selection and hover without colour, and say what a click will do ([#218](https://github.com/AlexaDeWit/Saerskriven/pull/218))
- **studio:** open on an actor-to-store diagram sized to its words ([#214](https://github.com/AlexaDeWit/Saerskriven/pull/214))
- **studio:** rename an element or a flow in place on the canvas ([#219](https://github.com/AlexaDeWit/Saerskriven/pull/219))
- **studio:** prepare Pages for search indexing ([#231](https://github.com/AlexaDeWit/Saerskriven/pull/231))
- **studio:** link the source from the file menu ([#232](https://github.com/AlexaDeWit/Saerskriven/pull/232))
- **studio:** replace the palette with tool modes ([#229](https://github.com/AlexaDeWit/Saerskriven/pull/229))
- **studio:** export every render projection ([#234](https://github.com/AlexaDeWit/Saerskriven/pull/234))
- **studio:** preview box tool drag geometry ([#242](https://github.com/AlexaDeWit/Saerskriven/pull/242))
- **studio:** add multi-selection and group movement ([#243](https://github.com/AlexaDeWit/Saerskriven/pull/243))
- **studio:** make edit status contextual ([#240](https://github.com/AlexaDeWit/Saerskriven/pull/240))
- **studio:** add persistent colour modes ([#241](https://github.com/AlexaDeWit/Saerskriven/pull/241))
- **studio:** recover the current working session ([#260](https://github.com/AlexaDeWit/Saerskriven/pull/260))
- **studio:** publish generated social card ([#259](https://github.com/AlexaDeWit/Saerskriven/pull/259))
- **studio:** make canvas editing keys direct ([#266](https://github.com/AlexaDeWit/Saerskriven/pull/266))
- **studio:** add shortcut reference panel ([#269](https://github.com/AlexaDeWit/Saerskriven/pull/269))
- **studio:** edit flow bends on the canvas ([#277](https://github.com/AlexaDeWit/Saerskriven/pull/277), [#273](https://github.com/AlexaDeWit/Saerskriven/issues/273))
- **wire-threat-dragon:** bound summary.id as Threat Dragon's schema does ([#101](https://github.com/AlexaDeWit/Saerskriven/pull/101))

### 🩹 Fixes

- **canvas:** wrap text by grapheme cluster, not by code point ([#120](https://github.com/AlexaDeWit/Saerskriven/pull/120))
- **canvas:** place a curve boundary's name beside the curve, not on it ([#121](https://github.com/AlexaDeWit/Saerskriven/pull/121))
- **canvas:** hold a flow badge a clearance off an element badge ([#131](https://github.com/AlexaDeWit/Saerskriven/pull/131))
- **canvas:** charge a process as its circle, not its bounding square ([#144](https://github.com/AlexaDeWit/Saerskriven/pull/144))
- **canvas:** hold a curve's name clear of the curve it names ([#149](https://github.com/AlexaDeWit/Saerskriven/pull/149))
- **canvas:** draw a flow to where its element is, on every drag frame ([#187](https://github.com/AlexaDeWit/Saerskriven/pull/187))
- **canvas:** align widget geometry and labels ([#249](https://github.com/AlexaDeWit/Saerskriven/pull/249))
- **cli:** compile from a bundle stamped with a fixed modification time ([#130](https://github.com/AlexaDeWit/Saerskriven/pull/130))
- **nix:** drop inherited no-color setting ([#230](https://github.com/AlexaDeWit/Saerskriven/pull/230))
- **studio:** preserve refused drafts when closing the panel ([#224](https://github.com/AlexaDeWit/Saerskriven/pull/224))
- **studio:** keep trust boundaries behind flows ([#248](https://github.com/AlexaDeWit/Saerskriven/pull/248))
- **studio:** stabilize the initial loading state ([#252](https://github.com/AlexaDeWit/Saerskriven/pull/252))
- **studio:** keep file ownership consistent across operations ([#250](https://github.com/AlexaDeWit/Saerskriven/pull/250))
- **studio:** replace the Nx favicon ([#255](https://github.com/AlexaDeWit/Saerskriven/pull/255))
- **studio:** improve canvas interactions ([#262](https://github.com/AlexaDeWit/Saerskriven/pull/262))
- **studio:** resize elements from every side ([#261](https://github.com/AlexaDeWit/Saerskriven/pull/261))
- **studio:** ask before opening over changes ([#265](https://github.com/AlexaDeWit/Saerskriven/pull/265))
- **test:** constrain Vitest project discovery ([#235](https://github.com/AlexaDeWit/Saerskriven/pull/235))

### ⚠️ Breaking Changes

- rename project to Saerskriven ([#227](https://github.com/AlexaDeWit/Saerskriven/pull/227))
  The CLI, package scope, format name, environment variables, release files, and owned paths now use Saerskriven.

### ❤️ Thank You

- Alexandra de Wit @AlexaDeWit
