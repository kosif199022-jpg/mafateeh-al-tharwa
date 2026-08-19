import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
const must=(ok,msg)=>{if(!ok)throw new Error(msg)};

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
  s=s.replace(/<script[^>]*reader-audiobook-builder\.js[^>]*><\/script>\s*/g,'');

  s=s.replace(/#audioShade\{[^}]*\}/,`#audioShade{position:fixed;inset:0;z-index:122;background:rgba(8,14,28,.62);backdrop-filter:blur(6px);
  display:none;align-items:flex-end;justify-content:center;padding-top:48px;overflow:hidden}`);
  s=s.replace(/#audioShade\.on\{[^}]*\}/,'#audioShade.on{display:flex}');
  s=s.replace(/#audioSheet\{[^}]*\}/,`#audioSheet{width:min(620px,100%);max-height:92dvh;overflow-x:hidden;overflow-y:auto;overscroll-behavior-y:contain;touch-action:pan-y;background:var(--surf);color:var(--ink);
  border-radius:28px 28px 0 0;padding:18px 22px calc(24px + env(safe-area-inset-bottom));
  box-shadow:0 -26px 74px rgba(3,8,18,.34);animation:sheetUp .34s var(--ease)}`);

  const mediaAnchor="function mediaOpen(mode,selected='')";
  must(s.includes(mediaAnchor),'mediaOpen anchor missing');
  if(!s.includes('Mafateeh audio modal isolation v38')){
    const helper=`/* Mafateeh audio modal isolation v38 */
let mediaPageLocked=false,mediaPageY=0,mediaPageSaved=null;
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
  const b=document.body;mediaPageY=window.scrollY||document.documentElement.scrollTop||0;
  mediaPageSaved={position:b.style.position,top:b.style.top,left:b.style.left,right:b.style.right,width:b.style.width,overflow:b.style.overflow};
  b.style.position='fixed';b.style.top=\`-\${mediaPageY}px\`;b.style.left='0';b.style.right='0';b.style.width='100%';b.style.overflow='hidden';
  b.classList.add('audio-modal-open');requestAnimationFrame(mediaPrimeScrollBoundary);
}
function mediaUnlockPage(){
  if(!mediaPageLocked)return;mediaPageLocked=false;const b=document.body;
  if(mediaPageSaved){b.style.position=mediaPageSaved.position;b.style.top=mediaPageSaved.top;b.style.left=mediaPageSaved.left;b.style.right=mediaPageSaved.right;b.style.width=mediaPageSaved.width;b.style.overflow=mediaPageSaved.overflow;mediaPageSaved=null;}
  b.classList.remove('audio-modal-open');const y=mediaPageY;requestAnimationFrame(()=>window.scrollTo(0,y));
}
const mediaNativeSheet=$('#audioSheet');
mediaNativeSheet?.addEventListener('touchstart',mediaPrimeScrollBoundary,{passive:true});
mediaNativeSheet?.addEventListener('touchmove',mediaPrimeScrollBoundary,{passive:true});
mediaShade?.addEventListener('touchmove',e=>{if(e.target===mediaShade)e.preventDefault();},{passive:false});
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

  s=s.replace(/<script src="\/reader-tools\.js\?v=\d+"><\/script>/,'<script src="/reader-tools.js?v=38"></script>');
  s=s.replace(/<script src="\/reader-ambience\.js\?v=\d+"><\/script>/,'<script src="/reader-ambience.js?v=38"></script>');
  s=s.replace(/<link rel="stylesheet" href="\/reader-tools\.css\?v=\d+">/,'<link rel="stylesheet" href="/reader-tools.css?v=38">');
  s=s.replace(/<link rel="stylesheet" href="\/reader-ambience\.css\?v=\d+">/,'<link rel="stylesheet" href="/reader-ambience.css?v=38">');
  s=s.replaceAll('?v=31','?v=38').replaceAll('?v=32','?v=38').replaceAll('?v=33','?v=38').replaceAll('?v=34','?v=38').replaceAll('?v=35','?v=38').replaceAll('?v=36','?v=38').replaceAll('?v=37','?v=38');
  s=s.replace(/<!-- Mafateeh stable native-scroll architecture v\d+ -->\s*/g,'');
  s=s.replace('</head>',`<!-- Mafateeh stable Reader v12 architecture + isolated audio scroll v38 -->
</head>`);

  must(/"no"\s*:\s*46/.test(s),'Modified chapter 46 missing');
  must(s.includes('Mafateeh audio modal isolation v38'),'v38 audio isolation missing');
  must(s.includes('overscroll-behavior-y:contain'),'scroll-chain containment missing');
  must(!/#audioShade\{[^}]*touch-action:none/s.test(s),'audio shade must not disable child panning');
  for(const name of scriptNames)must(!s.includes(`/${name}.js`),`non-stable module still loaded: ${name}`);
  for(const name of styleNames)must(!s.includes(`/${name}.css`),`non-stable stylesheet still loaded: ${name}`);
  write(p,s);
}

{
  const p='public/sw.js';let s=read(p);
  s=s.replace(/const CACHE_NAME = "[^"]+";/,'const CACHE_NAME = "mafateeh-al-tharwa-v38-stable-audio";')
     .replace(/const RUNTIME_CACHE = "[^"]+";/,'const RUNTIME_CACHE = "mafateeh-runtime-v38-stable-audio";')
     .replace(/const EXTERNAL_RUNTIME_CACHE = "[^"]+";/,'const EXTERNAL_RUNTIME_CACHE = "mafateeh-external-runtime-v38-stable-audio";')
     .replace(/const OFFLINE_FALLBACK = "[^"]+";/,'const OFFLINE_FALLBACK = "/reader.html?v=38";')
     .replaceAll('?v=31','?v=38').replaceAll('?v=32','?v=38').replaceAll('?v=33','?v=38').replaceAll('?v=34','?v=38').replaceAll('?v=35','?v=38').replaceAll('?v=36','?v=38').replaceAll('?v=37','?v=38');
  s=s.replace(/^\s*"\/reader-(?:formats|studio|mixer|smart-suite|master-fixes|audio-touch-guard)(?:\.css|\.js)\?v=38",?\n?/gm,'');
  write(p,s);
}

{
  const p='public/manifest.webmanifest';let s=read(p);
  s=s.replace(/"start_url"\s*:\s*"\/reader\.html\?v=\d+"/,'"start_url": "/reader.html?v=38"');
  write(p,s);
}

{
  const p='public/master-version.json';const j=fs.existsSync(p)?JSON.parse(read(p)):{};
  j.name='Mafateeh Al-Tharwa Stable Reader';
  j.version='38.0.0';
  j.audioChapters=46;
  j.sourceBase='User stable Reader v12 module surface + modified 46-chapter book + isolated iOS audio scroll + Gemini mixed audiobook/R2';
  write(p,JSON.stringify(j)+'\n');
}

console.log('Applied v38 stable mobile reader and isolated audiobook scrolling.');
