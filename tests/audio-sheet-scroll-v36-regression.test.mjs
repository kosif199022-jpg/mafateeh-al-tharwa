import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (p) => readFile(p, 'utf8');

test('v36 audio modal hard-locks the background and keeps the real iPhone sheet scrollable', async () => {
  const [patch, v35] = await Promise.all([
    read('scripts/apply-v36-audio-sheet-scroll-fix.mjs'),
    read('scripts/apply-v35-scroll-fixes.mjs'),
  ]);

  assert.match(v35, /apply-v36-audio-sheet-scroll-fix\.mjs/);
  assert.match(patch, /#audioShade\.on/);
  assert.match(patch, /#audioSheet/);
  assert.match(patch, /overflow-y:auto!important/);
  assert.match(patch, /-webkit-overflow-scrolling:touch!important/);
  assert.match(patch, /touch-action:pan-y!important/);
  assert.match(patch, /#audioShade\.on #audioSheet/);
  assert.match(patch, /Mafateeh audio hard background lock v36/);
  assert.match(patch, /mkAudioHardLocked/);
  assert.match(patch, /b\.style\.position='fixed'/);
  assert.match(patch, /b\.style\.top=/);
  assert.match(patch, /mk-audio-hard-lock/);
  assert.match(patch, /mafateeh-runtime-v35-audio-scroll-2/);
});
