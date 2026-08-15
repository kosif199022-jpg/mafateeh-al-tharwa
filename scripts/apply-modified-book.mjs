import fs from 'node:fs';
import zlib from 'node:zlib';

const payloadFiles = [
  ...Array.from({ length: 10 }, (_, i) => `scripts/book-payload/part${String(i + 1).padStart(2, '0')}.txt`),
  'scripts/book-payload/part11a.txt',
  'scripts/book-payload/part11b.txt',
  'scripts/book-payload/part12.txt',
];

const encoded = payloadFiles.map((file) => fs.readFileSync(file, 'utf8').trim()).join('');
if (encoded.length !== 123436) {
  throw new Error(`Modified book payload length mismatch: ${encoded.length}`);
}

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
