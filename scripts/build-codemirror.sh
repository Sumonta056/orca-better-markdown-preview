#!/bin/sh
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cp "$root/scripts/codemirror-entry.js" "$work/entry.js"
cd "$work"
npm init -y >/dev/null
npm install --no-audit --no-fund --silent \
  @codemirror/state@6.5.0 @codemirror/view@6.35.0 @codemirror/language@6.10.6 \
  @codemirror/commands@6.7.1 @codemirror/lang-markdown@6.3.1 @lezer/highlight@1.2.1 esbuild@0.24.0
npx esbuild entry.js --bundle --format=esm --minify --legal-comments=none --outfile="$root/lib/codemirror.mjs"
