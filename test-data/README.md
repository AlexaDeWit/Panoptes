# test-data

Inputs to the test suites: files vendored from other projects, verbatim, and
one file this repository writes itself. They live at the repository root
rather than inside one package because more than one package reads them and
the layer matrix forbids a package dependency between the readers:
`packages/model` may import no internal package at all, so a fixture file
owned by `model` would be out of reach of the packages that read it.

No payload here is formatted. `.oxfmtrc.json` ignores `test-data/**/*.json`
and `test-data/**/*.yaml`, so a vendored file keeps the bytes the foreign
tool wrote, which is what a codec has to read, and the written one keeps the
bytes the codec produced, which is what a test compares against. This note is
formatted like any other document.

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
  ids, so the two sides describe the same records without an id mapping. They
  are not compared as one value: `ecluseFixture` is internal to
  `packages/model`, so `packages/formats` has no way to reach it.

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
