import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
const must=(ok,msg)=>{if(!ok)throw new Error(msg)};
const buildId=String(process.env.MAFATEEH_BUILD_ID||process.env.GITHUB_SHA||'local-v38')
  .replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,16);
const assetQuery=`v=38&b=${buildId}`;

// v38 follows the user-provided stable Reader v12 architecture:
// core reader + reader-tools + reader-ambience only, with the audio sheet as
// the sole vertical scroll owner. No document/window touchmove interception.
{
  const p='public/reader.html';
  let s=read(p);

  const scriptNames=['reader-formats','reader-studio','reader-mixer','reader-smart-suite','reader-master-fixes','reader-audio-touch-guard'];
  const styleNames=['reader-studio','reader-mixer','reader-smart-suite'];
  for(const name of scriptNames)s=s.replace(new RegExp(`<script[^>]*\\/${name}\\.js[^>]*><\\/script>\\s*`,'g'),'');
  for(const name of styleNames)s=s.replace(new RegExp(`<link[^>]*href=["']\\/${name}\\.css[^"']*["'][^>]*>\\s*`,'g'),'');
  s=s.replace(/<style id="mkAudioSheetScrollV36">[\s\S]*?<\/style>\s*/g,'');
  s=s.replace(/<style id="mkMobileCompatV38">[\s\S]*?<\/style>\s*/g,'');
  s=s.replace(/<script[^>]*reader-audiobook-builder\.js[^>]*><\/script>\s*/g,'');

  // Keep the stable bottom-sheet layout, but add viewport fallbacks that work
  // on older iOS Safari/PWA builds where dvh/svh may be unsupported.
  s=s.replace(/#audioShade\{[^}]*\}/,`#audioShade{position:fixed;inset:0;z-index:122;background:rgba(8,14,28,.62);backdrop-filter:blur(6px);
  display:none;align-items:flex-end;justify-content:center;padding-top:48px;overflow:hidden}`);
  s=s.replace(/#audioShade\.on\{[^}]*\}/,'#audioShade.on{display:flex}');
  s=s.replace(/#audioSheet\{[^}]*\}/,`#audioSheet{width:min(620px,100%);max-width:100%;min-height:0;max-height:92vh;max-height:92dvh;
  overflow-x:hidden;overflow-y:auto;overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;
  background:var(--surf);color:var(--ink);border-radius:28px 28px 0 0;
  padding:18px 22px calc(24px + env(safe-area-inset-bottom));box-shadow:0 -26px 74px rgba(3,8,18,.34);animation:sheetUp .34s var(--ease)}`);

  const compat=`<style id="mkMobileCompatV38">
/* Mobile viewport and native overflow fallbacks. */
html[data-platform=ios] body{min-height:100vh;min-height:100dvh}
#hero{min-height:100vh;min-height:100svh}
#prefs{max-block-size:min(76vh,660px);max-block-size:min(76dvh,660px);-webkit-overflow-scrolling:touch}
#installShade{overflow:hidden}
#installSheet{min-height:0;max-height:90vh;max-height:90dvh;overflow-x:hidden;overflow-y:auto;overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y}
#audioShade{overflow:hidden}
#audioSheet{min-height:0;max-height:92vh;max-height:92dvh;overflow-x:hidden;overflow-y:auto;overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y}
</style>\n`;
  must(s.includes('</head>'),'reader head closing tag missing');
  s=s.replace('</head>',`${compat}</head>`);

  const mediaAnchor="function mediaOpen(mode,selected='')";
  must(s.includes(mediaAnchor),'mediaOpen anchor missing');
  if(!s.includes('Mafateeh audio modal isolation v38')){
    const helper=`/* Mafateeh audio modal isolation v38 */
let mediaPageLocked=false,mediaPageY=0,mediaPageSaved=null,mediaRootSaved=null;
function mediaPrimeScrollBoundary(){
  const sheet=$('#audioSheet');if(!sheet)return;
  const max=Math.max(0,sheet.scrollHeight-sheet.clientHeight);
  if(max>2){
    if(sheet.scrollTop<=0)sheet.scrollTop=1;
    else if(sheet.scrollTop>=max)sheet.scrollTop=max-1;
  }
}
function mediaLockPage(){
  if(mediaPageLocked)return;mediaPageLocked=true;
  const root=document.documentElement,b=document.body;
  mediaPageY=window.scrollY||root.scrollTop||0;
  mediaPageSaved={position:b.style.position,top:b.style.top,left:b.style.left,right:b.style.right,width:b.style.width,overflow:b.style.overflow};
  mediaRootSaved={overflow:root.style.overflow,overscrollBehavior:root.style.overscrollBehavior};
  root.style.overflow='hidden';root.style.overscrollBehavior='none';
  b.style.position='fixed';b.style.top=\`-\${mediaPageY}px\`;b.style.left='0';b.style.right='0';b.style.width='100%';b.style.overflow='hidden';
  b.classList.add('audio-modal-open');requestAnimationFrame(mediaPrimeScrollBoundary);
}
function mediaUnlockPage(){
  if(!mediaPageLocked)return;mediaPageLocked=false;
  const root=document.documentElement,b=document.body;
  if(mediaPageSaved){b.style.position=mediaPageSaved.position;b.style.top=mediaPageSaved.top;b.style.left=mediaPageSaved.left;b.style.right=mediaPageSaved.right;b.style.width=mediaPageSaved.width;b.style.overflow=mediaPageSaved.overflow;mediaPageSaved=null;}
  if(mediaRootSaved){root.style.overflow=mediaRootSaved.overflow;root.style.overscrollBehavior=mediaRootSaved.overscrollBehavior;mediaRootSaved=null;}
  b.classList.remove('audio-modal-open');const y=mediaPageY;requestAnimationFrame(()=>window.scrollTo(0,y));
}
const mediaNativeSheet=$('#audioSheet');
const mediaShadeNode=document.getElementById('audioShade');
mediaNativeSheet?.addEventListener('touchstart',mediaPrimeScrollBoundary,{passive:true});
mediaShadeNode?.addEventListener('touchmove',e=>{if(e.target===mediaShadeNode)e.preventDefault();},{passive:false});
addEventListener('pagehide',mediaUnlockPage);
`;
    s=s.replace(mediaAnchor,helper+mediaAnchor);
  }

  const oldOpen=/function mediaOpen\(mode,selected=''\)\{[^\n]*\}/;
  const open=s.match(oldOpen)?.[0];
  must(open,'Cannot locate one-line mediaOpen');
  if(!open.includes('mediaLockPage()')){
    s=s.replace(oldOpen,open.replace("mediaShade.classList.add('on');mediaShade.setAttribute('aria-hidden','false');","mediaShade.classList.add('on');mediaShade.setAttribute('aria-hidden','false');mediaLockPage();"));
  }

  const oldClose=/function mediaClose\(\)\{[^\n]*\}/;
  const close=s.match(oldClose)?.[0];
  must(close,'Cannot locate one-line mediaClose');
  if(!close.includes('mediaUnlockPage()')){
    s=s.replace(oldClose,close.replace("mediaShade.classList.remove('on');mediaShade.setAttribute('aria-hidden','true');","mediaShade.classList.remove('on');mediaShade.setAttribute('aria-hidden','true');mediaUnlockPage();"));
  }

  // Give every locally loaded reader asset a build-specific URL so an installed
  // iPhone PWA cannot serve a previous v38 asset from Cache Storage/HTTP cache.
  const localAssets=['reader-tools.css','reader-ambience.css','reader-tools.js','reader-ambience.js','piper-worker.js'];
  for(const asset of localAssets){
    s=s.replace(new RegExp(`/${asset.replace('.','\\.')}\\?v=\\d+(?:&b=[^"'\\s]+)?`,'g'),`/${asset}?${assetQuery}`);
  }
  s=s.replace(/<link rel="manifest" href="\/manifest\.webmanifest(?:\?[^"']*)?">/,`<link rel="manifest" href="/manifest.webmanifest?${assetQuery}">`);
  s=s.replace(/navigator\.serviceWorker\.register\("\/sw\.js(?:\?[^"']*)?"\)/,`navigator.serviceWorker.register("/sw.js?${assetQuery}")`);

  s=s.replace(/<!-- Mafateeh stable native-scroll architecture v\d+ -->\s*/g,'');
  s=s.replace(/<!-- Mafateeh stable Reader v12 architecture \+ isolated audio scroll v38 -->\s*/g,'');
  s=s.replace('</head>',`<!-- Mafateeh stable Reader v12 architecture + isolated audio scroll v38 -->\n</head>`);

  must(/"no"\s*:\s*46/.test(s),'Modified chapter 46 missing');
  must(s.includes('Mafateeh audio modal isolation v38'),'v38 audio isolation missing');
  must(s.includes('max-height:92vh;max-height:92dvh'),'audio viewport fallback missing');
  must(s.includes('-webkit-overflow-scrolling:touch'),'iOS native momentum scrolling missing');
  must(!s.includes("mediaNativeSheet?.addEventListener('touchmove'"),'audio sheet must not intercept touchmove');
  must(!/#audioShade\{[^}]*touch-action:none/s.test(s),'audio shade must not disable child panning');
  for(const name of scriptNames)must(!s.includes(`/${name}.js`),`non-stable module still loaded: ${name}`);
  for(const name of styleNames)must(!s.includes(`/${name}.css`),`non-stable stylesheet still loaded: ${name}`);
  write(p,s);
}

// Unique build-scoped caches eliminate mixed/stale PWA assets between deploys.
{
  const p='public/sw.js';let s=read(p);
  s=s.replace(/const CACHE_NAME = "[^"]+";/,`const CACHE_NAME = "mafateeh-v38-${buildId}";`)
     .replace(/const RUNTIME_CACHE = "[^"]+";/,`const RUNTIME_CACHE = "mafateeh-runtime-v38-${buildId}";`)
     .replace(/const EXTERNAL_RUNTIME_CACHE = "[^"]+";/,`const EXTERNAL_RUNTIME_CACHE = "mafateeh-external-runtime-v38-${buildId}";`)
     .replace(/const PIPER_RUNTIME_CACHE = "[^"]+";/,'const PIPER_RUNTIME_CACHE = "mafateeh-piper-runtime-v38";')
     .replace(/const OFFLINE_FALLBACK = "[^"]+";/,`const OFFLINE_FALLBACK = "/reader.html?${assetQuery}";`);
  s=s.replace(/\?v=\d+(?:&b=[^"'\s]+)?/g,`?${assetQuery}`);
  s=s.replace(/^\s*"\/reader-(?:formats|studio|mixer|smart-suite|master-fixes|audio-touch-guard)(?:\.css|\.js)\?[^"']+",?\n?/gm,'');
  write(p,s);
}

{
  const p='public/manifest.webmanifest';let s=read(p);
  s=s.replace(/"start_url"\s*:\s*"\/reader\.html(?:\?[^"']*)?"/,'"start_url": "/reader.html?v=38"');
  write(p,s);
}

{
  const p='public/master-version.json';const j=fs.existsSync(p)?JSON.parse(read(p)):{};
  j.name='Mafateeh Al-Tharwa Stable Reader';
  j.version='38.0.0';
  j.buildId=buildId;
  j.audioChapters=46;
  j.sourceBase='User stable Reader v12 module surface + modified 46-chapter book + native iOS audio scroll + build-scoped PWA cache + Gemini mixed audiobook/R2';
  write(p,JSON.stringify(j)+'\n');
}

console.log(`Applied v38 stable mobile reader. build=${buildId}`);
