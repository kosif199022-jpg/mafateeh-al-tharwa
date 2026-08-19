import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (p) => readFile(p, 'utf8');

test('v36 audio overlay is the iPhone scroll surface and the book is hard-locked behind it', async () => {
  const [patch, v35] = await Promise.all([
    read('scripts/apply-v36-audio-sheet-scroll-fix.mjs'),
    read('scripts/apply-v35-scroll-fixes.mjs'),
  ]);

  assert.match(v35, /apply-v36-audio-sheet-scroll-fix\.mjs/);
  assert.match(patch, /#audioShade\.on/);
  assert.match(patch, /overflow-y:auto!important/);
  assert.match(patch, /-webkit-overflow-scrolling:touch!important/);
  assert.match(patch, /overscroll-behavior-y:contain!important/);
  assert.match(patch, /#audioSheet/);
  assert.match(patch, /overflow:visible!important/);
  assert.match(patch, /Mafateeh audio shade hard lock v36/);
  assert.match(patch, /b\.style\.position='fixed'/);
  assert.match(patch, /h\.style\.overflow='hidden'/);
  assert.match(patch, /'#audioShade\.on'/);
  assert.match(patch, /mafateeh-runtime-v35-audio-scroll-3/);
});
