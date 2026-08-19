import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=p=>readFile(p,'utf8');

test('v38 keeps stable Reader v12 mobile scrolling while retaining 46 chapters and Gemini builder',async()=>{
  const [reader,sw,manifest,version]=await Promise.all([
    read('public/reader.html'),read('public/sw.js'),read('public/manifest.webmanifest'),read('public/master-version.json')
  ]);

  const meta=JSON.parse(version);
  assert.equal(meta.version,'38.0.0');
  assert.equal(meta.audioChapters,46);
  assert.match(String(meta.buildId||''),/^[a-zA-Z0-9._-]+$/);
  const buildId=String(meta.buildId);
  const q=`v=38&b=${buildId}`;

  assert.match(reader,/Mafateeh stable Reader v12 architecture \+ isolated audio scroll v38/);
  assert.match(reader,/#audioShade\.on\{display:flex\}/);
  assert.match(reader,/#audioSheet\{[^}]*max-height:92vh;max-height:92dvh;[^}]*overflow-y:auto;[^}]*-webkit-overflow-scrolling:touch;[^}]*touch-action:pan-y/s);
  assert.match(reader,/#installSheet\{[^}]*max-height:90vh;max-height:90dvh;[^}]*overflow-y:auto;[^}]*-webkit-overflow-scrolling:touch/s);
  assert.match(reader,/Mafateeh audio modal isolation v38/);
  assert.match(reader,/function mediaPrimeScrollBoundary\(\)/);
  assert.match(reader,/function mediaLockPage\(\)/);
  assert.match(reader,/root\.style\.overflow='hidden'/);
  assert.match(reader,/b\.style\.position='fixed'/);
  assert.match(reader,/function mediaUnlockPage\(\)/);
  assert.match(reader,/mediaShadeNode\?\.addEventListener\('touchmove'/);

  // The sheet itself must stay native-scrollable: no touchmove preventDefault handler on it.
  assert.doesNotMatch(reader,/mediaNativeSheet\?\.addEventListener\('touchmove'/);
  assert.doesNotMatch(reader,/reader-master-fixes\.js/);
  assert.doesNotMatch(reader,/reader-audio-touch-guard\.js/);
  assert.doesNotMatch(reader,/mkAudioSheetScrollV36/);
  assert.doesNotMatch(reader,/#audioShade\{[^}]*touch-action:none/s);

  // Match the stable Reader v12 module surface; only tools + ambience are retained.
  assert.ok(reader.includes(`/reader-tools.js?${q}`));
  assert.ok(reader.includes(`/reader-ambience.js?${q}`));
  assert.ok(reader.includes(`/reader-tools.css?${q}`));
  assert.ok(reader.includes(`/reader-ambience.css?${q}`));
  assert.ok(reader.includes(`/sw.js?${q}`));
  assert.ok(reader.includes(`/manifest.webmanifest?${q}`));
  assert.doesNotMatch(reader,/reader-formats\.js/);
  assert.doesNotMatch(reader,/reader-studio\.js/);
  assert.doesNotMatch(reader,/reader-mixer\.js/);
  assert.doesNotMatch(reader,/reader-smart-suite\.js/);
  assert.doesNotMatch(reader,/reader-studio\.css/);
  assert.doesNotMatch(reader,/reader-mixer\.css/);
  assert.doesNotMatch(reader,/reader-smart-suite\.css/);

  // Reader/audio features that must survive the architecture reset.
  assert.match(reader,/function mediaOpen\(mode,selected=''/);
  assert.match(reader,/function mediaClose\(\)/);
  assert.match(reader,/mediaStartFromWord/);
  assert.match(reader,/data-audio-word/);
  assert.match(reader,/data-mode="chapter"/);
  assert.match(reader,/data-mode="book"/);
  assert.match(reader,/data-mode="selection"/);
  assert.match(reader,/"no"\s*:\s*46/);
  assert.ok(reader.includes(`/reader-audiobook-builder.js?${q}`));
  assert.match(reader,/\/api\/audiobook\/audio\//);
  assert.match(reader,/\/api\/audiobook\/timing\//);

  assert.ok(sw.includes(`mafateeh-v38-${buildId}`));
  assert.ok(sw.includes(`mafateeh-runtime-v38-${buildId}`));
  assert.ok(sw.includes(`OFFLINE_FALLBACK = "/reader.html?${q}"`));
  assert.doesNotMatch(sw,/reader-master-fixes\.js/);
  assert.doesNotMatch(sw,/reader-smart-suite\.js/);
  assert.match(manifest,/"start_url": "\/reader\.html\?v=38"/);
});
