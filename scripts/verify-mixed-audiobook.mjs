import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const readerPath = path.join(root,'public','reader.html');
const audioDir = path.join(root,'public','audio');
const reader = fs.readFileSync(readerPath,'utf8');
const a = reader.indexOf('const D = '), b = reader.indexOf('const CH', a);
if (a < 0 || b < 0) throw new Error('Book data missing');
const D = vm.runInNewContext(`${reader.slice(a,b)}\nD`, Object.create(null));
const chapters = D.parts.flatMap(p=>p.chapters);
if (chapters.length !== 46) throw new Error(`Expected 46 chapters, found ${chapters.length}`);
const manifest = JSON.parse(fs.readFileSync(path.join(audioDir,'manifest.json'),'utf8'));
if (manifest.version !== 3 || manifest.bookVersion !== 46 || manifest.chapterCount !== 46) throw new Error('Mixed audiobook manifest is not v3/46');
if (manifest.voice !== 'mixed' || manifest.speakers?.male !== 'Charon' || manifest.speakers?.female !== 'Kore') throw new Error('Mixed speakers are not Charon + Kore');
if (!Array.isArray(manifest.chapters) || manifest.chapters.length !== 46) throw new Error('Manifest does not contain 46 audio chapters');
for (const chapter of chapters) {
  const n=String(chapter.no).padStart(2,'0');
  const mp3=path.join(audioDir,`chapter-${n}.mp3`);
  const timing=path.join(audioDir,'timings',`chapter-${n}.json`);
  if (!fs.existsSync(mp3) || fs.statSync(mp3).size < 25000) throw new Error(`Missing/invalid mixed audio chapter ${n}`);
  if (!fs.existsSync(timing)) throw new Error(`Missing timing chapter ${n}`);
  const t=JSON.parse(fs.readFileSync(timing,'utf8'));
  if (t.chapter !== chapter.no || !Array.isArray(t.words) || !t.words.length) throw new Error(`Invalid timing chapter ${n}`);
  const m=manifest.chapters.find(x=>x.no===chapter.no);
  if (!m || m.title !== chapter.title || m.voice !== 'mixed') throw new Error(`Manifest mismatch chapter ${n}`);
}
console.log('PASS: 46 modified-book chapters have Gemini mixed Charon+Kore audio and timings; legacy 34-chapter mapping is gone.');
