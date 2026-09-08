# @saerskriven/wire-tmbom

The TM-BOM 1.0.1 and 1.0.2 wire schemas from the OWASP Threat Model Library.
This package imports zod alone. Each document must identify its supported
schema URI through `$schema`. The later variant adds required actor and
store trust-zone membership and a bounded risk-level vocabulary.

The schema declares all foreign fields, including information the core does
not model. Namespaced extensions retain unknown values. Callers must bound
input before validation, including those extension values.

[Fixture provenance](../../test-data/tmbom/README.md) records the sources.
The derived schema carries the upstream [MIT licence](LICENSE).
[Import behaviour](../formats/IMPORT.md) belongs to the mapping package.
