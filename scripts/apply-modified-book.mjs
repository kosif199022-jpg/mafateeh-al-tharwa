import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

const expected = new Map([
  ['scripts/book-payload/part01.txt','4bc12b23064d98fd4eb59e6b8d275cd9a9910e619ffc641955b63d394eb1c15a'],
  ['scripts/book-payload/part02.txt','aa7795422fb91604f9d8ee3a58b19162906cf7a9f5de786a92271d852bc44383'],
  ['scripts/book-payload/part03.txt','fc292724c32bacd870e801743ae8809ada66fa17be08c7429b1e9066ef1a02d2'],
  ['scripts/book-payload/part04.txt','94d3dac5b367baa80a2022fb8c0cd0e65fd963881fad2a3b42f22ef777a16c6c'],
  ['scripts/book-payload/part05.txt','0b7dd431cb644d1b57fe5e77d29476704434bf0c3205f09b9dcb214923e04482'],
  ['scripts/book-payload/part06.txt','bde030be4f55ce2ab0a8f7d651946bf5fdbb25f32e8f8b53b81ca7411e09775d'],
  ['scripts/book-payload/part07.txt','2130c710bfa8d4373fccdca18a1e3fe2fc55e99570fff302ebfca25590b9a407'],
  ['scripts/book-payload/part08.txt','b346a70a9426c8cf43d9fd23a061787d102447d99e14468c52813c8dfdd64e9d'],
  ['scripts/book-payload/part09.txt','80650f194c3d2e027074de7f570f2f26aace7b4560dbc92cd1e16be61567b687'],
  ['scripts/book-payload/part10.txt','c5e192f3cface06f42219e5ee0f2b130da6b41a97a3172a419bbc439a0d64c5d'],
  ['scripts/book-payload/part11a.txt','e1d1d98133c15bc549349ecfc28f18b86dd9da94814a2507da02fc7fa1cac093'],
  ['scripts/book-payload/part11b.txt','bd8c71b41aa87be885374438f99c050ba56663d1d34425a7c057899763a5b28b'],
  ['scripts/book-payload/part12.txt','2b7e324ec0cf6fd604c481c5049ab58acc0dac34709ba38bd08857fcea0883b1'],
]);

let bad = false;
const chunks = [];
for (const [file, wanted] of expected) {
  const value = fs.readFileSync(file, 'utf8').trim();
  const got = crypto.createHash('sha256').update(value).digest('hex');
  console.log(`${file}: ${value.length} chars ${got === wanted ? 'OK' : `BAD ${got}`}`);
  if (got !== wanted) bad = true;
  chunks.push(value);
}
if (bad) throw new Error('Modified book payload checksum mismatch');

const encoded = chunks.join('');
if (encoded.length !== 123436) throw new Error(`Modified book payload length mismatch: ${encoded.length}`);
const replacement = zlib.brotliDecompressSync(Buffer.from(encoded, 'base64')).toString('utf8');
if (!replacement.startsWith('const D = ')) throw new Error('Modified book payload does not start with const D');
if (!replacement.includes('"no": 46')) throw new Error('Modified book payload does not include chapter 46');

const readerPath = 'public/reader.html';
let reader = fs.readFileSync(readerPath, 'utf8');
const start = reader.indexOf('const D = ');
if (start < 0) throw new Error('Could not locate const D in reader.html');
const afterStart = start + 'const D = '.length;
const nextConst = reader.slice(afterStart).match(/\nconst\s+[A-Za-z_$]/);
if (!nextConst) throw new Error('Could not locate the end of the book data block');
const end = afterStart + nextConst.index;
reader = reader.slice(0, start) + replacement + reader.slice(end);
if (!reader.includes('"no": 46')) throw new Error('Failed to apply the modified 46-chapter book');
fs.writeFileSync(readerPath, reader);
console.log('Modified 46-chapter book applied successfully.');
