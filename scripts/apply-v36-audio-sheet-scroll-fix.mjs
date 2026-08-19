import { readFile, writeFile } from 'node:fs/promises';

const must = (ok, message) => { if (!ok) throw new Error(message); };
const read = (p) => readFile(p, 'utf8');
const write = (p, s) => writeFile(p, s);

// The real audiobook modal uses #audioShade / #audioSheet. Older master fixes
// only knew the legacy .media-shade / .media-sheet aliases, so iOS could miss
// the correct primary scroller and swallow vertical swipes.
{
  const p = 'public/reader-master-fixes.js';
  let s = await read(p);

  const replacements = [
    [
      "'.note-shade.on','.journal-shade.on','.media-shade.on',",
      "'.note-shade.on','.journal-shade.on','.media-shade.on','#audioShade.on',"
    ],
    [
      "'#drawer .dlist','#prefs','#search','#sres','.note-sheet','.journal-sheet','.media-sheet','.install-sheet',",
      "'#drawer .dlist','#prefs','#search','#sres','.note-sheet','.journal-sheet','.media-sheet','#audioSheet','.install-sheet',"
    ],
    [
      '#drawer .dlist,#prefs,#search,#sres,.note-sheet,.journal-sheet,.media-sheet,.install-sheet,',
      '#drawer .dlist,#prefs,#search,#sres,.note-sheet,.journal-sheet,.media-sheet,#audioSheet,.install-sheet,'
    ],
    [
      '.smart-sheet,.mixer-sheet,.media-sheet,.journal-sheet,.note-sheet,.install-sheet{max-height:',
      '.smart-sheet,.mixer-sheet,.media-sheet,#audioSheet,.journal-sheet,.note-sheet,.install-sheet{max-height:'
    ],
    [
      "'.amb-shade.on .amb-sheet','.media-shade.on .media-sheet','.journal-shade.on .journal-sheet',",
      "'.amb-shade.on .amb-sheet','#audioShade.on #audioSheet','.media-shade.on .media-sheet','.journal-shade.on .journal-sheet',"
    ],
    [
      '.media-sheet,.install-sheet,#drawer .dlist',
      '.media-sheet,#audioSheet,.install-sheet,#drawer .dlist'
    ]
  ];

  for (const [from, to] of replacements) {
    if (s.includes(to)) continue;
    must(s.includes(from), `Audio scroll patch target missing in reader-master-fixes.js: ${from}`);
    s = s.replace(from, to);
  }

  await write(p, s);
}

// Give the actual audio sheet an explicit iOS scrolling contract. This keeps
// the background fixed while the sheet itself remains a native vertical scroll surface.
{
  const p = 'public/reader.html';
  let s = await read(p);
  if (!s.includes('id="mkAudioSheetScrollV36"')) {
    const css = `<style id="mkAudioSheetScrollV36">\n#مافاتيح-audio-scroll-marker{display:none}\n#audioShade.on{overflow:hidden!important;touch-action:pan-y!important;overscroll-behavior:none!important}\n#audioSheet{box-sizing:border-box!important;height:min(92dvh,calc(var(--mk-vvh,100dvh) - 8px))!important;max-height:min(92dvh,calc(var(--mk-vvh,100dvh) - 8px))!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior-y:contain!important;touch-action:pan-y!important;scrollbar-gutter:stable}\n@supports(-webkit-touch-callout:none){#audioSheet{height:calc(var(--mk-vvh,100dvh) - 8px)!important;max-height:calc(var(--mk-vvh,100dvh) - 8px)!important;padding-bottom:calc(28px + env(safe-area-inset-bottom))!important}}\n</style>\n`;
    must(s.includes('</head>'), 'reader.html head closing tag missing');
    s = s.replace('</head>', `${css}</head>`);
  }
  await write(p, s);
}

// Force installed PWAs to discard the old runtime cache even though the public
// v35 asset query remains compatible with the deployment smoke tests.
{
  const p = 'public/sw.js';
  let s = await read(p);
  s = s
    .replace(/const CACHE_NAME = "[^"]+";/, 'const CACHE_NAME = "mafateeh-al-tharwa-v35-audio-scroll-1";')
    .replace(/const RUNTIME_CACHE = "[^"]+";/, 'const RUNTIME_CACHE = "mafateeh-runtime-v35-audio-scroll-1";')
    .replace(/const EXTERNAL_RUNTIME_CACHE = "[^"]+";/, 'const EXTERNAL_RUNTIME_CACHE = "mafateeh-external-runtime-v35-audio-scroll-1";');
  await write(p, s);
}

console.log('Applied v36 iPhone audio-sheet scrolling fix and PWA cache bust.');
