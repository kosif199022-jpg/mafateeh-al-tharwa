import { readFile, writeFile } from 'node:fs/promises';

const must = (ok, message) => { if (!ok) throw new Error(message); };
const read = (p) => readFile(p, 'utf8');
const write = (p, s) => writeFile(p, s);

// The real audiobook modal uses #audioShade / #audioSheet. On iPhone Safari,
// making the entire fixed overlay (#audioShade) the scroll surface is more
// reliable than trying to scroll the nested sheet while the page is locked.
{
  const p = 'public/reader-master-fixes.js';
  let s = await read(p);

  const replacements = [
    ["'.note-shade.on','.journal-shade.on','.media-shade.on',", "'.note-shade.on','.journal-shade.on','.media-shade.on','#audioShade.on',"],
    ["'#drawer .dlist','#prefs','#search','#sres','.note-sheet','.journal-sheet','.media-sheet','.install-sheet',", "'#drawer .dlist','#prefs','#search','#sres','.note-sheet','.journal-sheet','.media-sheet','#audioShade','.install-sheet',"],
    ['#drawer .dlist,#prefs,#search,#sres,.note-sheet,.journal-sheet,.media-sheet,.install-sheet,', '#drawer .dlist,#prefs,#search,#sres,.note-sheet,.journal-sheet,.media-sheet,#audioShade,.install-sheet,'],
    ["'.amb-shade.on .amb-sheet','.media-shade.on .media-sheet','.journal-shade.on .journal-sheet',", "'.amb-shade.on .amb-sheet','#audioShade.on','.media-shade.on .media-sheet','.journal-shade.on .journal-sheet',"],
    ['.media-sheet,.install-sheet,#drawer .dlist', '.media-sheet,#audioShade,.install-sheet,#drawer .dlist']
  ];

  for (const [from, to] of replacements) {
    if (s.includes(to)) continue;
    must(s.includes(from), `Audio shade patch target missing in reader-master-fixes.js: ${from}`);
    s = s.replace(from, to);
  }

  if (!s.includes('Mafateeh audio shade hard lock v36')) {
    const anchor = "const audio=()=>$('#audioElement');";
    must(s.includes(anchor), 'Audio runtime anchor missing for hard background lock');
    const hardLock = `// Mafateeh audio shade hard lock v36.\nlet mkAudioHardLocked=false,mkAudioHardY=0,mkAudioHardSaved=null;\nfunction syncAudioHardLock(){\n  const shade=$('#audioShade'),open=!!(shade&&shade.classList.contains('on'));\n  const b=document.body,h=document.documentElement;\n  if(open&&!mkAudioHardLocked){\n    mkAudioHardLocked=true;\n    mkAudioHardY=window.scrollY||document.scrollingElement?.scrollTop||h.scrollTop||0;\n    mkAudioHardSaved={position:b.style.position,top:b.style.top,left:b.style.left,right:b.style.right,width:b.style.width,overflow:b.style.overflow,htmlOverflow:h.style.overflow};\n    b.style.position='fixed';b.style.top=\`-\${mkAudioHardY}px\`;b.style.left='0';b.style.right='0';b.style.width='100%';b.style.overflow='hidden';h.style.overflow='hidden';\n    b.classList.add('mk-audio-hard-lock');h.classList.add('mk-audio-hard-lock-root');\n    if(shade){shade.style.overflowY='auto';shade.style.webkitOverflowScrolling='touch';shade.style.touchAction='pan-y';shade.style.overscrollBehaviorY='contain'}\n  }else if(!open&&mkAudioHardLocked){\n    mkAudioHardLocked=false;\n    if(mkAudioHardSaved){b.style.position=mkAudioHardSaved.position;b.style.top=mkAudioHardSaved.top;b.style.left=mkAudioHardSaved.left;b.style.right=mkAudioHardSaved.right;b.style.width=mkAudioHardSaved.width;b.style.overflow=mkAudioHardSaved.overflow;h.style.overflow=mkAudioHardSaved.htmlOverflow;mkAudioHardSaved=null}\n    b.classList.remove('mk-audio-hard-lock');h.classList.remove('mk-audio-hard-lock-root');\n    const y=mkAudioHardY;requestAnimationFrame(()=>window.scrollTo({top:y,behavior:'instant'}));\n  }\n}\nconst mkAudioShadeNode=$('#audioShade');if(mkAudioShadeNode)new MutationObserver(syncAudioHardLock).observe(mkAudioShadeNode,{attributes:true,attributeFilter:['class','aria-hidden']});syncAudioHardLock();\n\n`;
    s = s.replace(anchor, hardLock + anchor);
  }

  await write(p, s);
}

// Scroll the fixed overlay itself. The nested sheet is deliberately overflow:visible,
// so all vertical swipes resolve to #audioShade instead of leaking to the book page.
{
  const p = 'public/reader.html';
  let s = await read(p);
  const oldStyle = /<style id="mkAudioSheetScrollV36">[\s\S]*?<\/style>\n?/;
  const css = `<style id="mkAudioSheetScrollV36">\n#audioShade.on{display:block!important;position:fixed!important;inset:0!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior-y:contain!important;touch-action:pan-y!important;padding-top:max(48px,env(safe-area-inset-top))!important}\n#audioSheet{box-sizing:border-box!important;width:min(620px,100%)!important;height:auto!important;max-height:none!important;min-height:calc(var(--mk-vvh,100dvh) - 48px)!important;overflow:visible!important;touch-action:pan-y!important;margin:0 auto!important}\nbody.mk-audio-hard-lock{position:fixed!important;width:100%!important;overflow:hidden!important}\nhtml.mk-audio-hard-lock-root{overflow:hidden!important;overscroll-behavior:none!important}\n@supports(-webkit-touch-callout:none){#audioShade.on{padding-top:max(8px,env(safe-area-inset-top))!important}#audioSheet{min-height:calc(var(--mk-vvh,100dvh) - 8px)!important;padding-bottom:calc(34px + env(safe-area-inset-bottom))!important}}\n</style>\n`;
  if (oldStyle.test(s)) s = s.replace(oldStyle, css);
  else { must(s.includes('</head>'), 'reader.html head closing tag missing'); s = s.replace('</head>', `${css}</head>`); }
  await write(p, s);
}

// Force installed PWAs/Safari caches to discard all earlier audio-scroll attempts.
{
  const p = 'public/sw.js';
  let s = await read(p);
  s = s
    .replace(/const CACHE_NAME = "[^"]+";/, 'const CACHE_NAME = "mafateeh-al-tharwa-v35-audio-scroll-3";')
    .replace(/const RUNTIME_CACHE = "[^"]+";/, 'const RUNTIME_CACHE = "mafateeh-runtime-v35-audio-scroll-3";')
    .replace(/const EXTERNAL_RUNTIME_CACHE = "[^"]+";/, 'const EXTERNAL_RUNTIME_CACHE = "mafateeh-external-runtime-v35-audio-scroll-3";');
  await write(p, s);
}

console.log('Applied v36 iPhone audio overlay scrolling + hard background lock.');
