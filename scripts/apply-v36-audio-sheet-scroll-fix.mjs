import { readFile, writeFile } from 'node:fs/promises';

const must = (ok, message) => { if (!ok) throw new Error(message); };
const read = (p) => readFile(p, 'utf8');
const write = (p, s) => writeFile(p, s);

// Register the real audio modal with the legacy master runtime as a fallback.
// The dedicated window-level touch guard below remains authoritative on mobile.
{
  const p = 'public/reader-master-fixes.js';
  let s = await read(p);
  const replacements = [
    ["'.note-shade.on','.journal-shade.on','.media-shade.on',", "'.note-shade.on','.journal-shade.on','.media-shade.on','#audioShade.on',"],
    ["'#drawer .dlist','#prefs','#search','#sres','.note-sheet','.journal-sheet','.media-sheet','.install-sheet',", "'#drawer .dlist','#prefs','#search','#sres','.note-sheet','.journal-sheet','.media-sheet','#audioSheet','.install-sheet',"],
    ['#drawer .dlist,#prefs,#search,#sres,.note-sheet,.journal-sheet,.media-sheet,.install-sheet,', '#drawer .dlist,#prefs,#search,#sres,.note-sheet,.journal-sheet,.media-sheet,#audioSheet,.install-sheet,'],
    ["'.amb-shade.on .amb-sheet','.media-shade.on .media-sheet','.journal-shade.on .journal-sheet',", "'.amb-shade.on .amb-sheet','#audioShade.on #audioSheet','.media-shade.on .media-sheet','.journal-shade.on .journal-sheet',"],
    ['.media-sheet,.install-sheet,#drawer .dlist', '.media-sheet,#audioSheet,.install-sheet,#drawer .dlist']
  ];
  for (const [from, to] of replacements) {
    if (s.includes(to)) continue;
    must(s.includes(from), `Audio modal patch target missing in reader-master-fixes.js: ${from}`);
    s = s.replace(from, to);
  }
  await write(p, s);
}

// Keep the overlay fixed and the sheet as the sole native/manual vertical scroll surface.
// The actual gesture ownership is handled by reader-audio-touch-guard.js at window capture.
{
  const p = 'public/reader.html';
  let s = await read(p);
  const oldStyle = /<style id="mkAudioSheetScrollV36">[\s\S]*?<\/style>\n?/;
  const css = `<style id="mkAudioSheetScrollV36">\n#audioShade.on{display:flex!important;position:fixed!important;inset:0!important;align-items:flex-end!important;justify-content:center!important;overflow:hidden!important;overscroll-behavior:none!important}\n#audioSheet{box-sizing:border-box!important;width:min(620px,100%)!important;height:min(92dvh,calc(var(--mk-vvh,100dvh) - 8px))!important;max-height:min(92dvh,calc(var(--mk-vvh,100dvh) - 8px))!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior-y:contain!important}\n@supports(-webkit-touch-callout:none){#audioSheet{height:calc(var(--mk-vvh,100dvh) - 8px)!important;max-height:calc(var(--mk-vvh,100dvh) - 8px)!important;padding-bottom:calc(34px + env(safe-area-inset-bottom))!important}}\n</style>\n`;
  if (oldStyle.test(s)) s = s.replace(oldStyle, css);
  else { must(s.includes('</head>'), 'reader.html head closing tag missing'); s = s.replace('</head>', `${css}</head>`); }

  if (!s.includes('reader-audio-touch-guard.js?v=36.4')) {
    const tag = '<script src="/reader-audio-touch-guard.js?v=36.4"></script>\n';
    must(s.includes('</body>'), 'reader.html body closing tag missing');
    s = s.replace('</body>', `${tag}</body>`);
  }
  await write(p, s);
}

// Force Safari/PWA to fetch the dedicated touch-guard build instead of any prior attempt.
{
  const p = 'public/sw.js';
  let s = await read(p);
  s = s
    .replace(/const CACHE_NAME = "[^"]+";/, 'const CACHE_NAME = "mafateeh-al-tharwa-v35-audio-touch-guard-4";')
    .replace(/const RUNTIME_CACHE = "[^"]+";/, 'const RUNTIME_CACHE = "mafateeh-runtime-v35-audio-touch-guard-4";')
    .replace(/const EXTERNAL_RUNTIME_CACHE = "[^"]+";/, 'const EXTERNAL_RUNTIME_CACHE = "mafateeh-external-runtime-v35-audio-touch-guard-4";');
  if (!s.includes('"/reader-audio-touch-guard.js?v=36.4"')) {
    const anchor='  "/reader-master-fixes.js?v=35",';
    if (s.includes(anchor)) s=s.replace(anchor, `${anchor}\n  "/reader-audio-touch-guard.js?v=36.4",`);
  }
  await write(p, s);
}

console.log('Applied v36.4 dedicated mobile audio touch guard.');
