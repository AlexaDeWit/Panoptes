#!/usr/bin/env bash

set -euo pipefail

pages_base=${PAGES_BASE_PATH:?PAGES_BASE_PATH must name the preview base path}
pages_port=${PAGES_PREVIEW_PORT:?PAGES_PREVIEW_PORT must name the preview port}

pnpm exec vite build --config apps/studio/vite.pages.config.mts
exec pnpm exec vite preview \
  --config apps/studio/vite.pages.config.mts \
  --base="$pages_base" \
  --port="$pages_port" \
  --strictPort
