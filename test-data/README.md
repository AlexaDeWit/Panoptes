# test-data

Inputs to the test suites: files vendored from other projects, verbatim, the
files this repository writes itself, and a few small payloads built here to
break a bound. They live at the repository root rather than inside one
package because more than one package reads them and the layer matrix
forbids a package dependency between the readers: `packages/model` may
import no internal package at all, so a fixture file owned by `model` would
be out of reach of the packages that read it.

No payload here is formatted. `.oxfmtrc.json` ignores `test-data/**/*.json`,
`test-data/**/*.yaml` and `test-data/**/*.snapshot.md`, at any depth below
this directory, so a vendored file keeps the bytes the foreign tool wrote,
which is what a codec has to read, a written one keeps the bytes it was
written with, which is what a test compares against, and an adversarial
payload keeps the shape that makes it adversarial. The markdown pattern
names the snapshot suffix rather than every `.md` file below, so prose like
this note is formatted like any other document. That puts a rule on the next
generated markdown payload: name it `*.snapshot.md`, or widen the pattern in
the same commit. A `.md` file below under any other name is formatted, and a
byte comparison against a formatted file flaps. A payload in a format none of
the three patterns names needs the same decision, and the SVG diagrams below
are where it was made once: oxfmt does not format SVG, so they need no fourth
pattern. Whoever adds a payload in a further format runs `pnpm fix` over it
and checks the bytes before deciding it needs none either.

`nx.json` names this directory in `sharedGlobals`, so editing a file below
invalidates the cached result of every task that reads it. Without that a
suite reading these files reports the green it cached before the edit.

## `ecluse.json`

The threat model of [Écluse](https://github.com/AlexaDeWit/Ecluse), a
supply-chain policy proxy for package registries.

| Fact           | Value                                                    |
| -------------- | -------------------------------------------------------- |
| Source project | `AlexaDeWit/Ecluse`, path `threat-modelling/ecluse.json` |
| Source commit  | `673afcde81558143479c2d8c454839110ba9ca07`, 2026-08-29   |
| Written by     | OWASP Threat Dragon 2.6.2                                |
| Licence        | MIT, Copyright 2026 Alexandra de Wit                     |
| MD5            | `9b61b49c0945298b8c2f1f86d2c4136e`                       |

It is a real threat model of a real deployed system, published here with the
author's consent, and it is the only production-scale Threat Dragon file the
project has. Two uses:

- `packages/model` transcribes it into the internal form as
  `ecluseFixture` (`src/lib/ecluse.fixtures.ts`), the fixture behind the
  representability gate that M1's definition of done rests on (issue #22).
- `packages/formats` reads this file through the Threat Dragon codec
  (`readThreatDragon`) and pins the counts, vocabularies, and drifts the model
  fixture pins. The transcription keeps Threat Dragon's own cell and threat
  ids, so the two sides describe the same records without an id mapping, and
  `ecluse.model.json` below is where the two are compared as one value.

One drift to know about before writing that codec: the file's `threatTop` is
28, while two of its threats are numbered 101 and 102. Threat Dragon does not
enforce the invariant the internal model does, so the import rule is
`lastIssuedThreatNumber = max(threatTop, highest threat number in the file)`.
Neither half alone is enough. `threatTop` alone breaks on this file, and the
highest number alone drops the gap left by a removed highest-numbered threat,
which is the record the field exists to keep.

## `panoptes/ecluse.yaml`

Not vendored: this one is written here. It is the Écluse model above, read
through the Threat Dragon codec and written through the Panoptes YAML codec,
committed so a change to what the native format writes arrives as a diff on a
file rather than as a test that still passes.

`packages/formats` compares the write against it on every run, as a vitest
file snapshot, so it cannot fall behind the codec. Regenerate it with
`pnpm nx test @panoptes/formats -- -u`, and read the diff: the file is the
format's output by definition, so a change to it is a change to the format.

The committed bytes are read back as well, and have to parse to the model
they were written from, so the file gates more than its own regeneration.

## `ecluse.model.json`

The Écluse model in the internal form: `ecluseFixture` as `packages/model`
writes it out. Not vendored. This repository generates it, from the fixture
that carries the representability gate.

It is here because the two descriptions of that one threat model were never
held to each other. `packages/model` owned the transcription and
`packages/formats` pinned the same counts and vocabularies beside it, so a
drift in an element description, an endpoint, or `outOfScope` passed both
suites. Three assertions now hold the two to each other. `packages/model`
compares it against the fixture on every test run with `toMatchFileSnapshot`
and reds where the two differ. `packages/formats` compares the whole read of
`ecluse.json` against it, and compares again what a write of that read reads
back.

Regenerate it with `pnpm nx test @panoptes/model -- -u`, in the same commit as
the change that moved it, and read the diff: it is what the model core holds
of a real threat model. A file snapshot is written only where the file is
absent or the run carries `-u`, and a reader's suite can be running in either,
so `nx.json` gives `test` a `dependsOn` of `^test` and the suites that read
this file run after the one that writes it.

`packages/render` reads it too, as the input its markdown register is
rendered from, so this file is where a projection meets the model core
without either package importing the other's fixtures.

## `panoptes.model.json`

Panoptes' own threat model in the internal form, from
[`threat-modelling/panoptes.yaml`](../threat-modelling/README.md) read through
the native codec. Not vendored, and derived: that file is the source.

It is here for the reason `ecluse.model.json` is. `packages/render` and
`packages/canvas` gate on the model, and the layer matrix keeps them from
importing the codec that reads a YAML file, so a codec writes the model out
and they read it as data.

The producer differs, though, and that is the whole difference between the
two files. `ecluse.model.json` comes from `packages/model`, out of the hand
transcription that carries the representability gate, and `packages/formats`
compares its read against it. This one has no transcription to come from,
because nobody wrote the model twice: `packages/formats` reads the YAML and
is its only producer. Which path a native fixture's model goes to is a field
on its `nativeFixtures` entry, and Écluse's entry names none.

Regenerate it with `pnpm nx test @panoptes/formats -- -u`, in the same commit
as the edit to the YAML that moved it.

## `render/ecluse.register.snapshot.md`

The Écluse model as `packages/render` writes its threat register: an overview
table of the 29 threats, then one section each. Not vendored. This repository
generates it, from `ecluse.model.json` above read through `parseModel`.

It is committed so a change to what the register writes arrives as a diff on
a file rather than as a test that still passes. `packages/render` compares
it on every test run with `toMatchFileSnapshot`, and it is the only place the
register's whole shape, escaping and prose handling included, is held against
a production-scale model.

Regenerate it with `pnpm nx test @panoptes/render -- -u`, in the same commit
as the change that moved it, and read the diff: the file is the register's
output by definition, so a change to it is a change to what every consumer of
the register sees.

## `render/panoptes.register.snapshot.md`

Panoptes' own threat model as the same register, from `panoptes.model.json`
above. It is the second model that register is held against, and the one that
carries a custom methodology, a CIA category, two threats attached to no
element, and a mitigation written as a markdown list, none of which the
Écluse model has.

Regenerate it the same way, with `pnpm nx test @panoptes/render -- -u`.

## `every-glyph.model.json`

One of every glyph the canvas knows, in the internal form, written here by
hand rather than generated: the six element kinds, a trust boundary in both
shapes, an out-of-scope element, a flow with a waypoint, a flow with a free
end, a flow whose endpoint names another flow, and open threats spread so that
one element carries the stacked pair of badges and another the neutral badge
alone. Écluse holds none of the last four, so a drawing of Écluse alone leaves
those cases uncommitted.

`packages/canvas` and `packages/render` both read it through `parseModel` and
both keep a golden drawn from it. It is here rather than inside either
package because the layer matrix forbids a package dependency between the two
readers, which is the same reason `ecluse.model.json` is here.

## `render/ecluse.snapshot.typ`

The Écluse model as the Typst source of one whole document: every diagram,
one to a landscape page, then the register above on portrait pages. Not
vendored. This repository generates it, from `ecluse.model.json` above.

It is the only committed form of what `apps/cli` hands the Typst compiler for
`--format pdf`, so a change to the document template, to the escaping of any
value out of the model, or to the drawing embedded inside it, arrives as a
diff here. `ecluse.snapshot.svg` below is inside it verbatim, so the two move
together and a diff on one without the other is a bug.

Regenerate it with `pnpm nx test @panoptes/render -- -u`, in the same commit
as the change that moved it. Nothing formats it: oxfmt does not know Typst,
which is the decision this file's format needed under the rule above.

## `render/*.snapshot.svg`

The diagrams `packages/render` draws as standalone SVG documents. Not
vendored: this repository generates all four.

`ecluse.snapshot.svg` is the `High Level` diagram of `ecluse.model.json`
above, read through `parseModel`, so the drawing and the register come from
the one model the model core and the codecs are held to.
`every-glyph.snapshot.svg` is `every-glyph.model.json` above drawn the same
way. `panoptes-read-and-render.snapshot.svg` and
`panoptes-agent-and-desktop.snapshot.svg` are the two diagrams of
`panoptes.model.json`, which is the only committed model that
holds more than one, so they are also where a model of several diagrams is
drawn at all.

All are committed for the reason the registers above are, and gated the same
way: `packages/render` compares them on every test run with
`toMatchFileSnapshot` and reds where a file and the drawing differ.
Regenerate them with `pnpm nx test @panoptes/render -- -u`, in the same commit
as the change that moved them.

## `threat-dragon/`

The threat models OWASP Threat Dragon ships inside its own repository: the
nine v2 models its demo menu offers, and three more the repository keeps
beside them. They are the corpus `packages/formats` reads through the Threat
Dragon codec, which is how a wire schema that has drifted from the format
announces itself before a user meets it. Every one of them was refused by an
earlier draft of that schema, which is why they are here rather than
described.

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
one of the read bounds `@panoptes/formats` exports as `readLimits`, so each
bound is pinned by an input rather than by its own definition. None of those
is a threat model, and none is large: an oversized text is generated in the
spec instead, since committing megabytes to prove a size bound would be the
wrong trade. `read-limits.spec.ts` hands every one of them to both reads, the
Panoptes YAML read and the Threat Dragon read, because YAML is a superset of
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
