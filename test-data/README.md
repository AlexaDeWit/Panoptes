# test-data

Shared test inputs: vendored files, generated snapshots, and adversarial
payloads. Root-level files let packages share data without adding imports
that violate the layer matrix.

## Maintaining fixtures

Preserve payload bytes. `.oxfmtrc.json` excludes JSON, YAML, and
`*.snapshot.md` files here. It still formats other Markdown files, including
this README. Name generated Markdown payloads `*.snapshot.md`. For another
format, check whether `pnpm fix` changes its bytes before adding it.
Oxfmt does not format SVG or Typst.

Each test target declares its fixture inputs, directly or through a named
input. Fixture changes do not invalidate lint or build targets.

## Who writes each file, and who reads it

Cached Nx tests compare committed snapshots without writing them. Update a
producer's snapshots outside Nx with `pnpm snapshots:update <project>`.
The producers are `@saerskriven/model`, `@saerskriven/formats`, and
`@saerskriven/render`. Review and commit the snapshot diff with the source change.

| File                                                | Written by         | Read by                                                                     |
| --------------------------------------------------- | ------------------ | --------------------------------------------------------------------------- |
| `ecluse.model.json`                                 | `packages/model`   | `packages/formats`, `packages/canvas`, `packages/render`, `apps/studio-e2e` |
| `saerskriven.model.json`                            | `packages/formats` | `packages/canvas`, `packages/render`, `apps/studio-e2e`                     |
| `saerskriven/ecluse.yaml`                           | `packages/formats` | `apps/cli`, `apps/studio-e2e`                                               |
| `render/ecluse.register.snapshot.md`                | `packages/render`  | `apps/cli`, `apps/studio-e2e`                                               |
| `render/ecluse.snapshot.svg`                        | `packages/render`  | `apps/cli`, `apps/studio-e2e`                                               |
| `render/saerskriven-read-and-render.snapshot.svg`   | `packages/render`  | `apps/cli`                                                                  |
| `render/saerskriven-agent-and-desktop.snapshot.svg` | `packages/render`  | `apps/cli`                                                                  |
| `render/saerskriven.register.snapshot.md`           | `packages/render`  | no other suite                                                              |
| `render/ecluse.snapshot.png`                        | `packages/render`  | `apps/cli`                                                                  |
| `render/saerskriven-read-and-render.snapshot.png`   | `packages/render`  | `apps/cli`                                                                  |
| `render/saerskriven-agent-and-desktop.snapshot.png` | `packages/render`  | no other suite                                                              |
| `render/every-glyph.snapshot.png`                   | `packages/render`  | no other suite                                                              |
| `render/every-glyph.snapshot.svg`                   | `packages/render`  | no other suite                                                              |
| `render/ecluse.snapshot.typ`                        | `packages/render`  | `apps/studio-e2e`                                                           |

The `.snapshot.png` rasters are written only where the rasterizer module
[`SAERSKRIVEN_RESVG_WASM`](../README.md#the-svg-rasterizer) names has been
built, since the rasterizer's suite skips where that variable is unset.

The remaining files are maintained inputs. `render/ecluse.snapshot.pdf.sha256`
is the expected PDF digest for the CLI and studio browser suites.
The browser suite runs separately from `pnpm check` and only reads fixtures.

## `ecluse.json`

The threat model of [Écluse](https://github.com/AlexaDeWit/Ecluse), a
supply-chain policy proxy for package registries. Vendored with the author's consent.

| Fact           | Value                                                    |
| -------------- | -------------------------------------------------------- |
| Source project | `AlexaDeWit/Ecluse`, path `threat-modelling/ecluse.json` |
| Source commit  | `673afcde81558143479c2d8c454839110ba9ca07`, 2026-08-29   |
| Written by     | OWASP Threat Dragon 2.6.2                                |
| Licence        | MIT, Copyright 2026 Alexandra de Wit                     |
| MD5            | `9b61b49c0945298b8c2f1f86d2c4136e`                       |

`packages/model` transcribes it as `ecluseFixture` in
`src/lib/ecluse.fixtures.ts`. `packages/formats` compares its Threat Dragon
read against that transcription through `ecluse.model.json`. Both preserve
the source cell and threat IDs.

The file's `threatTop` is 28, but it contains threats numbered 101 and 102.
The import uses `lastIssuedThreatNumber = max(threatTop, highest threat number in the file)`.
The maximum preserves both existing numbers and the gap from a deleted highest-numbered threat.

## `saerskriven/ecluse.yaml`

The native YAML encoding of `ecluse.json`, produced through both codecs.
The formats suite compares the write against this snapshot and reads it back
to check model equality.

## `saerskriven/ecluse-v0.2.1.yaml`

The same model in the document shape v0.2.1 wrote, before version 1 of the
format gained a flow's `bidirectional` and an attached endpoint's `side`. It
is committed data rather than a snapshot: no target writes it, and it is never
regenerated from the current writer, because what it holds the format to is
that a file an earlier release wrote still reads. The formats suite reads it
and checks that the mapping supplies a one-way flow and an unpinned side.

## `ecluse.model.json`

The internal model serialized from `ecluseFixture` by `packages/model`.
The formats suite compares its full Threat Dragon read and write/read result
against this file. This catches differences that matching counts and
vocabularies alone would miss. Canvas and render tests consume it as data.

## `saerskriven.model.json`

The internal model decoded from
[`threat-modelling/saerskriven.yaml`](../threat-modelling/README.md).
`packages/formats` produces it for canvas and render tests, which cannot
import codecs. A `nativeFixtures` entry selects its output path.

## `render/ecluse.register.snapshot.md`

The markdown register from `ecluse.model.json`: an overview of 29 threats,
followed by a section for each. It covers the full register structure,
escaping, and prose handling.

## `render/saerskriven.register.snapshot.md`

The register from `saerskriven.model.json`. It adds a custom methodology, a
CIA category, two unattached threats, and mitigation prose containing a
Markdown list to the cases covered by Écluse.

## `every-glyph.model.json`

A hand-written model with every element kind, both boundary shapes, an
out-of-scope element, and flows with waypoints, free ends, and an endpoint
naming another flow. Its open threats exercise paired badges and a neutral
badge. Canvas and render tests parse it and keep separate drawing snapshots.

## `render/ecluse.snapshot.typ`

The Typst document from `ecluse.model.json`: every diagram on a landscape
page, followed by the register on portrait pages. It embeds
`ecluse.snapshot.svg` verbatim, so a drawing change updates both snapshots.

## `render/*.snapshot.svg`

Standalone SVG documents from `packages/render`:

- `ecluse.snapshot.svg`: the `High Level` diagram of `ecluse.model.json`.
- `every-glyph.snapshot.svg`: the diagram in `every-glyph.model.json`.
- `saerskriven-read-and-render.snapshot.svg` and
  `saerskriven-agent-and-desktop.snapshot.svg`: the two diagrams of
  `saerskriven.model.json`, covering a model with multiple diagrams.

## `threat-dragon/`

The nine v2 models from Threat Dragon's demo menu and three models from its
repository. The formats suite reads them through the Threat Dragon codec.

| Fact           | Value                                                       |
| -------------- | ----------------------------------------------------------- |
| Source project | `OWASP/threat-dragon`                                       |
| Source tag     | `v2.6.2`, commit `8c0edb2295a1587684324646c8507fd56ba9a197` |
| Licence        | Apache-2.0, Copyright OWASP Foundation                      |

| File                              | Upstream path                                        | MD5                                |
| --------------------------------- | ---------------------------------------------------- | ---------------------------------- |
| `demo/cryptocurrency-wallet.json` | `td.vue/src/service/demo/cryptocurrency-wallet.json` | `ac2482cdfd3d54b7da57509b4c3aa9e9` |
| `demo/generic-cms.json`           | `td.vue/src/service/demo/generic-cms.json`           | `3505e2e3c1168993ad0b9fcf708fb1d3` |
| `demo/iot-device.json`            | `td.vue/src/service/demo/iot-device.json`            | `c352b5a7d38d9d735b311d8c59812822` |
| `demo/online-game.json`           | `td.vue/src/service/demo/online-game.json`           | `42bdaa029c59dccc54a15bd21f92d829` |
| `demo/payment-online.json`        | `td.vue/src/service/demo/payment-online.json`        | `edb36f47da6e5ca27d3c0b3b30c67109` |
| `demo/renting-car.json`           | `td.vue/src/service/demo/renting-car.json`           | `fffa21af0ae27f1d7abdfce253b3ab32` |
| `demo/three-tier-web-app.json`    | `td.vue/src/service/demo/three-tier-web-app.json`    | `bad08c9471aa41dd4291b96f912f023f` |
| `demo/v2-new-model.json`          | `td.vue/src/service/demo/v2-new-model.json`          | `152bdbf8247cd9ff0f66b68b478b51b7` |
| `demo/v2-threat-model.json`       | `td.vue/src/service/demo/v2-threat-model.json`       | `82b81e47a047eb3992d53bbb94adee9e` |
| `models/test-reports.json`        | `ThreatDragonModels/test/test-reports.json`          | `6c15a86c29a7cf9c969710a78de1d7c2` |
| `models/v2-new-model.json`        | `ThreatDragonModels/v2-new-model.json`               | `f4144b040d12668f0c45d1c60b75a6fa` |
| `models/v2-threat-model.json`     | `ThreatDragonModels/v2-threat-model.json`            | `f456784c069347a48f6568934e8a7571` |

`demo/v2-new-model.json` and `demo/v2-threat-model.json` are not copies of
the `models/` files of the same name: Threat Dragon keeps both, and they
differ. `models/v2-threat-model.json` is the only file in the corpus stamped
`2.0` rather than `2.x.y`, at the root and on each diagram. Two files carry a
diagram version that differs from their root's: `models/test-reports.json`
holds three that all differ, and `demo/three-tier-web-app.json` is stamped
`2.3.0` with its one diagram at `2.4.0`.

Three files Threat Dragon ships alongside these are deliberately absent.
`td.vue/src/service/demo/huskyai.tmbom.json` is a TM-BOM document at version
`1.0.1` and `ThreatDragonModels/test/malformed-new-model.json` is a v1 model,
so neither is a Threat Dragon v2 threat model and the codec has no claim on
either. `ThreatDragonModels/test/v2-malformed-new-model.json` is stamped
`2.1.3` and so is a v2 file, but it is deliberately malformed, down to
misspelling `summary` as `titled` and `detail` as `details`. Refusing it is
the codec working, so it would gate nothing here.

## `threat-dragon/schema/`

The JSON Schema Threat Dragon validates a v2 file against before it opens
one. `packages/formats` runs the write codec's output through it with ajv,
configured as Threat Dragon configures it, so what this project writes is
measured against the format's own description of itself rather than only
against the codec that wrote it. It gates the shape of the document: a
threat is not something it describes, so nothing it says holds one to
anything.

It is not the schema `threat-dragon-wire.ts` follows. That one describes what
Threat Dragon writes, and the two differ: the published schema puts a cell's
threats beside `data` rather than under it, names a threat's id `threatId`,
and declares neither ports nor tools nor labels nor the boundary bookkeeping.
What it does pin, and what a written file therefore has to carry, is
`contributors`, `diagramTop`, `reviewer` and `threatTop` on the detail, a
`thumbnail` and a `version` on every diagram, and a `zIndex` and a
`data.hasOpenThreats` on every cell.

| File                                  | Upstream path                                           | MD5                                |
| ------------------------------------- | ------------------------------------------------------- | ---------------------------------- |
| `schema/threat-dragon-v2.schema.json` | `td.vue/src/assets/schema/threat-dragon-v2.schema.json` | `72b130d31edd31c6408186281586f98d` |

## `threat-dragon/i18n/`

Threat Dragon's category labels in each of the sixteen languages it ships,
taken from the `threats.model` object of `td.vue/src/i18n/<language>.js` at
the same tag. The surrounding module is dropped and the labels themselves are
verbatim, trailing spaces and all: the Spanish LINDDUN label really does end
in one, and a tidy-up of it would break a real file.

`packages/formats` derives its label recovery tables from exactly these, and
a test rebuilds the derivation and compares, so a Threat Dragon translation
update changes the file below and the test says which table fell behind.

| File              | MD5                                |
| ----------------- | ---------------------------------- |
| `i18n/ar.json`    | `e9f40d5bae36ce4ca7a1c79d9a59d72d` |
| `i18n/de.json`    | `87c9ab7574e0f1088251a2a4f2614580` |
| `i18n/el.json`    | `7382ac7d4f04a158a0245ffa9372a0ad` |
| `i18n/en.json`    | `a8b964105e692c845e3df3f8575e9951` |
| `i18n/es.json`    | `8807cbb4111fad7ffc4257a8e3e78770` |
| `i18n/fi.json`    | `a8b964105e692c845e3df3f8575e9951` |
| `i18n/fr.json`    | `b341e7b1cf0c7a24137fac567481617a` |
| `i18n/hi.json`    | `1dc862545f2491a5eda87be8de7e5e06` |
| `i18n/id.json`    | `2ccbf0569da2f2534eb62309fbf173e0` |
| `i18n/ja.json`    | `3180365e3510578f099447e21de2f028` |
| `i18n/ms.json`    | `2b70c26ca11a3ed4bf9fe19c49823ea3` |
| `i18n/pt-br.json` | `61f7ae5e60bdf4152e82531fdef7ca2a` |
| `i18n/pt.json`    | `321bb7b29ffeca11b567d92315a2bcfb` |
| `i18n/ru.json`    | `a8b964105e692c845e3df3f8575e9951` |
| `i18n/uk.json`    | `a8b964105e692c845e3df3f8575e9951` |
| `i18n/zh.json`    | `e180efcc9bc292651aac45dc7107d8ed` |

## `adversarial/`

Hostile inputs, none of them vendored. Most are small payloads built to break
one of the read bounds `@saerskriven/formats` exports as `readLimits`, so each
bound is pinned by an input rather than by its own definition. None of those
is a threat model, and none is large: an oversized text is generated in the
spec instead, since committing megabytes to prove a size bound would be the
wrong trade. `read-limits.spec.ts` hands every one of them to both reads, the
Saerskriven YAML read and the Threat Dragon read, because YAML is a superset of
JSON and a hostile file arrives with whatever extension its author chose.

`typst-injection.yaml` is the exception, and is described under its own
heading below: it is a valid model, and what is hostile about it is its
prose.

| File                   | Bytes | What it is                                                                                                                                     | How it was built                                                                |
| ---------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `deep-nesting.json`    | 6,000 | 3,000 nested empty arrays, the reproducer found during #26                                                                                     | `'['.repeat(3000) + ']'.repeat(3000)`                                           |
| `deep-block.yaml`      | 9,287 | A YAML block mapping 128 deep, one space of indent per level                                                                                   | `nested:` at rising indent, then `bottom`                                       |
| `cyclic-anchor.yaml`   | 48    | An anchor on `metadata` and an alias to it underneath, a cycle in 3 lines                                                                      | Written by hand                                                                 |
| `alias-expansion.yaml` | 88    | A seed scalar and three anchors, each a sequence of three aliases to the one before                                                            | Written by hand, sized to land between our alias bound and the parser's default |
| `branching-cycle.yaml` | 15    | A sequence anchored to itself twice, so every level of it branches in two                                                                      | Written by hand                                                                 |
| `wide-cycle.yaml`      | 2,408 | The same sequence anchored to itself 800 times                                                                                                 | `a: &a [` then `*a` 800 times, comma-joined, then `]`                           |
| `shared-anchor.yaml`   | 8,355 | One anchored sequence of 3,000 scalars, aliased from forty rising depths                                                                       | Written by a generator the spec re-runs, `sharedFromDepths(3000, 40)`           |
| `nested-anchors.yaml`  | 1,114 | Twenty-five anchors nested in each other, the innermost holding an alias to each of twenty-five one-node anchors, all twenty-five then aliased | Written by a generator the spec re-runs, `nestedAnchors(25)`                    |

`deep-nesting.json` is the known reproducer: 6 KB of JSON parses without
complaint and then overflows the stack of anything that walks it, which is
how it was found, inside a recursive `z.lazy` schema that has since been
withdrawn. It is why the nesting bound is checked on the parsed value rather
than on the text. `cyclic-anchor.yaml` costs three lines to say the same
thing about depth, and is refused ahead of that walk now, as an alias count:
an anchor an alias reaches from inside itself expands without end.

`branching-cycle.yaml` is fifteen bytes and closes its cycle through two
aliases rather than one, so a walk that counted paths instead of nodes would
double its work at every level and never reach the depth that would stop it.
It is refused before that walk now, as an alias count, because an anchor
reached from inside itself expands without end; the walk's own handling of a
value like it is pinned in `read-limits.spec.ts` on a JavaScript object built
to reach itself, since no YAML read reaches the walk with one any more.

`deep-block.yaml` is the same class through the other kind of YAML nesting.
It is the largest file here because block nesting costs a square of its depth
in bytes, one space of indent per level, which is also why a flow document is
the cheaper attack and why both are here.

`wide-cycle.yaml` is the width of that cycle rather than its branching. Every
bound admitted it on paper: two kilobytes, two levels deep, and an alias score
of nothing, because the parser scores a self-referential anchor while it is
still composing it. Resolving it is what costs, about a cube of the alias
count, and reading it took a minute before the alias measurement was moved
ahead of resolution. It is the fixture for that ordering.

`alias-expansion.yaml` is refused by the alias bound this project sets and
accepted by the one the `yaml` package defaults to, which is what makes it
proof that the bound is ours. Raising the bound to the parser's default
turns the spec over it red. It expands to 54 aliases out of the nine it
holds, which is the number the spec pins.

`shared-anchor.yaml` is one large anchored node aliased many times, and
every other bound admits it: eight kilobytes, and forty aliases against a
bound of fifty with nothing inside the anchor for any of them to expand to.
What it costs is not a copy, because `toJS` hands every alias the same
value: it is that the nesting walk expands a node again each time it
reaches that node deeper than before, so the sequence is walked once per
depth an alias reaches it from. At the size it was found, a 4 MiB text
holding a two-million-element sequence aliased from forty depths, the nesting
walk spent six seconds on that one sequence where resolving the whole document
cost under half a second. This is that shape at a size worth committing.

### `adversarial/typst-injection.yaml`

A valid model of two elements and two threats, whose every free-text field
carries something that means something to a markup language: `#eval("1+1")`
and `#read("/etc/passwd")` and `#include`, which are Typst function calls, a
`<script>` tag and an `onerror` attribute, which are HTML, a bare `"` and a
trailing `\`, which are what a Typst string literal is delimited and escaped
by, and `\u{1f600}`, which is what a Typst string escape looks like.

It reads and renders like any other model. `packages/render` writes it as
Typst source whose every one of those fragments sits inside a string literal,
and `apps/cli` compiles it and reads the text back out of the PDF, where each
one is text a reader sees rather than anything the compiler ran. It is
committed rather than built in a spec because it is the input a reviewer
should be able to read, and because both packages read it.

Threat 2's mitigation is a markdown heading whose content is a raw HTML tag.
That shape is deliberate: a heading becomes a PDF outline entry, which is a
PDF string rather than glyphs, so a spec reads it back without a font or a
content stream. It is how the register's treatment of raw HTML is proven in
the artifact rather than only in the source.

`nested-anchors.yaml` is what the parser's own alias accounting costs rather
than what an alias costs. `yaml` resolves an alias by scanning the whole
document, and its accounting takes that scan once per anchor, so anchors
nested in each other pay it once per level: this shape padded to 4 MiB spent
147 seconds inside `toJS` before this package took the accounting over, and
none of it was visible from outside the parser. It is refused as an alias
count now, in a fifth of a millisecond of measurement, and it is the fixture
for handing the parser `maxAliasCount: -1`.
