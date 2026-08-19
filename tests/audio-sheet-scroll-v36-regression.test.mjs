import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (p) => readFile(p, 'utf8');

test('v36.4 audio modal owns mobile touch gestures before legacy page handlers', async () => {
  const [patch, v35, guard] = await Promise.all([
    read('scripts/apply-v36-audio-sheet-scroll-fix.mjs'),
    read('scripts/apply-v35-scroll-fixes.mjs'),
    read('public/reader-audio-touch-guard.js'),
  ]);

  assert.match(v35, /apply-v36-audio-sheet-scroll-fix\.mjs/);
  assert.match(patch, /#audioShade\.on/);
  assert.match(patch, /#audioSheet/);
  assert.match(patch, /overflow-y:auto!important/);
  assert.match(patch, /reader-audio-touch-guard\.js\?v=36\.4/);
  assert.match(patch, /mafateeh-runtime-v35-audio-touch-guard-4/);
  assert.match(guard, /window\.addEventListener\('touchmove',move,\{capture:true,passive:false\}\)/);
  assert.match(guard, /e\.stopImmediatePropagation\(\)/);
  assert.match(guard, /sheet\.scrollTop=next/);
  assert.match(guard, /shade\.style\.setProperty\('overflow','hidden','important'\)/);
});
