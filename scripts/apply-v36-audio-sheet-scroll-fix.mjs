import { readFile, writeFile } from 'node:fs/promises';

const must = (ok, message) => { if (!ok) throw new Error(message); };
const read = (p) => readFile(p, 'utf8');
const write = (p, s) => writeFile(p, s);

// The real audiobook modal uses #audioShade / #audioSheet. Older master fixes
// only knew the legacy .media-shade / .media-sheet aliases, so iOS could miss
// the correct primary scroller and route vertical swipes to the page behind it.
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

  // Safari can still scroll the document behind a fixed overlay even when the
  // sheet itself is scrollable. Hard-lock only the audiobook overlay by fixing
  // the body at its current scroll position. Do NOT set touch-action:none on
  // body, because that would also disable #audioSheet gestures.
  if (!s.includes('Mafateeh audio hard background lock v36')) {
    const anchor = "const audio=()=>$('#audioElement');";
    must(s.includes(anchor), 'Audio runtime anchor missing for hard background lock');
    const hardLock = `// Mafateeh audio hard background lock v36.\nlet mkAudioHardLocked=false,mkAudioHardY=0,mkAudioHardSaved=null;\nfunction syncAudioHardLock(){\n  const shade=$('#audioShade'),open=!!(shade&&shade.classList.contains('on'));\n  const b=document.body;\n  if(open&&!mkAudioHardLocked){\n    mkAudioHardLocked=true;\n    mkAudioHardY=window.scrollY||document.scrollingElement?.scrollTop||document.documentElement.scrollTop||0;\n    mkAudioHardSaved={position:b.style.position,top:b.style.top,left:b.style.left,right:b.style.right,width:b.style.width,overflow:b.style.overflow};\n    b.style.position='fixed';b.style.top=\`-\${mkAudioHardY}px\`;b.style.left='0';b.style.right='0';b.style.width='100%';b.style.overflow='hidden';\n    b.classList.add('mk-audio-hard-lock');\n    if(shade){shade.style.touchAction='pan-y';shade.style.overscrollBehavior='none'}\n    const sheet=$('#audioSheet');if(sheet){sheet.style.overflowY='auto';sheet.style.webkitOverflowScrolling='touch';sheet.style.touchAction='pan-y'}\n  }else if(!open&&mkAudioHardLocked){\n    mkAudioHardLocked=false;\n    if(mkAudioHardSaved){b.style.position=mkAudioHardSaved.position;b.style.top=mkAudioHardSaved.top;b.style.left=mkAudioHardSaved.left;b.style.right=mkAudioHardSaved.right;b.style.width=mkAudioHardSaved.width;b.style.overflow=mkAudioHardSaved.overflow;mkAudioHardSaved=null}\n    b.classList.remove('mk-audio-hard-lock');\n    const y=mkAudioHardY;requestAnimationFrame(()=>window.scrollTo({top:y,behavior:'instant'}));\n  }\n}\nconst mkAudioShadeNode=$('#audioShade');if(mkAudioShadeNode)new MutationObserver(syncAudioHardLock).observe(mkAudioShadeNode,{attributes:true,attributeFilter:['class','aria-hidden']});syncAudioHardLock();\n\n`;
    s = s.replace(anchor, hardLock + anchor);
  }

  await write(p, s);
}

// Give the actual audio sheet an explicit iOS scrolling contract. The body is
// fixed by the runtime above, while this sheet remains the only vertical scroll surface.
{
  const p = 'public/reader.html';
  let s = await read(p);
  if (!s.includes('id="mkAudioSheetScrollV36"')) {
    const css = `<style id="mkAudioSheetScrollV36">\n#مافاتيح-audio-scroll-marker{display:none}\n#audioShade.on{position:fixed!important;inset:0!important;overflow:hidden!important;touch-action:pan-y!important;overscroll-behavior:none!important}\n#audioSheet{box-sizing:border-box!important;height:min(92dvh,calc(var(--mk-vvh,100dvh) - 8px))!important;max-height:min(92dvh,calc(var(--mk-vvh,100dvh) - 8px))!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior-y:contain!important;touch-action:pan-y!important;scrollbar-gutter:stable}\nbody.mk-audio-hard-lock{position:fixed!important;width:100%!important;overflow:hidden!important}\n@supports(-webkit-touch-callout:none){#audioSheet{height:calc(var(--mk-vvh,100dvh) - 8px)!important;max-height:calc(var(--mk-vvh,100dvh) - 8px)!important;padding-bottom:calc(28px + env(safe-area-inset-bottom))!important}}\n</style>\n`;
    must(s.includes('</head>'), 'reader.html head closing tag missing');
    s = s.replace('</head>', `${css}</head>`);
  }
  await write(p, s);
}

// Force installed PWAs to discard the previous audio-scroll runtime cache.
{
  const p = 'public/sw.js';
  let s = await read(p);
  s = s
    .replace(/const CACHE_NAME = "[^"]+";/, 'const CACHE_NAME = "mafateeh-al-tharwa-v35-audio-scroll-2";')
    .replace(/const RUNTIME_CACHE = "[^"]+";/, 'const RUNTIME_CACHE = "mafateeh-runtime-v35-audio-scroll-2";')
    .replace(/const EXTERNAL_RUNTIME_CACHE = "[^"]+";/, 'const EXTERNAL_RUNTIME_CACHE = "mafateeh-external-runtime-v35-audio-scroll-2";');
  await write(p, s);
}

console.log('Applied v36 iPhone audio-sheet hard background lock and scrolling fix.');
