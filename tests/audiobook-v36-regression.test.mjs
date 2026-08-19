import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(p,'utf8');
test('v36 in-app audiobook builder keeps key memory-only and uses durable R2 routes',async()=>{
 const [builder,worker,patch,hosting,vite,build,v35]=await Promise.all([read('public/reader-audiobook-builder.js'),read('worker/index.ts'),read('scripts/apply-v36-audiobook-builder.mjs'),read('.openai/hosting.json'),read('vite.config.ts'),read('scripts/build-verified.sh'),read('scripts/apply-v35-scroll-fixes.mjs')]);
 assert.match(builder,/Gemini API Key/);assert.match(builder,/Charon/);assert.match(builder,/Kore/);assert.match(builder,/\/api\/audiobook\/generate/);assert.match(builder,/\/api\/audiobook\/status/);assert.doesNotMatch(builder,/localStorage\.(?:setItem|getItem)/i);assert.doesNotMatch(builder,/indexedDB\.open/i);
 assert.match(worker,/AUDIO_BUCKET\?:R2Bucket|AUDIO_BUCKET\?: R2Bucket/);assert.match(worker,/gemini-3\.1-flash-tts-preview/);assert.match(worker,/speaker:\s*"Narrator",\s*voice:\s*SPEAKERS\.male/);assert.match(worker,/speaker:\s*"Guide",\s*voice:\s*SPEAKERS\.female/);assert.match(worker,/estimated-per-gemini-chunk-v36/);assert.match(worker,/PREFIX="mafateeh-audiobook-v36"/);assert.match(worker,/PROGRESS_KEY=`\$\{PREFIX\}\/progress\.json`/);assert.match(worker,/Accept-Ranges/);
 assert.match(patch,/reader-audiobook-builder\.js\?v=36/);assert.match(patch,/\/api\/audiobook\/audio/);assert.match(patch,/\/api\/audiobook\/timing/);assert.match(patch,/book-v46-source\.json/);assert.match(v35,/apply-v36-audiobook-builder\.mjs/);
 assert.equal(JSON.parse(hosting).r2,'AUDIO_BUCKET');assert.match(vite,/bucket_name: "mafateeh-al-tharwa-audio"/);assert.match(build,/r2 bucket create/);
});
