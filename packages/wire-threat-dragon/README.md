# @panoptes/wire-threat-dragon

The OWASP Threat Dragon v2 file format as a zod schema and the types inferred
from it. That is the whole package: no reading, no writing, no mapping.

The format belongs to another project and the files are already in the wild,
so this schema is the only authority on it here. It declares its own ids, its
own vocabularies and its own record shapes, and it imports zod and nothing
else. The layer matrix enforces that: `layer:wire` may depend on no internal
package, so a schema here cannot be built out of the internal model's, and no
change to the model can change what a Threat Dragon file means.

It declares what Threat Dragon writes, not what Threat Dragon publishes. The
JSON Schema that project ships describes the same format and the two differ:
the published one puts a cell's threats beside `data` rather than under it,
names a threat's id `threatId`, and declares neither ports nor tools nor
labels nor `threatFrequency` nor the boundary bookkeeping. Where the two agree
on a bound this schema takes the published one, which is where a cell id and a
threat id of at least two characters come from. Two published bounds it does
not take. `diagramType` is `minLength: 3` there and one character here,
because that value is a display label Threat Dragon translates and a
two-character label in some language is not far-fetched. The string branch of
`summary.id` is `minLength: 2` there and unbounded here, a bound this schema
has yet to take. `test-data/README.md` records the same difference from the
other side, beside the vendored copy.

The schema declares every key the format carries, the parts Panoptes does not
model included, because a write merges onto the document a read returned and
only a declared key is there to leave alone. What it declares it demands, and
it demands nothing else: a value with no home in the internal model reaches
the document intact and is refused, if at all, by the mapping rather than
here.

The codec is `readThreatDragon` and `writeThreatDragon` in
[`@panoptes/formats`](../formats/README.md), which maps between this format
and the model and is the only package that knows both. The corpus that gates
it is thirteen files: the twelve threat models Threat Dragon ships, vendored
under `test-data/threat-dragon` beside its published schema, and the Écluse
model at `test-data/ecluse.json`.

Unit tests: `pnpm nx test @panoptes/wire-threat-dragon`.
