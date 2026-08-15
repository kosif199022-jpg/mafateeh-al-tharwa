import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
const must=(ok,msg)=>{if(!ok)throw new Error(msg)};

// Master v33: keep background locked without disabling touch gestures on modal descendants.
{
  const p='public/reader-master-fixes.js';
  let s=read(p);
  s=s.replace("const VERSION='32.0.0';","const VERSION='33.0.0';");
  s=s.replaceAll('mafateeh-audiobook-master-v32','mafateeh-audiobook-master-v33');
  s=s.replaceAll('?v=32','?v=33');
  s=s.replace("const UI_PREF_KEY='mafateehMasterUiV32';","const UI_PREF_KEY='mafateehMasterUiV33';");
  s=s.replace("body.mk-overlay-open{overflow:hidden!important;touch-action:none!important;width:100%!important}","body.mk-overlay-open{overflow:hidden!important;width:100%!important}");
  s=s.replace("savedBody={htmlOverflow:h.style.overflow,htmlOverscroll:h.style.overscrollBehavior,bodyOverflow:b.style.overflow,bodyTouchAction:b.style.touchAction};\n  h.style.overflow='hidden';h.style.overscrollBehavior='none';b.style.overflow='hidden';b.style.touchAction='none';",
    "savedBody={htmlOverflow:h.style.overflow,htmlOverscroll:h.style.overscrollBehavior,bodyOverflow:b.style.overflow,bodyTouchAction:b.style.touchAction};\n  h.style.overflow='hidden';h.style.overscrollBehavior='none';b.style.overflow='hidden';");
  write(p,s);
}

// Force every actual sheet/content surface to own the vertical gesture on iOS.
for(const p of ['public/reader-smart-suite.css','public/reader-mixer.css']){
  let s=read(p);
  s+=`\n/* Master v33 — iOS gesture ownership */\n.smart-shade.on,.mixer-shade.on{touch-action:pan-y!important}\n.smart-sheet,.smart-body,.smart-chat,.smart-book-reader,.mixer-sheet{touch-action:pan-y!important;-webkit-overflow-scrolling:touch!important}\n.smart-body,.smart-chat,.mixer-sheet{overflow-y:auto!important;overscroll-behavior-y:contain!important}\n`;
  write(p,s);
}

// Safari/iPhone fallback: if Piper's third-party runtime cannot load in a Worker,
// keep "read any text" usable offline through the device's local Arabic voice.
{
  const p='public/reader-smart-suite.js';
  let s=read(p).replaceAll('?v=32','?v=33');
  const anchor="async function readAnyText(text,mode=readMode){";
  must(s.includes(anchor),'readAnyText anchor missing');
  const helper=`function speakDeviceChunk(text,token){return new Promise((resolve,reject)=>{if(!('speechSynthesis'in window))return reject(new Error('صوت الجهاز غير مدعوم'));const u=new SpeechSynthesisUtterance(String(text||''));u.lang='ar-SA';const voices=speechSynthesis.getVoices?.()||[];u.voice=voices.find(v=>/^ar/i.test(v.lang))||voices.find(v=>/arab/i.test(v.name))||null;u.rate=.95;u.onend=()=>resolve();u.onerror=e=>reject(new Error(e.error||'device_tts_failed'));if(token!==readToken)return resolve();speechSynthesis.cancel();speechSynthesis.speak(u)})}\n`;
  s=s.replace(anchor,helper+anchor);
  const old="const blob=mode==='piper'?await piperBlob(chunks[i]):await cloudBlob(chunks[i],mode);if(token!==readToken)return;await playBlob(blob,token)";
  const neu="if(mode==='piper'){try{const blob=await piperBlob(chunks[i]);if(token!==readToken)return;await playBlob(blob,token)}catch(e){const msg=String(e?.message||e);if(!/piper|load failed|runtime|cdn|import/i.test(msg))throw e;one('#smartReadStatus').textContent='Piper Web تعذر تحميله على Safari — يتم استخدام صوت iPhone العربي المحلي Offline';await speakDeviceChunk(chunks[i],token)}}else{const blob=await cloudBlob(chunks[i],mode);if(token!==readToken)return;await playBlob(blob,token)}";
  must(s.includes(old),'Piper playback anchor missing');
  s=s.replace(old,neu);
  s=s.replace("statusEl.textContent=`تعذر تجهيز Piper: ${e.message}`;statusEl.classList.add('error');return false",
    "statusEl.textContent=/piper|load failed|runtime|cdn|import/i.test(String(e?.message||e))?'Piper Web غير متاح في Safari الحالي — سيستخدم التطبيق صوت iPhone العربي المحلي تلقائيًا دون سحابة.':`تعذر تجهيز Piper: ${e.message}`;statusEl.classList.toggle('error',!/piper|load failed|runtime|cdn|import/i.test(String(e?.message||e)));return false");
  write(p,s);
}

// Version reader/PWA assets consistently.
for(const p of ['public/reader.html','public/sw.js','public/manifest.webmanifest']){
  let s=read(p).replaceAll('?v=32','?v=33').replaceAll('master-v32','master-v33');
  if(p.endsWith('manifest.webmanifest'))s=s.replace('"start_url": "/reader.html?v=32"','"start_url": "/reader.html?v=33"');
  write(p,s);
}
console.log('Master v33 iOS scrolling and Piper fallback fixes applied.');
