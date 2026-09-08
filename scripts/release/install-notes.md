## Install the CLI on macOS or Linux

Download and inspect this release's installer, then run it as your own user:

```sh
curl -q --fail --show-error --location --proto '=https' --proto-redir '=https' \
  --output install.sh \
  https://github.com/@REPOSITORY@/releases/download/@RELEASE_TAG@/install.sh
less install.sh
bash install.sh
```

The installer checks the binary against its embedded SHA-256 before installing
or replacing `~/.local/bin/saer`. The `saerskriven` compatibility command links
to that executable. Repeated runs install the same version.
Use `saer validate threat-model.yaml` to validate a model.
It needs Bash, curl, and `sha256sum` or `shasum`. It does not need a development
environment or sudo.

See the [installation instructions](https://github.com/@REPOSITORY@/blob/@RELEASE_TAG@/README.md#install)
for PATH setup, a custom directory, and optional verification of the installer
and binary attestations with the GitHub CLI.
