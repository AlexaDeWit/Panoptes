# The Panoptes YAML format

Panoptes' own file format, version 1. Everything the internal model holds has
a place in the file and everything the file holds has a place in the model, so
reading a file and writing it back changes nothing and neither direction
reports a divergence. The other format Panoptes reads, Threat Dragon v2 JSON,
is somebody else's shape and does not have that property.

The format is declared by `@panoptes/wire-panoptes-yaml`, a package of one
zod schema that imports nothing but zod. That is the format's definition, and
this page describes it rather than restating it. The codec is
`readPanoptesYaml` and `writePanoptesYaml` in `@panoptes/formats`, paired as
`panoptesYamlCodec`, and it is the only place that knows both the file and
the model.

## The file

YAML, UTF-8, one document, a mapping at the root with seven keys in this
order:

| Key                      | What it holds                                                |
| ------------------------ | ------------------------------------------------------------ |
| `formatVersion`          | `1`, exactly                                                 |
| `metadata`               | Title, owner, description, contributors                      |
| `assumptions`            | What the analysis rests on, linked to elements and threats   |
| `diagrams`               | The diagrams, each owning its elements and their geometry    |
| `mitigations`            | Mitigating work, addressing threats by id                    |
| `threats`                | The threats, each attached to elements by id                 |
| `lastIssuedThreatNumber` | The highest threat number ever issued, counting removed ones |

Every key is required and every list may be empty. Nothing is optional and
nothing is defaulted: a model saves before it is drawn, and it does so with
empty strings and empty lists rather than with absent keys.

That order is three tiers, so a key added to the format later has an obvious
home rather than an argued one. The header comes first, `formatVersion` and
then `metadata`, because it says what the file is and what it covers. The
content follows in alphabetical order, since no other order among
`assumptions`, `diagrams`, `mitigations` and `threats` is more true than the
rest. The bookkeeping the editor keeps for itself goes last, where it is out
of the way of a reader.

An element and a threat category are tagged unions, written with the tag
first: `kind` for an element, a flow endpoint and a boundary shape,
`methodology` for a category.

## `formatVersion`

The version is the whole of the compatibility contract, and it is also what
tells a Panoptes file apart from a JSON format without consulting the file
extension.

- **Missing**: the read fails, with the issue at path `formatVersion`.
- **Any value but `1`**: the read fails, with the issue at path
  `formatVersion`. A later version is refused rather than read in part.

The internal model cannot change this. The wire schema declares its own ids,
its own vocabularies, and its own record shapes, and the layer matrix forbids
it from reusing the model's, so a model changed for the sake of the editor
leaves version 1 alone. What the two have in common today they have by
coincidence, and the mapping between them is written out in
`@panoptes/formats`, member by member, so a change on either side stops
compiling there rather than silently reaching a file. A change to what
version 1 carries is a change to the wire schema, deliberately.

## Reading

A key this release does not declare is not a refusal. The read drops it and
reports it as an `undeclared` divergence naming its path, so a file written
by a later release of version 1 still reads here, minus what this release has
no home for.

What a read does refuse, it refuses with a path: into the file where the
schema is what said no, and into the model where a rule no schema states did,
such as a threat referring to an element no diagram holds.

## Ordering

The bytes are fixed by the model, not by the run: two writes of one model
produce the same file, so a diff shows the edit and nothing else.

- **Keys** are written in the order the wire schema declares them, whatever
  order the model records were built in, with the tag of a tagged union
  first.
- **Threats** are written in number order. A threat number is unique across
  the model and is never reissued, so ordering by it is total and it holds
  each threat's position in the file steady as the model is edited.
- **Diagrams, elements, mitigations and assumptions** keep the order the
  model holds them in. Diagrams and elements are drawn in that order, so it
  is information rather than incidental. Mitigations and assumptions have
  nothing to sort on that would order them any better: their ids are
  generated, so sorting by id scatters them and drops each new record
  wherever its id falls, and a title moves when a record is retitled.
- **No line is wrapped.** A long description is one long line, so editing a
  sentence changes the line it is on rather than reflowing the paragraph
  under it.

A read preserves the order the file states. It is a write that orders, so a
hand-edited file reaches canonical order the next time Panoptes saves it.

## An example

Written by the codec, and compared against it by a test, so it is what a save
produces rather than a rendering of one. The formatter is told to leave it
alone for that reason.

<!-- prettier-ignore -->
```yaml
formatVersion: 1
metadata:
  title: Order service
  owner: Alexandra de Wit
  description: ""
  contributors:
    - Alexandra de Wit
assumptions: []
diagrams:
  - id: diagram-1
    title: High level
    elements:
      - kind: process
        id: element-1
        name: Gateway
        description: ""
        outOfScope: false
        reasonOutOfScope: ""
        position:
          x: 120
          y: 80
        size:
          width: 100
          height: 60
mitigations: []
threats:
  - id: threat-1
    number: 1
    title: Spoofed caller
    category:
      methodology: STRIDE
      category: spoofing
    severity: high
    status: open
    description: An unauthenticated caller reaches the gateway.
    mitigation: ""
    elements:
      - element-1
lastIssuedThreatNumber: 1
```

`test-data/panoptes/ecluse.yaml` is a production-scale example: the Écluse
threat model, read from its Threat Dragon file and written here.
