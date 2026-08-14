/* مفاتيح الثروة — Master Runtime Fixes v30
   iPhone modal scrolling, audio resilience, MediaSession, storage health,
   full-audiobook offline download, visual viewport, and regression telemetry. */
(function(){
'use strict';
const VERSION='30.0.0';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const pad=n=>String(n).padStart(2,'0');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const notify=(msg)=>{try{if(typeof toast==='function')return toast(msg)}catch(_){} console.info('[Mafateeh]',msg)};

document.documentElement.dataset.mafateehMaster=VERSION;
const style=document.createElement('style');
style.id='mafateehMasterFixStyles';
style.textContent=`
:root{--mk-vvh:100dvh}
html.mk-overlay-open,html.mk-overlay-open body{overscroll-behavior:none!important}
body.mk-overlay-open{overflow:hidden!important;touch-action:none!important;width:100%!important}
#drawer .dlist,#prefs,#search,#sres,.note-sheet,.journal-sheet,.media-sheet,.install-sheet,
.smart-sheet,.smart-body,.smart-pane,.mixer-sheet,.mixer-body,.amb-sheet,.studio-sheet,
[role="dialog"] .scroll,[role="dialog"] .body{
  -webkit-overflow-scrolling:touch!important;overscroll-behavior:contain!important;touch-action:pan-y!important
}
.smart-sheet,.mixer-sheet,.media-sheet,.journal-sheet,.note-sheet,.install-sheet{max-height:calc(var(--mk-vvh) - 20px)!important}
#mkMasterOfflineCard{margin-top:14px;padding:16px;border:1px solid var(--line,#e3e7ee);border-radius:16px;background:var(--surf,#fff)}
#mkMasterOfflineCard h3{margin:0 0 6px}#mkMasterOfflineCard p{margin:0 0 12px;opacity:.78}
#mkMasterOfflineCard .mk-actions{display:flex;gap:8px;flex-wrap:wrap}
#mkMasterOfflineCard button{padding:10px 14px;border-radius:11px;background:var(--bg2,#f4f4f4);font-weight:800}
#mkMasterOfflineCard button.primary{background:var(--navy,#1f3352);color:white}
#mkMasterOfflineCard progress{width:100%;height:8px;margin-top:12px;accent-color:var(--gold,#b4894a)}
#mkMasterHealth{font-size:.86rem;margin-top:8px;min-height:1.6em}
`;
document.head.appendChild(style);

// iPhone visual viewport: keyboard and address-bar resizing no longer hides sheet controls.
function syncViewport(){const h=window.visualViewport?.height||window.innerHeight;document.documentElement.style.setProperty('--mk-vvh',`${Math.max(320,h)}px`)}
syncViewport();window.visualViewport?.addEventListener('resize',syncViewport);addEventListener('orientationchange',()=>setTimeout(syncViewport,180));

const overlaySelectors=[
  '#drawer.on','#prefs.on','#search.on','.note-shade.on','.journal-shade.on','.media-shade.on',
  '.install-shade.on','.smart-shade.on','.mixer-shade.on','.amb-shade.on','.studio-shade.on',
  '[role="dialog"][aria-hidden="false"]'
];
const scrollSelectors=[
  '#drawer .dlist','#prefs','#search','#sres','.note-sheet','.journal-sheet','.media-sheet','.install-sheet',
  '.smart-sheet','.smart-body','.smart-pane.on','.mixer-sheet','.mixer-body','.amb-sheet','.studio-sheet',
  '[role="dialog"] .scroll','[role="dialog"] .body'
].join(',');
let locked=false,lockY=0,savedBody=null,syncRAF=0;
function visible(el){if(!el)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&s.pointerEvents!=='none'}
function hasOverlay(){return overlaySelectors.some(sel=>{try{return $$(sel).some(visible)}catch{return false}})}
function lockBody(){
  if(locked)return;locked=true;lockY=scrollY||document.documentElement.scrollTop||0;
  const b=document.body;savedBody={position:b.style.position,top:b.style.top,left:b.style.left,right:b.style.right,width:b.style.width,overflow:b.style.overflow,touchAction:b.style.touchAction};
  b.style.position='fixed';b.style.top=`-${lockY}px`;b.style.left='0';b.style.right='0';b.style.width='100%';b.style.overflow='hidden';b.style.touchAction='none';
  b.classList.add('mk-overlay-open');document.documentElement.classList.add('mk-overlay-open');
}
function unlockBody(){
  if(!locked)return;locked=false;const b=document.body;
  if(savedBody){Object.assign(b.style,savedBody);savedBody=null}else{b.style.position='';b.style.top='';b.style.left='';b.style.right='';b.style.width='';b.style.overflow='';b.style.touchAction=''}
  b.classList.remove('mk-overlay-open');document.documentElement.classList.remove('mk-overlay-open');scrollTo(0,lockY);
}
function syncOverlay(){syncRAF=0;hasOverlay()?lockBody():unlockBody();$$(scrollSelectors).forEach(el=>{el.style.webkitOverflowScrolling='touch';el.style.overscrollBehavior='contain';if(getComputedStyle(el).overflowY==='visible')el.style.overflowY='auto'})}
function scheduleOverlay(){if(!syncRAF)syncRAF=requestAnimationFrame(syncOverlay)}
new MutationObserver(scheduleOverlay).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class','style','aria-hidden']});
addEventListener('pageshow',scheduleOverlay);scheduleOverlay();

// Stop touch-chain from moving the book behind an open modal while keeping the sheet scrollable.
let touchY=0;
document.addEventListener('touchstart',e=>{touchY=e.touches?.[0]?.clientY||0},{passive:true,capture:true});
document.addEventListener('touchmove',e=>{
  if(!locked)return;const sc=e.target.closest?.(scrollSelectors);if(!sc){e.preventDefault();return}
  const y=e.touches?.[0]?.clientY||touchY,dy=y-touchY;touchY=y;
  const atTop=sc.scrollTop<=0,atBottom=Math.ceil(sc.scrollTop+sc.clientHeight)>=sc.scrollHeight;
  if((atTop&&dy>0)||(atBottom&&dy<0))e.preventDefault();
},{passive:false,capture:true});

const audio=()=>$('#audioElement');
function setupAudio(){
  const a=audio();if(!a||a.dataset.masterReady)return;a.dataset.masterReady='1';a.preload='metadata';a.setAttribute('playsinline','');a.setAttribute('webkit-playsinline','');
  const ms=navigator.mediaSession;
  if(ms){
    try{ms.setActionHandler('play',()=>a.play().catch(()=>{}));ms.setActionHandler('pause',()=>a.pause());
      ms.setActionHandler('seekbackward',d=>{a.currentTime=Math.max(0,a.currentTime-(d.seekOffset||15))});
      ms.setActionHandler('seekforward',d=>{a.currentTime=Math.min(a.duration||Infinity,a.currentTime+(d.seekOffset||15))});
      ms.setActionHandler('seekto',d=>{if(Number.isFinite(d.seekTime))a.currentTime=d.seekTime});
    }catch(_){}
    a.addEventListener('play',()=>{try{ms.playbackState='playing'}catch(_){}});
    a.addEventListener('pause',()=>{try{ms.playbackState='paused'}catch(_){}});
    a.addEventListener('loadedmetadata',()=>{try{if(Number.isFinite(a.duration))ms.setPositionState({duration:a.duration,playbackRate:a.playbackRate||1,position:Math.min(a.currentTime,a.duration)})}catch(_){}});
    a.addEventListener('timeupdate',()=>{try{if(Number.isFinite(a.duration)&&a.duration>0)ms.setPositionState({duration:a.duration,playbackRate:a.playbackRate||1,position:Math.min(a.currentTime,a.duration)})}catch(_){}});
  }
}
setupAudio();new MutationObserver(setupAudio).observe(document.body,{childList:true,subtree:true});

// Resume WebAudio only after a genuine user gesture, which is required by iOS Safari.
const unlockAudio=()=>{try{const c=window.MafateehMixer?.context||window.MafateehMixer?.state?.context;if(c?.state==='suspended')c.resume().catch(()=>{})}catch(_){}};
document.addEventListener('pointerdown',unlockAudio,{passive:true,capture:true});document.addEventListener('touchend',unlockAudio,{passive:true,capture:true});

const AUDIO_CACHE='mafateeh-audiobook-master-v30';
const chapterURLs=()=>Array.from({length:34},(_,i)=>`/audio/chapter-${pad(i+1)}.mp3`);
const timingURLs=()=>Array.from({length:34},(_,i)=>`/audio/timings/chapter-${pad(i+1)}.json`);
let offlineProgress=0;
function setOfflineStatus(text,value=offlineProgress){offlineProgress=value;const s=$('#mkMasterHealth'),p=$('#mkMasterOfflineProgress');if(s)s.textContent=text;if(p)p.value=value}
async function cacheAudiobook(){
  if(!('caches'in window))throw new Error('Cache Storage غير مدعوم');
  try{await navigator.storage?.persist?.()}catch(_){}
  const c=await caches.open(AUDIO_CACHE),urls=['/audio/manifest.json',...chapterURLs(),...timingURLs()];let done=0;
  for(const url of urls){setOfflineStatus(`تنزيل ${done+1} من ${urls.length}…`,Math.round(done/urls.length*100));const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`${url}: HTTP ${r.status}`);await c.put(url,r.clone());done++}
  setOfflineStatus('تم تنزيل الكتاب الصوتي والتوقيتات للعمل دون إنترنت ✓',100);return {files:urls.length,cache:AUDIO_CACHE};
}
async function clearAudiobook(){await caches.delete(AUDIO_CACHE);setOfflineStatus('تم حذف حزمة الكتاب الصوتي Offline',0)}
async function probe(url){try{const r=await fetch(url,{method:'HEAD',cache:'no-store'});return {url,ok:r.ok,status:r.status,type:r.headers.get('content-type')||''}}catch(e){return {url,ok:false,status:0,error:e.message}}}
async function health(){
  const modules=['/reader-mixer.js?v=30','/reader-smart-suite.js?v=30','/reader-tools.js?v=30','/reader-studio.js?v=30','/piper-worker.js?v=30'];
  const urls=[...chapterURLs(),'/audio/manifest.json',...modules];let out=[];
  for(let i=0;i<urls.length;i+=6)out.push(...await Promise.all(urls.slice(i,i+6).map(probe)));
  const bad=out.filter(x=>!x.ok);return {version:VERSION,checked:out.length,ok:bad.length===0,bad,results:out};
}
async function runHealth(){setOfflineStatus('جاري فحص الصوت والمحركات…',offlineProgress);const r=await health();setOfflineStatus(r.ok?'فحص Master: كل ملفات الصوت والمحركات متاحة ✓':`يوجد ${r.bad.length} ملف/محرك يحتاج مراجعة`,offlineProgress);return r}

function injectOfflineCard(){
  const pane=$('[data-smart-pane="offline"]');if(!pane||$('#mkMasterOfflineCard'))return false;
  pane.insertAdjacentHTML('afterbegin',`<div id="mkMasterOfflineCard"><h3>📦 حزمة الكتاب الكامل Offline</h3><p>نزّل الـ34 فصلًا الصوتيًا مع توقيت الكلمات. لا يبدأ التنزيل الكبير إلا بعد ضغطك.</p><div class="mk-actions"><button class="primary" id="mkCacheBook">⬇ تنزيل الكتاب الصوتي</button><button id="mkHealthBook">✓ فحص الملفات</button><button id="mkClearBook">حذف الحزمة</button></div><progress id="mkMasterOfflineProgress" max="100" value="0"></progress><div id="mkMasterHealth">Master v${VERSION} جاهز</div></div>`);
  $('#mkCacheBook').onclick=()=>cacheAudiobook().catch(e=>setOfflineStatus(`تعذر التنزيل: ${e.message}`,offlineProgress));
  $('#mkHealthBook').onclick=()=>runHealth().catch(e=>setOfflineStatus(`تعذر الفحص: ${e.message}`,offlineProgress));
  $('#mkClearBook').onclick=()=>clearAudiobook().catch(e=>setOfflineStatus(`تعذر الحذف: ${e.message}`,offlineProgress));return true;
}
if(!injectOfflineCard()){const mo=new MutationObserver(()=>{if(injectOfflineCard())mo.disconnect()});mo.observe(document.body,{subtree:true,childList:true})}

// Keep a tiny local error ledger for reproducible iPhone reports without sending user data anywhere.
function logError(kind,message){try{const key='mafateehMasterErrors',list=JSON.parse(localStorage.getItem(key)||'[]');list.push({time:new Date().toISOString(),kind,message:String(message||'').slice(0,500)});localStorage.setItem(key,JSON.stringify(list.slice(-20)))}catch(_){} }
addEventListener('error',e=>logError('error',e.message));addEventListener('unhandledrejection',e=>logError('promise',e.reason?.message||e.reason));

// Service worker must immediately move clients from old V13/V24 caches to Master v30.
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').then(r=>r.update()).catch(()=>{}));

window.MafateehMaster={version:VERSION,health,runHealth,cacheAudiobook,clearAudiobook,cacheName:AUDIO_CACHE,syncOverlay};
console.info(`Mafateeh Master ${VERSION} runtime fixes active`);
})();
