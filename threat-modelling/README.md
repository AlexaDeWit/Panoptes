# threat-modelling

Panoptes' own threat model, in Panoptes' own format.

## `panoptes.yaml`

Two diagrams. `read-and-render` is the path a model file takes from disk
through the codecs into a register or a diagram. `agent-and-desktop` is the
path an agent or the desktop shell takes to the same core. Between them, 37
elements and 4 trust boundaries, 25 threats, 12 mitigations and 3
assumptions.
The threats are the ones this repository actually has: hostile files reaching
the read limits and the wire schemas, foreign prose reaching the render
paths, the desktop IPC bridge, and the MCP write tools.

Every status is true to the tree. A threat is mitigated where a mechanism is
on `main` and its mitigation prose names that mechanism, open where the
surface is designed and its issue is named but nothing is built, and carries
an undecided severity where there is nothing built to assess. Fifteen are
mitigated, nine are open, and one is transferred to whoever publishes a
register. Every mitigated threat names a mitigation record, and every open
one names the issue that carries the work.

It is a draft the maintainer will refine. What it is not is decoration: it is
the second production-scale fixture the suites gate on, beside the Écluse
model under `test-data/`, and the first one authored in the native format
rather than read out of Threat Dragon's.

## Where it gates

| Suite              | What it holds the file to                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| `packages/formats` | It reads with no divergence, it is its own golden, and it is opened as Panoptes YAML without being told |
| `packages/formats` | No read bound refuses it, alongside the Écluse file and the Threat Dragon corpus                        |
| `packages/render`  | `test-data/render/panoptes.register.snapshot.md` is its threat register                                 |
| `packages/render`  | One standalone SVG document per diagram, under `test-data/render/`                                      |
| `packages/canvas`  | One committed scene per diagram, beside `scene.spec.tsx`                                                |

Those suites read lists rather than paths, so a third model file joins every
one of them by being added to `nativeFixtures` in
`packages/formats/src/lib/panoptes-yaml.fixtures.ts`, and to the register,
document and scene lists in the render and canvas specs. Each diagram is
drawn twice on purpose: the canvas golden is the glyphs alone, and the render
golden is the SVG document composed around them.

`packages/formats` also writes this model out as
`test-data/panoptes.model.json`, because the render and canvas suites gate on
a model and the layer matrix keeps the codec out of their reach. Where that
goes is a field on the same `nativeFixtures` entry, so a third file brings
its own. Écluse names none: `test-data/ecluse.model.json` is written by
`packages/model` from its own hand transcription of the Threat Dragon file,
the fixture that carries M1's representability gate, and this suite compares
its read against that file rather than producing it. A file authored in the
native format has no such transcription, so the codec is its only producer.

That file is derived. This one is the source.

## Editing it

The committed bytes are what `writePanoptesYaml` produces, compared as a
vitest file snapshot against the file itself. A hand edit that leaves the
writer's canonical form therefore reds the suite rather than passing. Edit the
file, then regenerate it in the same commit:

```sh
pnpm nx test @panoptes/formats -- -u    # canonical form, and the model JSON
pnpm nx test @panoptes/render -- -u     # the register
pnpm nx test @panoptes/canvas -- -u     # one SVG per diagram
```

Read every diff before committing. Each of those files is an output by
definition, so a change to one is a change to what the format, the register,
or the canvas writes.

`nx.json` names this directory in `sharedGlobals`, so editing the model
invalidates the cached result of every task that reads it. `.oxfmtrc.json`
leaves the YAML here alone, for the same reason it leaves the payloads under
`test-data/` alone: a formatter must not rewrite a file that is compared byte
for byte.

## One thing the drawing gets wrong

The name of `tb-untrusted`, the curve trust boundary on `agent-and-desktop`,
is drawn across the curve rather than beside it. That is not this file's
geometry. `packages/canvas` places a curve boundary's name centred one line
above the middle waypoint, which for a divider running down the page is a
point on the curve itself, and no arrangement of waypoints moves it off.
Leave the waypoints alone; the fix belongs in the canvas.

A flow's name is different, and is this file's to place. It is drawn beside
the midpoint of the flow's longest segment, so a flow crossing a boundary
puts its name near that crossing, and a gap narrower than the name means a
dashed edge drawn through it. Every gap here is wide enough for the name that
crosses it with room to spare, measured against the name unwrapped rather
than as the canvas happens to wrap it today. Moving an element toward a
boundary is what breaks that, so re-render and look after any move.
