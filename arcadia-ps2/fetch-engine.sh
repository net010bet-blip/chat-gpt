#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
# Fetch prebuilt WASM + workers from publicly documented upstream project.
# Integration JavaScript (site/app.js) is authored by ARCADIA, not copied.
UPSTREAM="https://raw.githubusercontent.com/alekseichmsk/ps2-web/main/site"
mkdir -p "$ROOT/dist/emulator"
cp "$ROOT/site/index.html" "$ROOT/site/style.css" "$ROOT/site/app.js" "$ROOT/dist/"
for name in Play.js Play.wasm License.txt; do
  echo "Fetching Play! resource $name"
  curl -fL --retry 3 --retry-delay 2 "$UPSTREAM/emulator/$name" -o "$ROOT/dist/emulator/$name"
  test -s "$ROOT/dist/emulator/$name"
done
curl -fL --retry 3 --retry-delay 2 "$UPSTREAM/coi-serviceworker.js" -o "$ROOT/dist/coi-serviceworker.js"
# Integrity checks from the upstream artifact provenance (15 October 2026).
(
  cd "$ROOT/dist/emulator"
  printf '%s  %s\n' \
    '5599ff16ae5e3534f9b779736aedfa20661821d57be7f03e587e31ef8d090317' 'Play.js' \
    'c7cdaee26e8fd0a3aab50cfe27ac6ec5ca2bfba0cc5962958b07d739c1a73ab3' 'Play.wasm' \
    | sha256sum -c -
)
# A GitHub Pages build needs this file to avoid Jekyll processing the WebAssembly resources.
touch "$ROOT/dist/.nojekyll"
cat > "$ROOT/dist/BUILD-INFO.txt" <<BUILD
ARCADIA PS2; open source core Play! (https://github.com/jpd002/Play-)
Browser assets downloaded from $UPSTREAM on $(date -u +%FT%TZ)
BUILD
ls -lah "$ROOT/dist/emulator"