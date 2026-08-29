# 0001: Electron for the desktop shell

Status: accepted, 2026-08-29

## Context

The desktop build must render identically on every platform, the property the
project values in Threat Dragon's desktop distribution. Tauri produces
smaller binaries but renders in each platform's system webview, which
reintroduces cross-platform drift, and adds a Rust surface to a TypeScript
repo.

## Decision

Electron wraps the studio app: bundled Chromium, identical rendering
everywhere, one language in the repository.

## Consequences

Larger downloads, accepted. The shell stays thin (`apps/desktop` when it
lands), so a future shell swap stays possible.
