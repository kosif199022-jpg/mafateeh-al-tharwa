import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=p=>readFile(p,'utf8');

test('v37 keeps the user stable reader scrolling model while retaining 46 chapters and Gemini builder',async()=>{
  const [reader,sw,manifest,version]=await Promise.all([
    read('public/reader.html'),read('public/sw.js'),read('public/manifest.webmanifest'),read('public/master-version.json')
  ]);
  assert.match(reader,/Mafateeh stable native-scroll architecture v37/);
  assert.match(reader,/#audioShade\.on\{display:flex\}/);
  assert.match(reader,/#audioSheet\{[^}]*max-height:92dvh;overflow:auto/s);
  assert.doesNotMatch(reader,/reader-master-fixes\.js/);
  assert.doesNotMatch(reader,/reader-audio-touch-guard\.js/);
  assert.doesNotMatch(reader,/mkAudioSheetScrollV36/);
  assert.match(reader,/function mediaOpen\(mode,selected=''/);
  assert.match(reader,/function mediaClose\(\)/);
  assert.match(reader,/mediaStartFromWord/);
  assert.match(reader,/data-audio-word/);
  assert.match(reader,/"no"\s*:\s*46/);
  assert.match(reader,/reader-audiobook-builder\.js\?v=37/);
  assert.match(reader,/\/api\/audiobook\/audio\//);
  assert.match(reader,/\/api\/audiobook\/timing\//);
  assert.match(sw,/mafateeh-al-tharwa-v37-stable-native/);
  assert.doesNotMatch(sw,/reader-master-fixes\.js/);
  assert.match(manifest,/"start_url": "\/reader\.html\?v=37"/);
  assert.equal(JSON.parse(version).version,'37.0.0');
});
