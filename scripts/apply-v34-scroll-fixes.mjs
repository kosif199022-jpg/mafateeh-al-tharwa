import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
const must=(ok,msg)=>{if(!ok)throw new Error(msg)};

// v34 goal: keep the page position stable WITHOUT disabling Safari's gesture pipeline.
// Background movement is blocked by the existing capture touch handler, while modal bodies
// remain native-scrollable. A direct scrollTop fallback is added for stubborn iOS/WKWebView cases.
{
  const p='public/reader-master-fixes.js';
  let s=read(p);
  s=s.replace("const VERSION='33.0.0';","const VERSION='34.0.0';")
     .replaceAll('mafateeh-audiobook-master-v33','mafateeh-audiobook-master-v34')
     .replaceAll('?v=33','?v=34')
     .replace("const UI_PREF_KEY='mafateehMasterUiV33';","const UI_PREF_KEY='mafateehMasterUiV34';");

  // Never put overflow:hidden or touch-action:none on the document/body while a modal is open.
  s=s.replace('body.mk-overlay-open{overflow:hidden!important;width:100%!important}','body.mk-overlay-open{width:100%!important}');

  const start=s.indexOf('function lockBody(){');
  const end=s.indexOf('function syncOverlay(){',start);
  must(start>=0&&end>start,'Cannot locate overlay lock block');
  const block=`function lockBody(){\n  try{if(typeof autoScrollPause==='function')autoScrollPause(true)}catch(_){}\n  if(locked)return;locked=true;lockY=scrollY||document.scrollingElement?.scrollTop||document.documentElement.scrollTop||0;\n  savedBody=null;\n  document.body.classList.add('mk-overlay-open');document.documentElement.classList.add('mk-overlay-open');\n}\nfunction unlockBody(){\n  if(!locked)return;locked=false;\n  document.body.classList.remove('mk-overlay-open');document.documentElement.classList.remove('mk-overlay-open');\n  requestAnimationFrame(()=>{const root=document.scrollingElement||document.documentElement;const y=root.scrollTop||scrollY||0;if(Math.abs(y-lockY)>4)scrollTo({top:lockY,behavior:'instant'})});\n}\n`;
  s=s.slice(0,start)+block+s.slice(end);

  const anchor="const audio=()=>$('#audioElement');";
  must(s.includes(anchor),'Audio anchor missing for iOS direct scroll fallback');
  const fallback=`// Mafateeh iOS direct-scroll fallback v34. Native scrolling remains first choice.\nconst mkIOS=(()=>{const n=navigator,p=n.platform||'',u=n.userAgent||'';return /iPad|iPhone|iPod/.test(p)||(/Mac/.test(p)&&n.maxTouchPoints>1)||/iPad|iPhone|iPod/.test(u)})();\nlet mkTouchX=0,mkTouchY=0,mkTouchScroller=null;\nfunction primaryOverlayScroller(){\n  const list=['.smart-shade.on .smart-body','#smartBookShade.on .smart-body','.mixer-shade.on .mixer-sheet','.studio-shade.on .studio-sheet','.amb-shade.on .amb-sheet','.media-shade.on .media-sheet','.journal-shade.on .journal-sheet','.note-shade.on .note-sheet','.install-shade.on .install-sheet','#drawer.on .dlist','#prefs.on','#search.on #sres'];\n  for(const sel of list){const el=$(sel);if(el&&visible(el)&&el.scrollHeight>el.clientHeight+1)return el}return null;\n}\nif(mkIOS){\n  document.addEventListener('touchstart',e=>{if(!locked||e.touches?.length!==1)return;const t=e.touches[0];mkTouchX=t.clientX;mkTouchY=t.clientY;mkTouchScroller=scrollableAncestor(e.target)||primaryOverlayScroller();},{passive:true,capture:true});\n  document.addEventListener('touchmove',e=>{\n    if(!locked||e.touches?.length!==1)return;const t=e.touches[0],dx=t.clientX-mkTouchX,dy=t.clientY-mkTouchY;\n    if(Math.abs(dx)>Math.abs(dy)*1.15){mkTouchX=t.clientX;mkTouchY=t.clientY;return}\n    const sc=scrollableAncestor(e.target)||mkTouchScroller||primaryOverlayScroller();\n    if(!sc){e.preventDefault();mkTouchX=t.clientX;mkTouchY=t.clientY;return}\n    const max=Math.max(0,sc.scrollHeight-sc.clientHeight);\n    if(max>1){const before=sc.scrollTop;const next=Math.max(0,Math.min(max,before-dy));if(Math.abs(next-before)>.1)sc.scrollTop=next}\n    e.preventDefault();mkTouchX=t.clientX;mkTouchY=t.clientY;mkTouchScroller=sc;\n  },{passive:false,capture:true});\n  document.addEventListener('touchend',()=>{mkTouchScroller=null},{passive:true,capture:true});\n}\n\n`;
  s=s.replace(anchor,fallback+anchor);
  write(p,s);
}

// Make every modal content surface explicitly scrollable and avoid root gesture cancellation.
for(const p of ['public/reader-smart-suite.css','public/reader-mixer.css']){
  let s=read(p);
  s+=`\n/* Master v34 — Safari/iPhone scroll stability */\nhtml.mk-overlay-open,body.mk-overlay-open{touch-action:auto!important}\n.smart-shade.on,.mixer-shade.on,.studio-shade.on,.amb-shade.on{touch-action:pan-y!important}\n.smart-body,.smart-chat,.smart-book-reader,.smart-book-content,.mixer-sheet,.studio-sheet,.amb-sheet{min-height:0!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior-y:contain!important;touch-action:pan-y!important}\n.smart-body,.smart-chat,.mixer-sheet,.studio-sheet,.amb-sheet{overflow-y:auto!important}\n`;
  write(p,s);
}

// Auto-scroll: use the browser's real scrolling element and the visual viewport on iPhone.
{
  const p='public/reader.html';
  let s=read(p);
  const old1="autoScrollState.carry=distance-whole;if(whole>0)scrollBy({top:whole,behavior:'instant'});\n  const h=document.documentElement,atEnd=h.scrollTop+innerHeight>=h.scrollHeight-24;";
  const neu1="autoScrollState.carry=distance-whole;const h=document.scrollingElement||document.documentElement;if(whole>0)window.scrollTo({top:h.scrollTop+whole,behavior:'instant'});\n  const viewport=window.visualViewport?.height||window.innerHeight,atEnd=h.scrollTop+viewport>=h.scrollHeight-24;";
  must(s.includes(old1),'Auto-scroll v33 anchor missing');
  s=s.replace(old1,neu1);
  s=s.replaceAll('?v=33','?v=34').replaceAll('master-v33','master-v34');
  write(p,s);
}

// Bump all reader module references and PWA caches so iPhones cannot keep the old broken runtime.
for(const p of ['public/sw.js','public/manifest.webmanifest','public/reader-smart-suite.js','public/reader-mixer.js','public/reader-tools.js','public/reader-ambience.js','public/reader-studio.js']){
  if(!fs.existsSync(p))continue;
  let s=read(p).replaceAll('?v=33','?v=34').replaceAll('master-v33','master-v34');
  if(p.endsWith('manifest.webmanifest'))s=s.replace('"start_url": "/reader.html?v=33"','"start_url": "/reader.html?v=34"');
  write(p,s);
}

{
  const p='public/master-version.json';
  const j=JSON.parse(read(p));
  j.version='34.0.0';
  j.sourceBase='V13 + Smart Suite + Mixer Pro + modified 46-chapter book + Master v34 permanent iPhone/Safari scrolling';
  write(p,JSON.stringify(j)+'\n');
}

console.log('Master v34 permanent Safari/iPhone scrolling fixes applied.');
