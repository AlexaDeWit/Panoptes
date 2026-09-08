# Import a foreign model

In the studio, choose **Import** beside **Export** in the File menu. Select
an OTM or TM-BOM file. Import replaces the current sketch after the usual
unsaved-changes confirmation. The result is an unsaved native model. Save
writes YAML under the source file's stem and never writes back to the
imported file. A refused import leaves the current model and file available.

The conversion report names generated values, changed representations, and
omitted source fields. Expand its details before dismissing it. Import does
not retain a source document for later merging. Keep the original file when
its omitted information matters.

`importModel(text)` provides the same conversion to application code. It
returns Effect's `Either`, with `ReadFailure` on refusal. Content determines
the format. Both JSON and YAML pass through the existing size, depth, and
alias bounds. Reference expansion and generated identifiers share a budget
of 16,777,216 UTF-16 units, exposed as `readLimits.maxImportTextUnits`.
Concatenation charges its complete result before joining. Identifier
creation charges six units per input unit as an upper bound on JSON escaping.
Intermediate strings and escaped diagnostic paths also consume this budget. A conversion over the budget
returns `ExceededReadLimit` before constructing the expanded text. Each wire package declares its foreign document independently
of the core. The mapping validates references it uses before parsing the
result through `parseModel`.

## OTM 0.2.0

Import accepts the `otmVersion: 0.2.0` stamp. All components become process
nodes because OTM component types do not define a DFD vocabulary. Their
original types remain in their descriptions. All graph records enter one
diagram, using geometry from the first declared diagram representation
where available. Missing geometry receives a deterministic layout. Additional
representations, code references, and drawing attributes are reported as
omissions. Invalid geometry produces a model failure.

Trust zones become drawn boxes. Parent relationships and numeric trust
ratings do not enter the core. A bidirectional flow becomes two arrows.
Referenced asset names and descriptions become prose on the arrows and
components. These copies no longer share an editable data identity.

Each threat occurrence becomes a separate threat with its own status and
mitigations. This preserves different treatments on different components.
Definitions without occurrences become unattached records. Known threat
statuses map to the corresponding core treatment. Unknown statuses remain
in the description and import as open. Mitigations marked implemented or
verified retain that status. Other mitigation states import as proposed,
with the source state kept in prose and differences reported.

Threat severity remains undecided. OTM numeric risk values and category
lists have no exact core equivalent and appear in the omission report.
Threats receive an unspecified custom category. Numeric mitigation
reductions, asset risk assessments, tags, and extension attributes are also
reported as omissions.

## TM-BOM 1.0.1 and 1.0.2

Import requires a `$schema` URI naming either supported release of the OWASP
Threat Model Library schema. The model's own `version` is not a schema
version. Later schema versions are refused.

Actors, components, data stores, and flows become their corresponding DFD
kinds. Import generates a diagram grouped by declared trust-zone membership.
Boxes show those zones, but membership remains visual after import. Embedded
Graphviz, Mermaid, PlantUML, and SVG sources are reported as omissions.
Import does not execute or interpret them.

Flow encryption and sensitivity values remain in the flow descriptions.
Data-set names and descriptions appear on the stores named by their
placements. TM-BOM has no direct data-set reference on a flow, so import does
not infer one. Shared data identity and other data-set properties are
reported as losses.

Threats preserve their declared component attachments and event descriptions.
They import as open, with undecided severity and an unspecified category.
Separate risk records and threat personas are reported as omissions.
Active controls become implemented mitigations. Suggested controls become
proposed mitigations. Other pending states remain in prose and import as
proposed. Retired and declined controls are reported as omissions.

Confirmed and rejected assumptions map to the existing valid and invalidated
states. Unconfirmed assumptions remain prose in the model description.
Topic links are reported as omissions. This adds no assumption state or UI.
