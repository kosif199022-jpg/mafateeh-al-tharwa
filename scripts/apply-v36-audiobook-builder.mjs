import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const readerPath = path.join(root, 'public', 'reader.html');
let source = await readFile(readerPath, 'utf8');

let buildId = 'local-v38';
try {
  const meta = JSON.parse(await readFile(path.join(root, 'public', 'master-version.json'), 'utf8'));
  if (meta?.buildId) buildId = String(meta.buildId);
} catch {}
buildId = buildId.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 32) || 'local-v38';
const builderUrl = `/reader-audiobook-builder.js?v=38&b=${buildId}`;

const replacements = [
  ["fetch('/audio/manifest.json?v=3')", "fetch('/api/audiobook/manifest?v=4',{cache:'no-store'})"],
  ["const savedChapterUrl=index=>`/audio/chapter-${String(CH[index].no).padStart(2,'0')}.mp3`;", "const savedChapterUrl=index=>`/api/audiobook/audio/${String(CH[index].no).padStart(2,'0')}`;"],
  ["const savedTimingUrl=index=>`/audio/timings/chapter-${String(CH[index].no).padStart(2,'0')}.json?v=1`;", "const savedTimingUrl=index=>`/api/audiobook/timing/${String(CH[index].no).padStart(2,'0')}`;"],
];

for (const [from, to] of replacements) {
  if (source.includes(to)) continue;
  if (!source.includes(from)) throw new Error(`v38 audiobook patch target not found: ${from.slice(0, 80)}`);
  source = source.replace(from, to);
}

source = source.replace(/<script src="\/reader-audiobook-builder\.js\?[^\"]+"><\/script>\n?/g, '');
if (!source.includes(`src="${builderUrl}"`)) {
  const tag = `<script src="${builderUrl}"></script>\n`;
  if (!source.includes('</body>')) throw new Error('reader.html has no closing body tag.');
  source = source.replace('</body>', `${tag}</body>`);
}

if (!source.includes('Mafateeh in-app audiobook builder v38')) {
  source = source.replace(/<!-- Mafateeh in-app audiobook builder v\d+ -->\n?/g, '');
  source = source.replace('</head>', '<!-- Mafateeh in-app audiobook builder v38 -->\n</head>');
}

await writeFile(readerPath, source);

// Build a server-readable, exact source of the modified 46-chapter book.
// The browser only sends {chapter, apiKey}; it cannot replace book text on the server.
const start = source.indexOf('const D = ');
const end = source.indexOf('const CH', start);
if (start < 0 || end < 0) throw new Error('Book data was not found in reader.html.');
const D = vm.runInNewContext(`${source.slice(start, end)}\nD`, Object.create(null), { timeout: 2_000 });
const chapters = D.parts.flatMap((part) => part.chapters).map((chapter) => ({
  no: Number(chapter.no),
  title: String(chapter.title || ''),
  key: String(chapter.key || ''),
  body: Array.isArray(chapter.body) ? chapter.body.map((row) => [String(row?.[0] ?? ''), String(row?.[1] ?? '')]) : [],
  idea: String(chapter.idea || ''),
  apply: String(chapter.apply || ''),
  qs: Array.isArray(chapter.qs) ? chapter.qs.map((q) => String(q || '')) : [],
  week: String(chapter.week || ''),
}));
if (chapters.length !== 46) throw new Error(`Expected 46 chapters, found ${chapters.length}.`);
if (chapters.some((chapter, index) => chapter.no !== index + 1 || !chapter.title)) throw new Error('Chapter numbering/title validation failed.');
const bookSourcePath = path.join(root, 'public', 'audio', 'book-v46-source.json');
await mkdir(path.dirname(bookSourcePath), { recursive: true });
await writeFile(bookSourcePath, `${JSON.stringify({ version: 1, bookVersion: 46, chapterCount: 46, chapters })}\n`);

console.log(`Applied v38 in-app audiobook builder (${builderUrl}) and generated exact 46-chapter server source.`);
