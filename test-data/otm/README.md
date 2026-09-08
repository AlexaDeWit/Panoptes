# OTM fixtures

`example.json` is `EXAMPLE.json` from
[OpenThreatModel at c88c5a7](https://github.com/iriusrisk/OpenThreatModel/tree/c88c5a7b4115f0f025e28d5682a2b0d790b389e4).
It is licensed under CC BY-SA 4.0, reproduced in [LICENSE](LICENSE).
`schema.json` is `otm_schema.json` from the same revision. Its own licence
statement specifies Apache License 2.0.

The repository formatter controls whitespace. The example contains
`dataflows[].representations` and a representation's `package` field, which
neither the upstream schema nor its format tables declare. The wire schema
omits them and the import reports them as undeclared.
