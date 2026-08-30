# test-data

Files vendored from other projects, verbatim, as inputs to the test suites.
They live at the repository root rather than inside one package because more
than one package reads them and the layer matrix forbids a package
dependency between the readers: `packages/formats` may import
`packages/model` and nothing else, so a fixture file owned by `model` would
be out of reach.

Nothing here is formatted or linted. `.oxfmtrc.json` ignores the directory so
each file keeps the bytes the foreign tool wrote, which is what a codec has
to read.

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
- `packages/formats` will read this file through the Threat Dragon codec and
  assert the result equals that fixture (M2). The transcription keeps Threat
  Dragon's own cell and threat ids, so the two sides compare without an id
  mapping.

One drift to know about before writing that codec: the file's `threatTop` is
28, while two of its threats are numbered 101 and 102. Threat Dragon does not
enforce the invariant the internal model does, so a codec cannot copy
`threatTop` into `lastIssuedThreatNumber`.
