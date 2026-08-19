#!/usr/bin/env bash
set -euo pipefail
fail(){ echo "::error::$*"; exit 1; }
required=(
  public/reader.html public/reader-tools.js public/reader-ambience.js public/reader-studio.js public/reader-formats.js
  public/reader-mixer.js public/reader-mixer.css public/reader-smart-suite.js public/reader-smart-suite.css
  public/reader-master-fixes.js public/piper-worker.js public/sw.js public/audio/manifest.json tests/scroll-regressions.test.mjs
  app/api/tts/route.ts app/api/_lib/ai.ts app/api/ai/chat/route.ts app/api/ai/pdf/route.ts app/api/ai/status/route.ts app/api/ai/tts/route.ts
)
for f in "${required[@]}"; do [ -s "$f" ] || fail "Missing required Master feature: $f"; done
for n in $(seq -w 1 34); do
  [ -s "public/audio/chapter-$n.mp3" ] || fail "Missing audiobook chapter-$n.mp3"
  [ -s "public/audio/timings/chapter-$n.json" ] || fail "Missing word timings chapter-$n.json"
done
count=$(find public/audio -maxdepth 1 -name 'chapter-*.mp3' -type f | wc -l | tr -d ' ')
[ "$count" -eq 34 ] || fail "Expected 34 MP3 chapters, found $count"
bytes=$(find public/audio -maxdepth 1 -name 'chapter-*.mp3' -type f -printf '%s\n' | awk '{s+=$1} END{print s+0}')
[ "$bytes" -ge 69000000 ] || fail "Audiobook payload unexpectedly small: $bytes bytes"
node - <<'NODE'
const fs=require('fs');const m=JSON.parse(fs.readFileSync('public/audio/manifest.json','utf8'));
if(!Array.isArray(m.chapters)||m.chapters.length!==34)throw new Error(`manifest chapters=${m.chapters?.length}`);
NODE
version=$(node -p "require('./public/master-version.json').version")
major=${version%%.*}
grep -q "reader-mixer.js?v=$major" public/reader.html || fail 'reader.html does not load Mixer Master'
grep -q "reader-smart-suite.js?v=$major" public/reader.html || fail 'reader.html does not load Smart Suite Master'
grep -q "reader-master-fixes.js?v=$major" public/reader.html || fail 'Master runtime fix direct loader missing'
grep -q '#smartHubDock{display:none!important}' public/reader-smart-suite.css || fail 'Smart dock is not hidden for distraction-free reading'
grep -q '.mixer-dock{display:none!important}' public/reader-mixer.css || fail 'Mixer dock is not hidden for distraction-free reading'
if grep -q 'rm -f public/reader-mixer' .github/workflows/deploy-cloudflare.yml; then fail 'Deployment workflow still strips advanced features'; fi

# iPhone audio modal: the fixed shade, not the book page, must own vertical scrolling.
node tests/audio-sheet-scroll-v36-regression.test.mjs
grep -q 'id="mkAudioSheetScrollV36"' public/reader.html || fail 'Audio shade scroll CSS was not injected'
grep -q 'Mafateeh audio shade hard lock v36' public/reader-master-fixes.js || fail 'Audio background hard lock is missing'
grep -q "'#audioShade.on'" public/reader-master-fixes.js || fail 'Audio shade is not the primary overlay scroller'
grep -q 'mafateeh-runtime-v35-audio-scroll-3' public/sw.js || fail 'Audio scroll cache bust v3 is missing'

echo "Master regression guard passed: v$version, 34 MP3s, $bytes bytes, advanced reader, AI, Piper, offline runtime, distraction-free UI and iPhone audio overlay scrolling present."
