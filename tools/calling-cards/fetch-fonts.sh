#!/usr/bin/env bash
# Fetch the LOCKED BBF brand fonts (OFL) for the local renderer (render.mjs).
# The edge function fetches these at runtime; this is only for local QA.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p fonts
B="https://raw.githubusercontent.com/google/fonts/main/ofl/bebasneue"
BC="https://raw.githubusercontent.com/google/fonts/main/ofl/barlowcondensed"
curl -sSL -o fonts/BebasNeue-Regular.ttf "$B/BebasNeue-Regular.ttf"
for w in Medium SemiBold Bold ExtraBold; do
  curl -sSL -o "fonts/BarlowCondensed-$w.ttf" "$BC/BarlowCondensed-$w.ttf"
done
echo "fonts ready -> ./fonts/"
