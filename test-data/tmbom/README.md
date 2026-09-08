# TM-BOM fixtures

Files come from the
[OWASP Threat Model Library at 68640e1](https://github.com/OWASP/www-project-threat-model-library/tree/68640e1447294232f7ab24ceb9527979587f1849).
The upstream [MIT licence](LICENSE) covers these files and the derived wire
schema. The repository formatter controls whitespace. The Vault scope description
normalises dash punctuation.

- `example.json`: `threat-models/infrastructure/kata-containers-threat-model.json`, stamped 1.0.2.
- `vault-invalid-zones.json`: `threat-models/infrastructure/hashicorp-vault-threat-model.json`, stamped 1.0.1.
- `schema-1.0.2.json`: the root `threat-model.schema.json`.
- `schema.json`: that schema from the upstream `v1.0.1` tag.

The Vault file references `public-internet` and `public-internet-client-zone`
without declaring either trust zone. Those references remain unchanged in this negative
fixture. Import refuses them.
