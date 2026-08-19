import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
const must=(ok,msg)=>{if(!ok)throw new Error(msg)};

// v37 is based on the user-provided stable Reader v12 behavior:
// browser-native scrolling, no document-level touch interception, and the
// audiobook panel itself (#audioSheet) is a normal overflow:auto bottom sheet.
{
  const p='public/reader.html';
  let s=read(p);

  // Remove every later global scroll/touch runtime. Those layers were not in
  // the stable reader and can steal iPhone gestures from the modal.
  s=s.replace(/\n?<script[^>]*reader-master-fixes\.js[^>]*><\/script>/g,'');
  s=s.replace(/\n?<script[^>]*reader-audio-touch-guard\.js[^>]*><\/script>/g,'');
  s=s.replace(/\n?<style id="mkAudioSheetScrollV36">[\s\S]*?<\/style>/g,'');

  // Restore the exact stable audiobook scrolling contract. Keep the sheet as
  // the native scroll owner; do not fix/lock body or hijack touchmove.
  s=s.replace(/#audioShade\{[^}]*\}/,
    '#audioShade{position:fixed;inset:0;z-index:122;background:rgba(8,14,28,.62);backdrop-filter:blur(6px);\n  display:none;align-items:flex-end;justify-content:center;padding-top:48px}');
  s=s.replace(/#audioShade\.on\{[^}]*\}/,'#audioShade.on{display:flex}');
  s=s.replace(/#audioSheet\{[^}]*\}/,
    '#audioSheet{width:min(620px,100%);max-height:92dvh;overflow:auto;background:var(--surf);color:var(--ink);\n  border-radius:28px 28px 0 0;padding:18px 22px calc(24px + env(safe-area-inset-bottom));\n  box-shadow:0 -26px 74px rgba(3,8,18,.34);animation:sheetUp .34s var(--ease)}');

  // Cache-bust the reader modules without changing their feature set.
  s=s.replaceAll('?v=31','?v=37').replaceAll('?v=32','?v=37').replaceAll('?v=33','?v=37').replaceAll('?v=34','?v=37').replaceAll('?v=35','?v=37').replaceAll('?v=36','?v=37');
  if(!s.includes('Mafateeh stable native-scroll architecture v37')){
    s=s.replace('</head>','<!-- Mafateeh stable native-scroll architecture v37 -->\n</head>');
  }

  must(s.includes('#audioShade.on{display:flex}'),'Stable audio shade display contract missing');
  must(s.includes('max-height:92dvh;overflow:auto'),'Stable audio sheet overflow contract missing');
  must(!s.includes('reader-master-fixes.js'),'Global master touch runtime still loaded');
  must(!s.includes('reader-audio-touch-guard.js'),'Audio touch guard still loaded');
  write(p,s);
}

// Restore simple native PWA caching. Do not cache or inject the removed touch runtime.
{
  const p='public/sw.js';
  let s=read(p);
  s=s.replace(/const CACHE_NAME = "[^"]+";/,'const CACHE_NAME = "mafateeh-al-tharwa-v37-stable-native";')
     .replace(/const RUNTIME_CACHE = "[^"]+";/,'const RUNTIME_CACHE = "mafateeh-runtime-v37-stable-native";')
     .replace(/const EXTERNAL_RUNTIME_CACHE = "[^"]+";/,'const EXTERNAL_RUNTIME_CACHE = "mafateeh-external-runtime-v37-stable-native";')
     .replaceAll('?v=31','?v=37').replaceAll('?v=32','?v=37').replaceAll('?v=33','?v=37').replaceAll('?v=34','?v=37').replaceAll('?v=35','?v=37').replaceAll('?v=36','?v=37');
  s=s.replace(/^\s*"\/reader-master-fixes\.js\?v=37",?\n?/m,'');
  s=s.replace(/^\s*"\/reader-audio-touch-guard\.js\?v=37",?\n?/m,'');
  write(p,s);
}

{
  const p='public/manifest.webmanifest';
  let s=read(p).replace(/"start_url"\s*:\s*"\/reader\.html\?v=\d+"/,'"start_url": "/reader.html?v=37"');
  write(p,s);
}

{
  const p='public/master-version.json';
  const j=fs.existsSync(p)?JSON.parse(read(p)):{};
  j.name='Mafateeh Al-Tharwa Stable Reader';
  j.version='37.0.0';
  j.audioChapters=46;
  j.sourceBase='User stable Reader v12 native scrolling + modified 46-chapter book + Gemini mixed audiobook/R2';
  write(p,JSON.stringify(j)+'\n');
}

console.log('Applied v37 stable native reader architecture.');
