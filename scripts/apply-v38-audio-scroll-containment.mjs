import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);
const must = (ok, msg) => { if (!ok) throw new Error(msg); };
const buildId = String(process.env.GITHUB_SHA || 'v38-local').replace(/[^a-zA-Z0-9._-]/g, '-');

// v38 keeps the user-stable native-scroll architecture and fixes only the
// proven failure mode: scroll chaining from #audioSheet to the document.
{
  const p = 'public/reader.html';
  let s = read(p);

  // Remove any previous v38 injection so this script is idempotent.
  s = s.replace(/\n?<style id="mkAudioContainV38">[\s\S]*?<\/style>/g, '');
  s = s.replace(/\n?<script id="mkAudioLegacyContainV38">[\s\S]*?<\/script>/g, '');
  s = s.replace(/\n?<meta name="mafateeh-build" content="[^"]*">/g, '');

  const css = `<style id="mkAudioContainV38">\n/* v38: #audioSheet is the single native scroll owner. */\n#audioShade{overflow:hidden!important;touch-action:none!important}\n#audioSheet{overflow-x:hidden!important;overflow-y:auto!important;overscroll-behavior-y:contain!important;-webkit-overflow-scrolling:touch!important;touch-action:pan-y!important}\n</style>\n`;

  const legacy = `<script id="mkAudioLegacyContainV38">\n(()=>{\n  const supports=!!(window.CSS&&CSS.supports&&CSS.supports('overscroll-behavior-y','contain'));\n  if(supports)return;\n  const shade=document.getElementById('audioShade');\n  const sheet=document.getElementById('audioSheet');\n  if(!shade||!sheet)return;\n  let lastY=0;\n  sheet.addEventListener('touchstart',e=>{if(e.touches&&e.touches.length===1)lastY=e.touches[0].clientY},{passive:true});\n  sheet.addEventListener('touchmove',e=>{\n    if(!e.touches||e.touches.length!==1)return;\n    const y=e.touches[0].clientY,dy=y-lastY;\n    const atTop=sheet.scrollTop<=0;\n    const atBottom=Math.ceil(sheet.scrollTop+sheet.clientHeight)>=sheet.scrollHeight;\n    if((atTop&&dy>0)||(atBottom&&dy<0)){e.preventDefault();e.stopPropagation()}\n    lastY=y;\n  },{passive:false});\n  shade.addEventListener('touchmove',e=>{if(e.target===shade)e.preventDefault()},{passive:false});\n})();\n</script>\n`;

  must(s.includes('</head>'), 'reader.html head closing tag missing');
  must(s.includes('</body>'), 'reader.html body closing tag missing');
  s = s.replace('</head>', `<meta name="mafateeh-build" content="${buildId}">\n${css}</head>`);
  s = s.replace('</body>', `${legacy}</body>`);

  // One clear cache/version generation for all reader modules.
  s = s.replaceAll('?v=37', '?v=38');

  must(s.includes('overscroll-behavior-y:contain!important'), 'Audio scroll chaining containment missing');
  must(s.includes('#audioShade{overflow:hidden!important;touch-action:none!important}'), 'Audio backdrop isolation missing');
  must(s.includes('#audioSheet{overflow-x:hidden!important;overflow-y:auto!important'), 'Audio sheet native scroll contract missing');
  must(!s.includes('reader-audio-touch-guard.js'), 'Old global audio touch guard must remain removed');
  must(!s.includes('reader-master-fixes.js'), 'Old global master touch runtime must remain removed');
  write(p, s);
}

// Build-specific service-worker caches prevent mixed old/new PWA assets.
{
  const p = 'public/sw.js';
  let s = read(p);
  s = s
    .replace(/const CACHE_NAME = "[^"]+";/, `const CACHE_NAME = "mafateeh-v38-${buildId}";`)
    .replace(/const RUNTIME_CACHE = "[^"]+";/, `const RUNTIME_CACHE = "mafateeh-runtime-v38-${buildId}";`)
    .replace(/const EXTERNAL_RUNTIME_CACHE = "[^"]+";/, `const EXTERNAL_RUNTIME_CACHE = "mafateeh-external-runtime-v38-${buildId}";`)
    .replaceAll('?v=37', '?v=38');
  write(p, s);
}

{
  const p = 'public/manifest.webmanifest';
  let s = read(p).replace(/"start_url"\s*:\s*"\/reader\.html\?v=\d+"/, '"start_url": "/reader.html?v=38"');
  write(p, s);
}

{
  const p = 'public/master-version.json';
  const j = fs.existsSync(p) ? JSON.parse(read(p)) : {};
  j.name = 'Mafateeh Al-Tharwa Stable Reader';
  j.version = '38.0.0';
  j.buildId = buildId;
  j.audioChapters = 46;
  j.sourceBase = 'User stable Reader v12 native scrolling + v38 scroll-chain containment + modified 46-chapter book + Gemini mixed audiobook/R2';
  write(p, JSON.stringify(j) + '\n');
}

console.log(`Applied v38 audio scroll containment. build=${buildId}`);
