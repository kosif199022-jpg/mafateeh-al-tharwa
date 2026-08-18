import fs from 'node:fs';
import crypto from 'node:crypto';

const read = p => fs.readFileSync(p, 'utf8');
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const must = (ok, msg) => { if (!ok) throw new Error(msg); };

// Visual identity baseline extracted from the user-provided reference archives (ه١/ه٣/ه٤).
const reader = read('public/reader.html');
const requiredTokens = [
  "--gold:#B4894A;",
  "--goldL:#D6B274;",
  "--navy:#1F3352;",
  "--deep:#0C162C;",
  "--sans:-apple-system,BlinkMacSystemFont,'SF Arabic','Geeza Pro',system-ui,sans-serif;",
  "--serif:'Geeza Pro','SF Arabic',Georgia,'Times New Roman',serif;",
  "--read:var(--serif);",
  "--bg:#fff;",
  "--bg2:#F7F5F0;",
  "--surf:#fff;",
  "--ink:#16233B;",
  "--ink2:#4A5768;"
];
for (const token of requiredTokens) must(reader.includes(token), `Reference visual token changed: ${token}`);

const referenceHashes = {
  'public/backgrounds/desert-night.webp': 'e5bb1799b5099d72ebd4a6aac7d817ea149821aa8ac75439c7100529b25f1e12',
  'public/backgrounds/forest-mist.webp': '82a3b2ca8161df2cf2dda156be81942cc1b54942a6450e3d20a5d34d8c881796',
  'public/backgrounds/ocean-dawn.webp': '7f092d01e23b6e2545d26cf636fb4e1b612f4388b8e4e31cfda17a53d58b1e50',
  'public/reader-studio.css': '78b8cc11b2bee4d0e0fb66c6b011617398cb9fa0d383412424d2b3af80041cd6',
  'public/reader-ambience.css': '3ec5c7647ff632ae43a0723e8ba1ee35f92c4e4ab944570ca5832f0ed2cfe5d3'
};
for (const [p, expected] of Object.entries(referenceHashes)) {
  must(fs.existsSync(p), `Reference asset missing: ${p}`);
  must(hash(p) === expected, `Reference asset changed: ${p}`);
}

// Preserve every capability present in the reference, while allowing newer capabilities to remain a superset.
const requiredFiles = [
  'public/reader-tools.js','public/reader-tools.css',
  'public/reader-ambience.js','public/reader-ambience.css',
  'public/reader-studio.js','public/reader-studio.css',
  'public/reader-formats.js',
  'public/reader-mixer.js','public/reader-mixer.css',
  'public/reader-smart-suite.js','public/reader-smart-suite.css',
  'public/reader-master-fixes.js','public/piper-worker.js',
  'public/manifest.webmanifest','public/sw.js'
];
for (const p of requiredFiles) must(fs.existsSync(p), `Capability file missing: ${p}`);

for (const bg of ['forest-mist.webp','ocean-dawn.webp','desert-night.webp']) {
  must(fs.existsSync(`public/backgrounds/${bg}`), `Background missing: ${bg}`);
}
for (let i = 1; i <= 34; i++) {
  const n = String(i).padStart(2,'0');
  must(fs.existsSync(`public/audio/chapter-${n}.mp3`), `Narrator audio missing: chapter-${n}.mp3`);
  must(fs.existsSync(`public/audio/timings/chapter-${n}.json`), `Word timing missing: chapter-${n}.json`);
}

must(/"no"\s*:\s*46/.test(reader), 'Modified 46-chapter book is not present');
must(reader.includes('reader-master-fixes.js'), 'Master iPhone/Safari fixes are not loaded');
must(reader.includes('reader-smart-suite.js'), 'Smart library is not loaded');
must(reader.includes('reader-mixer.js'), 'Mixer Pro is not loaded');
must(reader.includes('reader-studio.js'), 'Studio is not loaded');
must(reader.includes('reader-ambience.js'), 'Ambience/background system is not loaded');
must(reader.includes("behavior:'instant'"), 'Instant auto-scroll protection is missing');

console.log('PASS: reference formatting, backgrounds, fonts and capabilities are preserved as a superset.');
