import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);
const must = (ok, msg) => { if (!ok) throw new Error(msg); };
const replaceOnce = (s, from, to, label) => {
  must(s.includes(from), `Missing patch anchor: ${label}`);
  return s.replace(from, to);
};

// 1) Replace the iOS body-position lock with a root overflow lock.
// This preserves scrollHeight and the exact reading position while modals are open.
{
  const p = 'public/reader-master-fixes.js';
  let s = read(p);
  s = s.replace("const VERSION='31.0.0';", "const VERSION='32.0.0';");
  s = s.replaceAll('mafateeh-audiobook-master-v31', 'mafateeh-audiobook-master-v32');
  s = s.replaceAll('?v=31', '?v=32');
  s = s.replace("const UI_PREF_KEY='mafateehMasterUiV31';", "const UI_PREF_KEY='mafateehMasterUiV32';");
  s = s.replace("{...{smart:true,mixer:true,scroll:true,theme:''}", "{...{smart:false,mixer:false,scroll:true,theme:''}");
  s = s.replace("return {smart:true,mixer:true,scroll:true,theme:''}", "return {smart:false,mixer:false,scroll:true,theme:''}");

  const start = s.indexOf('function lockBody(){');
  const end = s.indexOf('function syncOverlay(){', start);
  must(start >= 0 && end > start, 'Cannot locate master overlay lock block');
  const block = `function lockBody(){\n  try{if(typeof autoScrollPause==='function')autoScrollPause(true)}catch(_){}\n  if(locked)return;locked=true;lockY=scrollY||document.documentElement.scrollTop||0;\n  const h=document.documentElement,b=document.body;\n  savedBody={htmlOverflow:h.style.overflow,htmlOverscroll:h.style.overscrollBehavior,bodyOverflow:b.style.overflow,bodyTouchAction:b.style.touchAction};\n  h.style.overflow='hidden';h.style.overscrollBehavior='none';b.style.overflow='hidden';b.style.touchAction='none';\n  b.classList.add('mk-overlay-open');h.classList.add('mk-overlay-open');\n}\nfunction unlockBody(){\n  if(!locked)return;locked=false;const h=document.documentElement,b=document.body;\n  if(savedBody){h.style.overflow=savedBody.htmlOverflow||'';h.style.overscrollBehavior=savedBody.htmlOverscroll||'';b.style.overflow=savedBody.bodyOverflow||'';b.style.touchAction=savedBody.bodyTouchAction||'';savedBody=null}else{h.style.overflow='';h.style.overscrollBehavior='';b.style.overflow='';b.style.touchAction=''}\n  b.classList.remove('mk-overlay-open');h.classList.remove('mk-overlay-open');\n  requestAnimationFrame(()=>{const y=scrollY||document.documentElement.scrollTop||0;if(Math.abs(y-lockY)>4)scrollTo({top:lockY,behavior:'instant'})});\n}\n`;
  s = s.slice(0, start) + block + s.slice(end);

  // The user can still open both advanced tools from Drawer/Preferences; do not float them over reading text by default.
  const marker = "wrap.innerHTML=`<h3 style=\"margin:0 0 8px;font-size:.9rem\">واجهة القراءة</h3>";
  if (s.includes(marker)) {
    s = s.replace(marker, "wrap.innerHTML=`<h3 style=\"margin:0 0 8px;font-size:.9rem\">واجهة القراءة</h3><p style=\"margin:0 0 8px;font-size:.72rem;color:var(--ink2)\">الأزرار العائمة مخفية افتراضيًا حتى لا تغطي النص. افتح الأدوات من القائمة أو فعّلها هنا عند الحاجة.</p>");
  }
  write(p, s);
}

// 2) Remove reading-surface floating buttons and harden every modal scroll container.
{
  const p = 'public/reader-smart-suite.css';
  let s = read(p);
  s += `\n/* Master v32 — distraction-free reading + iOS modal scrolling */\n#smartHubDock{display:none!important}\n.smart-shade,.smart-sheet,.smart-body,.smart-pane,.smart-chat,.smart-book-reader{min-height:0}\n.smart-sheet{height:min(calc(var(--mk-vvh,100dvh) - 8px),920px)!important;max-height:calc(var(--mk-vvh,100dvh) - 8px)!important}\n.smart-body{overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior-y:contain!important;touch-action:pan-y!important}\n.smart-chat{overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;touch-action:pan-y!important}\n@media(max-width:650px){.smart-sheet{height:calc(var(--mk-vvh,100dvh) - 6px)!important;max-height:calc(var(--mk-vvh,100dvh) - 6px)!important}}\n`;
  write(p, s);
}
{
  const p = 'public/reader-mixer.css';
  let s = read(p);
  s += `\n/* Master v32 — no floating controls over the book */\n.mixer-dock{display:none!important}\n.mixer-sheet{height:min(calc(var(--mk-vvh,100dvh) - 8px),920px);max-height:calc(var(--mk-vvh,100dvh) - 8px)!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior-y:contain!important;touch-action:pan-y!important}\n.mx-grid,.mx-presets,.mx-master{min-height:0}\n`;
  write(p, s);
}

// 3) Keep Mixer accessible from Preferences after hiding its floating dock.
{
  const p = 'public/reader-mixer.js';
  let s = read(p);
  const anchor = "$('#mixerDock').onclick=open;$('#mixerClose').onclick=close;$('#mxDone').onclick=close;shade.onclick=e=>{if(e.target===shade)close()};";
  const replacement = `${anchor}\nconst prefs=$('#prefs');if(prefs&&!$('#prefsMixerPro')){prefs.insertAdjacentHTML('beforeend','<div class="prow" style="margin-bottom:0"><button id="prefsMixerPro" style="width:100%;border:1px solid var(--line);background:var(--bg2);border-radius:11px;padding:11px;font-weight:800;color:var(--ink)">🎚️ فتح Mixer Pro</button></div>');$('#prefsMixerPro').onclick=open}`;
  s = replaceOnce(s, anchor, replacement, 'mixer preferences entry');
  write(p, s);
}

// 4) Make missing cloud configuration explicit before a user sends a question.
// Book AI remains available as soon as the server key is configured; local/Piper features stay usable meanwhile.
{
  const p = 'public/reader-smart-suite.js';
  let s = read(p).replaceAll('?v=31', '?v=32');
  const openAnchor = "function openHub(tab='read'){hub.classList.add('on');hub.setAttribute('aria-hidden','false');bodyLock(true);setTab(tab);try{autoScrollPause?.(true)}catch(_){}try{closeDrawer?.()}catch(_){}refreshAll();}";
  const openReplacement = `async function refreshCloudAvailability(){try{const r=await fetch('/api/ai/status',{cache:'no-store'}),j=await r.json();const gem=!!j.gemini?.configured,oa=!!j.openai?.configured;many('[data-mode="gemini"]').forEach(b=>{b.disabled=!gem;b.title=gem?'':'Gemini غير مهيأ على الخادم'});many('[data-mode="openai"]').forEach(b=>{b.disabled=!oa;b.title=oa?'':'OpenAI غير مهيأ على الخادم'});const st=one('#smartBookAiStatus');if(st&&!gem){st.textContent='Gemini غير مهيأ على الخادم. يمكنك استخدام القراءة المحلية وPiper الآن، وتعمل «افهم كتابي» فور إضافة GEMINI_API_KEY إلى Worker.';st.classList.add('error')}}catch(_){}}\nfunction openHub(tab='read'){hub.classList.add('on');hub.setAttribute('aria-hidden','false');bodyLock(true);setTab(tab);try{autoScrollPause?.(true)}catch(_){}try{closeDrawer?.()}catch(_){}refreshAll();refreshCloudAvailability();}`;
  s = replaceOnce(s, openAnchor, openReplacement, 'smart hub cloud status');
  s = s.replace("status(st,`تعذر السؤال: ${e.message}`,true)", "status(st,`تعذر السؤال: ${e.message==='gemini_not_configured'?'Gemini غير مهيأ على الخادم — أضف GEMINI_API_KEY ثم أعد المحاولة.':e.message}`,true)");
  write(p, s);
}

// 5) Version all reader static resources and PWA entry points consistently.
for (const p of ['public/reader.html','public/sw.js','public/manifest.webmanifest']) {
  let s = read(p);
  s = s.replaceAll('?v=31', '?v=32');
  s = s.replaceAll('master-v31', 'master-v32');
  if (p.endsWith('manifest.webmanifest')) s = s.replace('"start_url": "/reader.html?v=31"', '"start_url": "/reader.html?v=32"');
  write(p, s);
}

console.log('Master v32 reader fixes applied successfully.');
