/* مفاتيح الثروة — In-App Gemini Mixed Audiobook Builder v36
   Charon (Narrator) + Kore (Guide) · key is memory-only · each chapter saves to R2 immediately. */
(function(){
'use strict';

const TOTAL=46;
const $=(s,r=document)=>r.querySelector(s);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ar=n=>String(n).replace(/\d/g,d=>'٠١٢٣٤٥٦٧٨٩'[+d]);
let running=false,stopping=false,controller=null,completed=new Map(),lastStatus=null;

function style(){
  if($('#mkAudioBuilderStyle'))return;
  const el=document.createElement('style');el.id='mkAudioBuilderStyle';el.textContent=`
#mkAudioBuilderOpen{width:100%;margin-top:10px;padding:12px 14px;border:1px solid color-mix(in srgb,var(--gold) 48%,var(--line));border-radius:13px;background:linear-gradient(135deg,color-mix(in srgb,var(--gold) 12%,var(--surf)),var(--surf));color:var(--ink);font-weight:800;display:flex;align-items:center;justify-content:center;gap:9px}
#mkAudioBuilderOpen b{color:var(--gold)}
.mk-ab-shade{position:fixed;inset:0;z-index:2147482500;background:rgba(5,11,23,.72);backdrop-filter:blur(8px);display:none;padding:14px;overscroll-behavior:contain}
.mk-ab-shade.on{display:flex;align-items:center;justify-content:center}
.mk-ab-sheet{width:min(720px,100%);max-height:min(90dvh,840px);overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;background:var(--surf);color:var(--ink);border:1px solid var(--line);border-radius:22px;box-shadow:0 30px 90px rgba(0,0,0,.38);padding:18px}
.mk-ab-head{display:flex;align-items:flex-start;gap:12px;margin-bottom:14px}.mk-ab-head>div{flex:1}.mk-ab-head h3{font-family:var(--serif);font-size:1.45rem;line-height:1.35}.mk-ab-head p{color:var(--ink2);font-size:.9rem;margin-top:5px}.mk-ab-close{width:42px;height:42px;border-radius:12px;background:var(--bg2);font-size:1.2rem}
.mk-ab-card{border:1px solid var(--line);background:var(--bg2);border-radius:16px;padding:14px;margin:12px 0}.mk-ab-card strong{color:var(--gold)}
.mk-ab-key{width:100%;direction:ltr;text-align:left;background:var(--surf);border:1px solid var(--line);border-radius:12px;padding:13px 14px;outline:none;font-size:16px}.mk-ab-key:focus{border-color:var(--gold)}
.mk-ab-note{font-size:.82rem;color:var(--ink2);line-height:1.7;margin-top:8px}
.mk-ab-row{display:flex;gap:9px;flex-wrap:wrap;margin-top:12px}.mk-ab-btn{flex:1;min-width:150px;padding:12px 14px;border-radius:12px;background:var(--navy);color:white;font-weight:800}.mk-ab-btn.gold{background:linear-gradient(135deg,var(--gold),var(--goldL));color:#1b1305}.mk-ab-btn:disabled{opacity:.5}.mk-ab-btn.stop{background:var(--bg2);color:var(--ink);border:1px solid var(--line)}
.mk-ab-status{font-size:.92rem;line-height:1.7;margin-top:10px;min-height:1.8em}.mk-ab-progress{height:10px;border-radius:99px;background:var(--line);overflow:hidden;margin-top:10px}.mk-ab-progress i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--gold),var(--goldL));transition:width .25s}
.mk-ab-count{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:.86rem;color:var(--ink2);margin-top:8px}.mk-ab-count b{color:var(--gold);font-size:1rem}
.mk-ab-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:12px}.mk-ab-ch{display:flex;align-items:center;gap:7px;padding:8px 10px;border-radius:10px;background:var(--surf);border:1px solid var(--line);font-size:.8rem}.mk-ab-ch i{width:8px;height:8px;border-radius:50%;background:var(--line);flex:none}.mk-ab-ch.done i{background:#2f9e61}.mk-ab-ch.now{border-color:var(--gold);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--gold) 35%,transparent)}
@media(max-width:560px){.mk-ab-shade{padding:0;align-items:flex-end!important}.mk-ab-sheet{width:100%;max-height:92dvh;border-radius:22px 22px 0 0;padding-bottom:calc(18px + env(safe-area-inset-bottom))}.mk-ab-list{grid-template-columns:1fr}}
`;
  document.head.appendChild(el);
}

function install(){
  if($('#mkAudioBuilderOpen'))return;
  const anchor=$('#audioSource');
  if(!anchor)return;
  style();
  const open=document.createElement('button');open.type='button';open.id='mkAudioBuilderOpen';open.innerHTML='🎙 <span>إنشاء صوت الكتاب بـ Gemini</span> <b id="mkAudioBuilderBadge">—</b>';
  anchor.insertAdjacentElement('afterend',open);
  document.body.insertAdjacentHTML('beforeend',`<div class="mk-ab-shade" id="mkAudioBuilderShade" aria-hidden="true"><section class="mk-ab-sheet" role="dialog" aria-modal="true" aria-labelledby="mkAudioBuilderTitle">
    <header class="mk-ab-head"><div><h3 id="mkAudioBuilderTitle">إنشاء النسخة الصوتية الكاملة</h3><p>Charon للرجل · Kore للمرأة · بالتبادل بين الفقرات · ٤٦ فصلًا</p></div><button type="button" class="mk-ab-close" id="mkAudioBuilderClose" aria-label="إغلاق">✕</button></header>
    <div class="mk-ab-card"><strong>المفتاح لا يُحفظ.</strong><div class="mk-ab-note">يظل مفتاح Gemini في هذه الخانة أثناء التشغيل فقط، ولا يُكتب في LocalStorage أو IndexedDB أو R2. عند إغلاق الصفحة ستحتاج لإدخاله مرة أخرى.</div></div>
    <label for="mkAudioBuilderKey"><b>Gemini API Key</b></label>
    <input id="mkAudioBuilderKey" class="mk-ab-key" type="password" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="أدخل المفتاح ثم ابدأ">
    <div class="mk-ab-row"><button type="button" class="mk-ab-btn gold" id="mkAudioBuilderStart">▶ توليد / استكمال</button><button type="button" class="mk-ab-btn stop" id="mkAudioBuilderStop" disabled>■ إيقاف بعد الحالي</button></div>
    <div class="mk-ab-status" id="mkAudioBuilderStatus">جارٍ فحص الفصول المحفوظة…</div>
    <div class="mk-ab-progress"><i id="mkAudioBuilderProgress"></i></div>
    <div class="mk-ab-count"><span>كل فصل يُحفظ فور انتهائه؛ تحديث الصفحة لا يحذف ما اكتمل.</span><b id="mkAudioBuilderCount">٠ / ٤٦</b></div>
    <div class="mk-ab-list" id="mkAudioBuilderList"></div>
  </section></div>`);
  open.onclick=openPanel;
  $('#mkAudioBuilderClose').onclick=closePanel;
  $('#mkAudioBuilderStart').onclick=start;
  $('#mkAudioBuilderStop').onclick=stop;
  $('#mkAudioBuilderShade').addEventListener('click',e=>{if(e.target===$('#mkAudioBuilderShade'))closePanel();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#mkAudioBuilderShade')?.classList.contains('on'))closePanel();});
  renderList();
  refreshStatus();
}

function chapterTitle(no){
  try{return (CH||[]).find(c=>+c.no===+no)?.title||`الفصل ${no}`;}catch{return `الفصل ${no}`;}
}
function renderList(now=0){
  const host=$('#mkAudioBuilderList');if(!host)return;
  host.innerHTML=Array.from({length:TOTAL},(_,i)=>{const no=i+1,done=completed.has(no);return `<div class="mk-ab-ch ${done?'done':''} ${now===no?'now':''}" data-ab-ch="${no}"><i></i><span>${ar(no)}. ${chapterTitle(no)}</span></div>`;}).join('');
}
function renderProgress(now=0){
  const n=completed.size,pct=Math.round(n/TOTAL*100);
  const count=$('#mkAudioBuilderCount'),bar=$('#mkAudioBuilderProgress'),badge=$('#mkAudioBuilderBadge');
  if(count)count.textContent=`${ar(n)} / ${ar(TOTAL)}`;
  if(bar)bar.style.width=`${pct}%`;
  if(badge)badge.textContent=n===TOTAL?'✓':`${ar(n)}/${ar(TOTAL)}`;
  renderList(now);
}
function setStatus(text,error=false){const el=$('#mkAudioBuilderStatus');if(el){el.textContent=text;el.style.color=error?'#c53b3b':'';}}
function setRunning(on){running=on;const startBtn=$('#mkAudioBuilderStart'),stopBtn=$('#mkAudioBuilderStop'),key=$('#mkAudioBuilderKey');if(startBtn)startBtn.disabled=on;if(stopBtn)stopBtn.disabled=!on;if(key)key.disabled=on;}

async function refreshStatus(){
  try{
    const r=await fetch('/api/audiobook/status',{cache:'no-store',headers:{Accept:'application/json'}});const data=await r.json().catch(()=>({}));
    lastStatus=data;completed=new Map((data.completed||[]).map(x=>[+x.no,x]));renderProgress();
    if(!r.ok||data.storage===false){setStatus('التخزين الدائم R2 غير متاح في هذا النشر بعد.',true);return data;}
    if(data.allComplete)setStatus('النسخة الصوتية الجديدة مكتملة ومحفوظة بالكامل ✓');
    else setStatus(`محفوظ حاليًا ${ar(completed.size)} من ${ar(TOTAL)} فصلًا. يمكنك الاستكمال من التالي.`);
    return data;
  }catch{setStatus('تعذر قراءة حالة الحفظ. تحقق من الاتصال.',true);return null;}
}

function openPanel(){
  const shade=$('#mkAudioBuilderShade');if(!shade)return;shade.classList.add('on');shade.setAttribute('aria-hidden','false');
  try{autoScrollPause(true);}catch{}
  refreshStatus();setTimeout(()=>$('#mkAudioBuilderKey')?.focus(),180);
}
function closePanel(){
  const shade=$('#mkAudioBuilderShade');if(!shade)return;shade.classList.remove('on');shade.setAttribute('aria-hidden','true');
  if(!running){const key=$('#mkAudioBuilderKey');if(key)key.value='';}
}
function stop(){
  if(!running)return;stopping=true;setStatus('سيتم الإيقاف بعد المقطع الجاري؛ الفصول المحفوظة ستظل موجودة.');
  const btn=$('#mkAudioBuilderStop');if(btn)btn.disabled=true;
}

function errorText(code,status){
  const map={
    gemini_key_required:'أدخل مفتاح Gemini صالحًا.',gemini_quota:'تم بلوغ حصة Gemini مؤقتًا.',gemini_rejected:'رفض Gemini الطلب أو المفتاح غير صالح.',
    gemini_unavailable:'Gemini غير متاح مؤقتًا.',gemini_no_audio:'Gemini لم يُرجع صوتًا لهذا المقطع.',audio_storage_not_configured:'R2 غير مفعّل على الخادم.',
    book_source_missing:'مصدر الكتاب الصوتي غير موجود على الخادم.',book_source_invalid:'مصدر الكتاب الصوتي لا يحتوي ٤٦ فصلًا.'
  };
  return map[code]||`تعذر التوليد${status?` (HTTP ${status})`:''}.`;
}

async function generateOne(no,key){
  for(let retry=0;retry<8;retry++){
    controller=new AbortController();
    const r=await fetch('/api/audiobook/generate',{method:'POST',headers:{'Content-Type':'application/json','X-Mafateeh-Client':'reader-audiobook-builder-v36'},body:JSON.stringify({chapter:no,apiKey:key}),signal:controller.signal});
    const data=await r.json().catch(()=>({error:`http_${r.status}`}));
    if(r.ok)return data;
    if(r.status===429||data.error==='gemini_quota'){
      const seconds=Math.max(15,Number(r.headers.get('Retry-After'))||75);
      for(let left=seconds;left>0;left--){if(stopping)throw new Error('stopped');setStatus(`حصة Gemini مؤقتًا ممتلئة. إعادة المحاولة للفصل ${ar(no)} بعد ${ar(left)} ثانية…`);await sleep(1000);}
      continue;
    }
    const e=new Error(data.error||`http_${r.status}`);e.status=r.status;throw e;
  }
  throw new Error('gemini_quota');
}

async function start(){
  if(running)return;
  const input=$('#mkAudioBuilderKey'),key=String(input?.value||'').trim();
  if(!key){setStatus('أدخل مفتاح Gemini أولًا.',true);input?.focus();return;}
  const state=await refreshStatus();if(state?.storage===false){setStatus('لا يمكن البدء قبل تفعيل R2 على Worker.',true);return;}
  if(completed.size>=TOTAL){setStatus('كل الفصول الـ٤٦ محفوظة بالفعل ✓');return;}
  stopping=false;setRunning(true);
  try{
    for(let no=1;no<=TOTAL;no++){
      if(completed.has(no))continue;
      if(stopping)break;
      setStatus(`الفصل ${ar(no)} من ${ar(TOTAL)} — ${chapterTitle(no)} · Gemini يولّد Charon + Kore…`);renderProgress(no);
      let data;
      try{data=await generateOne(no,key);}catch(e){if(e?.name==='AbortError'||e?.message==='stopped'){stopping=true;break;}throw Object.assign(e,{chapter:no});}
      if(data?.chapter)completed.set(no,data.chapter);else completed.set(no,{no});
      renderProgress();
      try{
        const idx=(CH||[]).findIndex(c=>+c.no===no);
        if(idx>=0){mediaTimingCache?.delete?.(idx);mediaTimingPromises?.delete?.(idx);}
        mediaManifestData=null;mediaManifestPromise=null;
      }catch{}
      setStatus(`تم حفظ الفصل ${ar(no)} فورًا ✓ — ${ar(completed.size)} من ${ar(TOTAL)}.`);
      await sleep(350);
    }
    if(completed.size===TOTAL){
      setStatus('اكتملت النسخة الصوتية: ٤٦/٤٦ محفوظة، مع توقيت الكلمات لكل فصل ✓');
      try{mediaManifestData=null;mediaManifestPromise=null;await mediaLoadManifest?.();}catch{}
    }else if(stopping)setStatus(`توقفنا عند ${ar(completed.size)} من ${ar(TOTAL)}. اضغط «توليد / استكمال» لاحقًا للمتابعة.`);
  }catch(e){
    const code=e?.message||'unknown';setStatus(`الفصل ${ar(e?.chapter||completed.size+1)}: ${errorText(code,e?.status)}`,true);
  }finally{
    controller=null;setRunning(false);stopping=false;renderProgress();
    const keyEl=$('#mkAudioBuilderKey');if(keyEl)keyEl.disabled=false;
  }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
