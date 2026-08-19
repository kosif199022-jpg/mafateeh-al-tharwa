import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
const must=(ok,msg)=>{if(!ok)throw new Error(msg)};

// v35: unify scrolling for every bottom sheet, including legacy tool-sheet/card studio.
{
  const p='public/reader-master-fixes.js';
  let s=read(p);
  s=s.replace("const VERSION='34.0.0';","const VERSION='35.0.0';")
     .replaceAll('mafateeh-audiobook-master-v34','mafateeh-audiobook-master-v35')
     .replaceAll('?v=34','?v=35')
     .replace("const UI_PREF_KEY='mafateehMasterUiV34';","const UI_PREF_KEY='mafateehMasterUiV35';");

  // Make tool sheets first-class scroll surfaces.
  s=s.replace('.smart-sheet,.smart-body,.smart-pane,.mixer-sheet,.mixer-body,.amb-sheet,.studio-sheet,',
              '.smart-sheet,.smart-body,.smart-pane,.mixer-sheet,.mixer-body,.amb-sheet,.studio-sheet,.tool-sheet,.track-list,.clip-quote,');
  s=s.replace("'.smart-sheet','.smart-body','.smart-pane.on','.mixer-sheet','.mixer-body','.amb-sheet','.studio-sheet',",
              "'.smart-sheet','.smart-body','.smart-pane.on','.mixer-sheet','.mixer-body','.amb-sheet','.studio-sheet','.tool-sheet','.track-list','.clip-quote',");

  const oldFn=`function scrollableAncestor(el){\n  for(let node=el;node&&node!==document.body;node=node.parentElement){\n    const st=getComputedStyle(node),oy=st.overflowY;\n    if(/(auto|scroll)/.test(oy)&&node.scrollHeight>node.clientHeight+1)return node;\n  }\n  return null;\n}`;
  const newFn=`function scrollableAncestor(el){\n  let fallback=null;\n  for(let node=el;node&&node!==document.body;node=node.parentElement){\n    const st=getComputedStyle(node),oy=st.overflowY;\n    if(!/(auto|scroll)/.test(oy)||node.scrollHeight<=node.clientHeight+1)continue;\n    // iOS traps a swipe inside textarea/select/input; prefer the parent sheet instead.\n    if(node.matches?.('textarea,input,select,[contenteditable="true"]'))continue;\n    if(!fallback)fallback=node;\n    if(node.matches?.('.tool-sheet,.track-list,.clip-quote,.smart-body,.smart-chat,.mixer-body,.mixer-sheet,.studio-sheet,.amb-sheet,.note-sheet,.journal-sheet,.media-sheet,.install-sheet,#drawer .dlist,#prefs,#search,#sres'))return node;\n  }\n  return fallback;\n}`;
  must(s.includes(oldFn),'scrollableAncestor anchor missing');
  s=s.replace(oldFn,newFn);

  s=s.replace("const list=['.smart-shade.on .smart-body','#smartBookShade.on .smart-body','.mixer-shade.on .mixer-sheet','.studio-shade.on .studio-sheet','.amb-shade.on .amb-sheet','.media-shade.on .media-sheet','.journal-shade.on .journal-sheet','.note-shade.on .note-sheet','.install-shade.on .install-sheet','#drawer.on .dlist','#prefs.on','#search.on #sres'];",
              "const list=['.tool-shade.on .tool-sheet','#cardShade.on #cardSheet','#exportShade.on #exportSheet','#attachmentShade.on #attachmentSheet','.smart-shade.on .smart-body','#smartBookShade.on .smart-body','.mixer-shade.on .mixer-sheet','.studio-shade.on .studio-sheet','.amb-shade.on .amb-sheet','.media-shade.on .media-sheet','.journal-shade.on .journal-sheet','.note-shade.on .note-sheet','.install-shade.on .install-sheet','#drawer.on .dlist','#prefs.on','#search.on #sres'];");

  write(p,s);
}

// Explicit Safari layout for all legacy tool sheets and the quote-card studio.
{
  const p='public/reader-tools.css';
  let s=read(p);
  if(!s.includes('Master v35 — unified iPhone tool-sheet scrolling')){
    s+=`\n/* Master v35 — unified iPhone tool-sheet scrolling */\n.tool-shade.on{overflow:hidden!important;touch-action:pan-y!important}\n.tool-sheet{box-sizing:border-box!important;height:min(92dvh,calc(var(--mk-vvh,100dvh) - 8px))!important;max-height:min(92dvh,calc(var(--mk-vvh,100dvh) - 8px))!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior-y:contain!important;touch-action:pan-y!important;scrollbar-gutter:stable}\n.tool-sheet .card-controls,.tool-sheet .card-stage,.tool-sheet .tool-section{min-height:0}\n#cardText{max-height:34dvh;overscroll-behavior:contain}\n@supports(-webkit-touch-callout:none){.tool-sheet{height:calc(var(--mk-vvh,100dvh) - 8px)!important;max-height:calc(var(--mk-vvh,100dvh) - 8px)!important;border-radius:26px 26px 0 0}.tool-sheet>*{touch-action:pan-y}.tool-sheet textarea,.tool-sheet input,.tool-sheet select,.tool-sheet button,.tool-sheet canvas{touch-action:manipulation}}\n`;
  }
  write(p,s);
}

// Carry v35 through every reader/PWA entry point after v34 has produced its build tree.
for(const p of ['public/reader.html','public/sw.js','public/manifest.webmanifest','public/reader-smart-suite.js','public/reader-smart-suite.css','public/reader-mixer.js','public/reader-mixer.css','public/reader-tools.js','public/reader-ambience.js','public/reader-studio.js','public/reader-studio.css']){
  if(!fs.existsSync(p))continue;
  let s=read(p).replaceAll('?v=34','?v=35').replaceAll('master-v34','master-v35');
  if(p.endsWith('manifest.webmanifest'))s=s.replace('"start_url": "/reader.html?v=34"','"start_url": "/reader.html?v=35"');
  write(p,s);
}

{
  const p='public/master-version.json';
  const j=JSON.parse(read(p));
  j.version='35.0.0';
  j.sourceBase='V13 + Smart Suite + Mixer Pro + modified 46-chapter book + Master v35 unified iPhone scrolling for every modal/tool sheet';
  write(p,JSON.stringify(j)+'\n');
}

console.log('Master v35 unified iPhone/tool-sheet scrolling fixes applied.');

// v36 audiobook builder is intentionally chained here so every workflow that
// builds the canonical v35 reader also gets the in-app Gemini/R2 audio feature.
await import('./apply-v36-audiobook-builder.mjs');

// The actual audio modal uses #audioShade/#audioSheet, not the older media aliases.
// Apply the iPhone-specific scroller fix after the v36 builder has patched reader.html.
await import('./apply-v36-audio-sheet-scroll-fix.mjs');
