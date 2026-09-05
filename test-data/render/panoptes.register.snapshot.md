# Panoptes threat register

| Number | Title                                                              | Elements                                     | Category                            | Severity  | Status      |
| ------ | ------------------------------------------------------------------ | -------------------------------------------- | ----------------------------------- | --------- | ----------- |
| 1      | An oversized file exhausts the reader                              | Threat model file, Codec read                | Denial of service (STRIDE)          | Medium    | Mitigated   |
| 2      | A deeply nested document exhausts the stack                        | Codec read                                   | Denial of service (STRIDE)          | Medium    | Mitigated   |
| 3      | A few hundred bytes of aliases expand into gigabytes               | Codec read                                   | Denial of service (STRIDE)          | Medium    | Mitigated   |
| 4      | A cyclic anchor gives the reader no bottom to reach                | Codec read                                   | Denial of service (STRIDE)          | Medium    | Mitigated   |
| 5      | A read throws instead of returning a failure                       | Codec read                                   | Denial of service (STRIDE)          | Medium    | Mitigated   |
| 6      | A key the schema does not declare disappears in silence            | Codec read                                   | Tampering (STRIDE)                  | Low       | Mitigated   |
| 7      | A file builds a model whose references do not resolve              | Codec read, Internal model                   | Tampering (STRIDE)                  | Medium    | Mitigated   |
| 8      | A file from a release Panoptes does not model is read in part      | Codec read                                   | Tampering (STRIDE)                  | Medium    | Mitigated   |
| 9      | A save drops what the file carried                                 | Codec write                                  | Tampering (STRIDE)                  | High      | Mitigated   |
| 10     | Threat prose forges the register's own structure                   | Markdown register                            | Tampering (STRIDE)                  | High      | Mitigated   |
| 11     | Raw HTML in threat prose reaches a published page                  | Markdown register, Downstream site generator | Tampering (STRIDE)                  | High      | Transferred |
| 12     | Prose nested past the serializer's depth stops the render          | Markdown register                            | Denial of service (STRIDE)          | Low       | Mitigated   |
| 13     | An element name reaches an SVG document as markup                  | Canvas glyphs and SVG                        | Tampering (STRIDE)                  | High      | Mitigated   |
| 14     | The PDF path carries prose and fonts from a file nobody vetted     | Markdown register, Canvas glyphs and SVG     | Tampering (STRIDE)                  | Medium    | Open        |
| 15     | The diagram and the register disagree about what is open           | Canvas glyphs and SVG, Markdown register     | Integrity (CIA)                     | Low       | Mitigated   |
| 16     | The renderer reaches the filesystem directly                       | Studio renderer, Preload and IPC bridge      | Elevation of privilege (STRIDE)     | High      | Open        |
| 17     | An unvalidated IPC message reaches the main process                | Preload and IPC bridge, Electron main        | Tampering (STRIDE)                  | High      | Open        |
| 18     | A save writes a path the person never chose                        | Electron main, Local filesystem              | Tampering (STRIDE)                  | Medium    | Open        |
| 19     | An edit tool writes an invalid model over a good file              | MCP server and tools, Local filesystem       | Tampering (STRIDE)                  | High      | Open        |
| 20     | A lossy save through an agent tool drops records without saying so | MCP server and tools, Model core and codecs  | Tampering (STRIDE)                  | Medium    | Open        |
| 21     | Prose in a model file steers the agent that read it                | MCP server and tools, Model core and codecs  | Prompt injection (OWASP LLM Top 10) | Undecided | Open        |
| 22     | A substituted dependency or action reaches the build               | None                                         | Tampering (STRIDE)                  | High      | Mitigated   |
| 23     | Raw HTML in prose reaches Panoptes' own PDF composition            | Markdown register, Canvas glyphs and SVG     | Tampering (STRIDE)                  | Medium    | Open        |
| 24     | A text is claimed by the wrong codec, or declined by its own       | Codec read                                   | Tampering (STRIDE)                  | Medium    | Mitigated   |
| 25     | A compromised upstream release is pinned as it stands              | None                                         | Tampering (STRIDE)                  | High      | Open        |

## Threat 1: An oversized file exhausts the reader

- **Elements**: Threat model file, Codec read
- **Category**: Denial of service (STRIDE)
- **Severity**: Medium
- **Status**: Mitigated

**Description**

A file large enough to fill memory is handed to Panoptes, and the parse itself is what costs, so a check after parsing arrives too late.

**Mitigation**

The size is measured in UTF-8 bytes before a parser sees the text, against `readLimits.maxTextBytes`, which is 4 MiB and about thirty times the largest file this repository vendors. Past it the read comes back as `ExceededReadLimit` naming the bound and what it had measured. A generated text one byte over the bound gates it in `read-limits.spec.ts`, since committing megabytes to prove a size bound would be the wrong trade.

## Threat 2: A deeply nested document exhausts the stack

- **Elements**: Codec read
- **Category**: Denial of service (STRIDE)
- **Severity**: Medium
- **Status**: Mitigated

**Description**

6 KB of JSON nests 3,000 deep, parses without complaint, and then overflows the stack of anything that walks it. This is not hypothetical here. It is the reproducer found during issue #26, inside a recursive schema that has since been withdrawn.

**Mitigation**

The nesting of the parsed value is measured by a walk carrying its own stack, which stops one level past `readLimits.maxNestingDepth` of 64. The walk goes level by level and expands a node only when it reaches that node deeper than it has before, so a value reachable along many paths costs its own size rather than the number of paths through it. `test-data/adversarial/deep-nesting.json` and `deep-block.yaml` gate it, one per kind of nesting.

## Threat 3: A few hundred bytes of aliases expand into gigabytes

- **Elements**: Codec read
- **Category**: Denial of service (STRIDE)
- **Severity**: Medium
- **Status**: Mitigated

**Description**

The billion laughs attack in the form YAML gives it. A seed scalar and a handful of anchors, each a sequence of aliases to the one before, cost almost nothing to write and everything to resolve.

**Mitigation**

Aliases are counted on the composed document before any of them is resolved, against `readLimits.maxAliasCount` of 50, because resolving is where the cost is and a cycle expands without end. The count is this package's own rather than the parser's: `toJS` is handed `maxAliasCount: -1` and the expansion is measured here, since the parser's own accounting resolves an alias by scanning the whole document once per anchor and so costs more than the thing it bounds. A fourth bound, `maxAliasExpansion` of 100,000, holds how much of a document its aliases may reach, because the count alone bounds the cost only where anchors are alike, and a one-node anchor is as cheap to alias as a two-million-node one. Four fixtures gate the four shapes: `alias-expansion.yaml`, `wide-cycle.yaml`, `nested-anchors.yaml` and `shared-anchor.yaml`. The first is refused here and admitted by the parser's own default, which is what makes it proof that the bound is this project's.

## Threat 4: A cyclic anchor gives the reader no bottom to reach

- **Elements**: Codec read
- **Category**: Denial of service (STRIDE)
- **Severity**: Medium
- **Status**: Mitigated

**Description**

An anchor on a mapping and an alias to it underneath is a cycle in three lines and 48 bytes. Nothing in the file bounds its depth, and a cycle closed through two aliases doubles the work of a walk that counts paths at every level.

**Mitigation**

The depth walk climbs a cycle to the bound and refuses it there rather than following it. Because it holds every node it has already expanded, a branching cycle costs its width rather than a multiple of that width per level. `cyclic-anchor.yaml`, `branching-cycle.yaml` at fifteen bytes, and `wide-cycle.yaml` gate the three shapes.

## Threat 5: A read throws instead of returning a failure

- **Elements**: Codec read
- **Category**: Denial of service (STRIDE)
- **Severity**: Medium
- **Status**: Mitigated

**Description**

A hostile file that makes a library throw takes down whatever called the read. In a CLI that is an exit code nobody can act on, and in the studio or the MCP server it is the process.

**Mitigation**

Throwing is not an error channel in this project's TypeScript. Every read returns `Either` with a `ReadFailure` on the error channel, and the adversarial corpus is asserted to read to a failure through both reads and to throw out of neither.

## Threat 6: A key the schema does not declare disappears in silence

- **Elements**: Codec read
- **Category**: Tampering (STRIDE)
- **Severity**: Low
- **Status**: Mitigated

**Description**

A file written by a later release of a format, or by another tool, carries a key this release has no home for. Dropping it quietly loses an author's work, and refusing the file over it makes every format extension a breaking change.

**Mitigation**

A wire schema is a `z.object`, so it strips what it does not declare rather than refusing the payload, and the read reports every stripped key as an `undeclared` divergence naming its path. A schema that has fallen behind its format therefore announces itself rather than quietly shortening files.

## Threat 7: A file builds a model whose references do not resolve

- **Elements**: Codec read, Internal model
- **Category**: Tampering (STRIDE)
- **Severity**: Medium
- **Status**: Mitigated

**Description**

A threat naming an element no diagram holds, a duplicate id, a threat numbered above the mark the file keeps, or a flow anchored to an element in another diagram. Each one reaches a renderer or an editor as a model that cannot be drawn or counted.

**Mitigation**

`parseModel` is the only way a model value comes into existence, and it enforces more than the shapes: ids unique where they must be, threat numbers unique and never above `lastIssuedThreatNumber`, flow endpoints anchored inside their own diagram and never to the flow itself, and every element and threat reference resolving. A refusal comes back with a path into the model, and `detect.spec.ts` pins the dangling case.

## Threat 8: A file from a release Panoptes does not model is read in part

- **Elements**: Codec read
- **Category**: Tampering (STRIDE)
- **Severity**: Medium
- **Status**: Mitigated

**Description**

A file stamped with a later format version is read by a reader that understands only some of it, and the parts it did not understand are lost on the next save.

**Mitigation**

`formatVersion` is a zod literal, so a Panoptes file stamped anything but 1 fails at that path rather than reaching the mapping, and a Threat Dragon file outside major 2 is refused whole. Where no codec claims a text the failure names every format tried, in the order tried, so the person holding the file is told what was attempted rather than handed a partial read.

## Threat 9: A save drops what the file carried

- **Elements**: Codec write
- **Category**: Tampering (STRIDE)
- **Severity**: High
- **Status**: Mitigated

**Description**

Threat Dragon's format holds styling, ports, and per-type flags the internal model has no place for. A save that serialized the model alone would drop all of it, and a model file in git would then show an edit nobody made.

**Mitigation**

A format is adopted completely or not at all. The wire schema declares everything the format carries, the parts Panoptes does not model included, and a write merges onto the document the read returned, so what it does not map is left as the file had it. Where the model does hold something less exactly than the file stated it, the write reports that rather than overwriting. Three oracles gate this over the vendored corpus, among them a comparison of raw parsed input against raw parsed output in which no scalar may move unclaimed.

## Threat 10: Threat prose forges the register's own structure

- **Elements**: Markdown register
- **Category**: Tampering (STRIDE)
- **Severity**: High
- **Status**: Mitigated

**Description**

A threat title carrying a line that reads like another threat's heading takes that threat's anchor, so a link meant for one threat lands on another. A heading inside a description breaks out of its section and reparents everything under it.

**Mitigation**

The tree is built out of mdast nodes and serialized by remark, never concatenated, so a pipe, a backtick or a leading hash in a title lands in the table and in the heading as that text. Line breaks are collapsed in a heading, since an ATX heading holds one line, and a heading inside prose is demoted below the section heading. The register spec pins the forging case directly.

## Threat 11: Raw HTML in threat prose reaches a published page

- **Elements**: Markdown register, Downstream site generator
- **Category**: Tampering (STRIDE)
- **Severity**: High
- **Status**: Transferred

**Description**

A threat description carrying a script tag or an event handler renders as markup wherever the register is published, so the author of a model file reaches the readers of a site that publishes it.

**Mitigation**

Risk treatment: transferred to whatever consumes the register. Raw HTML passes through as written, because what to do about it depends on where the markdown is published and by what. The register's promises name this rather than implying a sanitizer that is not there. A site generator publishing a register from a file it did not write sanitizes it.

## Threat 12: Prose nested past the serializer's depth stops the render

- **Elements**: Markdown register
- **Category**: Denial of service (STRIDE)
- **Severity**: Low
- **Status**: Mitigated

**Description**

A description that opens four thousand block quotes recurses the markdown serializer once per level, and a render that throws is a render nobody gets.

**Mitigation**

Prose nested deeper than 32 levels is rendered as one paragraph of the author's own bytes. The text still reaches the reader, the structure does not, and the package reports no failure and does not throw.

## Threat 13: An element name reaches an SVG document as markup

- **Elements**: Canvas glyphs and SVG
- **Category**: Tampering (STRIDE)
- **Severity**: High
- **Status**: Mitigated

**Description**

A name, a text element, or a threat title written into an SVG that a browser then opens is markup in a document with its own script rules.

**Mitigation**

Issue #31 landed, so the standalone document exists and is gated. The glyphs are React elements rendered to static markup, so their text is escaped by the renderer, and every number reaching an attribute goes through `svgNumber`, which is locale-free and free of exponents. `renderSvg` puts every run of free text through `xmlSafeText`, the diagram title included, which replaces each character XML 1.0 forbids rather than dropping it, since a document holding one is refused whole by every XML parser. A spec opens each committed document as XML and holds it to one `svg` root in the SVG namespace, no `script`, `image`, `use` or `foreignObject`, no `href` reaching outside the document, no `url(` and no `@import`. The severity stays high: that is what the mechanism holds off.

## Threat 14: The PDF path carries prose and fonts from a file nobody vetted

- **Elements**: Markdown register, Canvas glyphs and SVG
- **Category**: Tampering (STRIDE)
- **Severity**: Medium
- **Status**: Open

**Description**

A PDF of the diagram and the register has to turn foreign prose into glyphs, and it does so inside the process that ran the command. The owner ruled the pipeline on 2026-09-03, on issue #34: Typst through its WebAssembly build, embedded in the CLI binary with a default font set, and no browser anywhere in the render path. So the surface is a compiler and a font shaper reading text the file's author wrote, rather than a scripting engine.

**Mitigation**

Nothing is built. Issue #34 carries the work and requires the landing pull request to record the pipeline and how it reaches end users. The severity is medium rather than undecided because the ruling removed the browser, and with it the scripting context that would have made it worse; what is left is foreign text reaching a compiler inside the caller's own process.

## Threat 15: The diagram and the register disagree about what is open

- **Elements**: Canvas glyphs and SVG, Markdown register
- **Category**: Integrity (CIA)
- **Severity**: Low
- **Status**: Mitigated

**Description**

A reader who counts badges on the diagram and rows in the register and gets two answers trusts neither. Two definitions of an open threat, one in the canvas and one in the register, is how that happens.

**Mitigation**

Badges count open threats on the model's own definition of open, and the register and the coverage queries read that same definition, so one model gives one count on every surface.

## Threat 16: The renderer reaches the filesystem directly

- **Elements**: Studio renderer, Preload and IPC bridge
- **Category**: Elevation of privilege (STRIDE)
- **Severity**: High
- **Status**: Open

**Description**

An Electron renderer with node integration on, or with a preload that hands it a filesystem module, turns any code running in the page into code running on the machine. That page holds foreign markdown and foreign element names.

**Mitigation**

Nothing is built. Issue #42 asks for context isolation on, node integration off, the sandbox, and a content security policy, with Electron's own security checklist asserted by a test, and for a boundary rule that keeps the shell importing nothing from packages/. Issue #43 keeps file access behind one adapter rather than in the renderer.

## Threat 17: An unvalidated IPC message reaches the main process

- **Elements**: Preload and IPC bridge, Electron main
- **Category**: Tampering (STRIDE)
- **Severity**: High
- **Status**: Open

**Description**

An open channel that forwards whatever the renderer sends makes the main process an executor for the page. A path, a file mode, or a channel name chosen by the sender is enough.

**Mitigation**

Nothing is built. Issue #43 treats the IPC surface as a wire like any other, with bounded channel definitions, zod-validated messages, and a closed surface. The renderer is untrusted there by design rather than by exception.

## Threat 18: A save writes a path the person never chose

- **Elements**: Electron main, Local filesystem
- **Category**: Tampering (STRIDE)
- **Severity**: Medium
- **Status**: Open

**Description**

A save that takes its destination from the model, or from a message, rather than from a dialog overwrites a file the person never named.

**Mitigation**

Nothing is built. The milestone requires open and save to go through native dialogs on real local files, and the shell to hold window, menu and file plumbing alone. What a save may be handed, and what it must be asked, is settled when issue #43 lands.

## Threat 19: An edit tool writes an invalid model over a good file

- **Elements**: MCP server and tools, Local filesystem
- **Category**: Tampering (STRIDE)
- **Severity**: High
- **Status**: Open

**Description**

An agent calling an edit tool with an operation that does not hold leaves a file that no longer parses, and the model it replaced is gone. The workflow that started this project was an agent hand-editing JSON, which is this failure without the tool.

**Mitigation**

Nothing is built. Issue #48 requires every mutation to go through `parseModel` and the model operations, and requires proof in tests that an invalid operation cannot modify the file. The mechanism it rests on, a parse that is the only way a model comes into existence, is on main already.

## Threat 20: A lossy save through an agent tool drops records without saying so

- **Elements**: MCP server and tools, Model core and codecs
- **Category**: Tampering (STRIDE)
- **Severity**: Medium
- **Status**: Open

**Description**

An agent saving a model with mitigations and assumptions into Threat Dragon's format loses both, since that format keeps no record of either. An agent that is not told cannot tell the person who asked.

**Mitigation**

Nothing is built. The divergence list that names every such loss is on main, and `renderDivergences` already turns it into lines for a person. Issue #48 requires that report to reach the tool result on a lossy write, which is what remains.

## Threat 21: Prose in a model file steers the agent that read it

- **Elements**: MCP server and tools, Model core and codecs
- **Category**: Prompt injection (OWASP LLM Top 10)
- **Severity**: Undecided
- **Status**: Open

**Description**

A threat description is free text that an agent reads as part of its context. A model file is passed between people and pulled from repositories, so its prose is an input channel into an agent that can also write files.

**Mitigation**

Nothing is built, and nothing here can be assessed yet. The tools do not exist, and the harness that decides what an agent does with what it reads is out of scope. What Panoptes owns is the return path, where issue #48 puts every write through the model operations. The severity stays undecided until there is a tool surface to assess.

## Threat 22: A substituted dependency or action reaches the build

- **Elements**: None
- **Category**: Tampering (STRIDE)
- **Severity**: High
- **Status**: Mitigated

**Description**

A threat modelling tool that ships executables is worth attacking through its build rather than through its parser. A moved action tag, a dependency resolved at install time, or an unpinned toolchain is enough. This threat names the build rather than any element on the diagrams above, and it names substitution alone: an upstream release that is hostile when it is published is threat 25.

**Mitigation**

Three mechanisms, all of them on main.

- The flake is the toolchain authority, and CI runs every step through `nix develop .#ci` rather than through whatever the runner ships.
- `pnpm install --frozen-lockfile` installs the lockfile rather than resolving against a registry, and external versions live only in the `pnpm-workspace.yaml` catalog.
- Every GitHub Action is pinned to a full commit SHA with the version in a trailing comment. zizmor's hash-pin policy fails an unpinned one, and Renovate bumps them.

## Threat 23: Raw HTML in prose reaches Panoptes' own PDF composition

- **Elements**: Markdown register, Canvas glyphs and SVG
- **Category**: Tampering (STRIDE)
- **Severity**: Medium
- **Status**: Open

**Description**

Threat prose is markdown, and markdown carries raw HTML. The register hands the decision about that to whatever publishes it, because a register is markdown somebody else renders. The PDF path is Panoptes composing a document itself, so there is nobody to hand it to.

**Mitigation**

Nothing is built. Issue #34 carries a criterion of its own for this: a hostile fixture holding a script tag and event-handler HTML in threat prose has to come out of the PDF path inert. This one is owned rather than transferred, because here Panoptes is the composer rather than the author of an intermediate. Medium for the reason threat 14 is medium: the ruled pipeline is Typst compiled to WebAssembly with no browser, so the markup reaches a typesetter rather than a scripting engine.

## Threat 24: A text is claimed by the wrong codec, or declined by its own

- **Elements**: Codec read
- **Category**: Tampering (STRIDE)
- **Severity**: Medium
- **Status**: Mitigated

**Description**

Two codecs are offered every text, and exactly one should own it. Claim on the wrong signal and a broken Panoptes file is reported as a refused Threat Dragon document, or a broken file of a known format falls through to nobody and its holder is told that no format was recognized. Either way the paths into the file point at a document nobody wrote.

**Mitigation**

The claim rule is the discriminator lists in `detect.ts`, and `detect.spec.ts` pins both halves of it. Seven texts that no codec may claim, three of them stamping a version inside major 2 and one of those carrying a detail but no summary. A document broken one level below a naming key, which is claimed and then refused with a path into the file. A Panoptes model saved as JSON, which opens as a Panoptes model because no file name is consulted. And the smallest file of each release the codecs do model, against a Threat Dragon major above 2 and a `formatVersion` other than 1, which are claimed by nobody.

## Threat 25: A compromised upstream release is pinned as it stands

- **Elements**: None
- **Category**: Tampering (STRIDE)
- **Severity**: High
- **Status**: Open

**Description**

A pin makes a dependency unable to change under the build. It does not make the dependency trustworthy at the moment it was pinned. An attacker who reaches a package or an action at its source publishes a release, Renovate proposes the bump like any other, and the pin then holds the compromised version steady.

**Mitigation**

Partly held. `pnpm-workspace.yaml` sets `minimumReleaseAge` to 10,080 minutes and `renovate.json5` sets the same seven days with `internalChecksFilter: 'strict'`, so a freshly published version neither resolves nor is proposed until it has aged, and the quarantine lifts only for an OSV vulnerability fix, where waiting is the greater risk. Provenance is checked on top of that. `scripts/check-provenance.mjs` verifies each catalog package's npm attestation against the sigstore trust root and reads out of the verified statement the source repository the release was built from. `dependency-provenance.txt` records the name and that repository, and the check fails where a package that carried an attestation no longer does, where its attestation now names a different repository, and where a signature or an attestation does not verify at all. It runs in the CI gate on every pull request, which is where a Renovate bump appears, and `docs/release.md` names it as a step before the tag. What that proves is narrow, and the rest is residual. It reaches the 56 packages the catalog names and nothing else, so the far larger set those pull in transitively is verified by nothing here, and a compromised transitive package is no narrower in blast radius than a direct one. Of the 56, two thirds publish an attestation and the rest publish none, and for those the quarantine is the only control there is; the check prints that list on every run. The repository is matched against the record rather than audited: the verification itself carries no identity policy and would take an attestation from anywhere, so what the record buys is that a move has to be accepted by hand instead of passing in silence, and it says nothing about whether the repository named is honest. An attacker who reaches a package at its source therefore publishes from the repository already recorded, with valid provenance, and passes. And the seven-day window is unchanged: a release nobody catches inside it still arrives. Actions are pinned to a commit SHA under zizmor's hash-pin policy and nothing checks an attestation of theirs. The severity stays high because none of this narrows the blast radius of what does get through, which runs in the build and ships in a binary.
