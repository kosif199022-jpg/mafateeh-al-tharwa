/* مفاتيح الثروة — Professional Multi-Layer Audio Mixer v25 */
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const LAYERS={
rain:{icon:'🌧️',name:'مطر',level:38,scale:.58},
waves:{icon:'🌊',name:'أمواج',level:42,scale:.90},
wind:{icon:'💨',name:'رياح',level:24,scale:.65},
river:{icon:'💧',name:'نهر',level:28,scale:.48},
fire:{icon:'🔥',name:'نار',level:22,scale:.45},
forest:{icon:'🌲',name:'غابة',level:25,scale:.28},
thunder:{icon:'⛈️',name:'رعد',level:32,scale:1,periodic:true},
lightning:{icon:'⚡',name:'برق',level:18,scale:1,periodic:true},
night:{icon:'🌙',name:'ليل',level:24,scale:.30},
birds:{icon:'🐦',name:'طيور',level:24,scale:.08},
cafe:{icon:'☕',name:'مقهى',level:24,scale:.34},
fan:{icon:'🌀',name:'مروحة',level:20,scale:.30},
brown:{icon:'🟤',name:'Brown Noise',level:20,scale:.34},
white:{icon:'⚪',name:'White Noise',level:14,scale:.22}
};
const PRESETS={
calm:{icon:'☔',name:'مطر هادئ',master:70,layers:{rain:42,wind:12}},
sea:{icon:'🌊',name:'على البحر',master:72,layers:{waves:54,wind:13}},
storm:{icon:'🌩️',name:'عاصفة',master:68,layers:{rain:54,wind:34,thunder:42,lightning:16}},
forest:{icon:'🌿',name:'غابة',master:72,layers:{forest:32,birds:28,river:18,wind:10}},
focus:{icon:'🎯',name:'تركيز',master:58,layers:{brown:24,fan:12}},
sleep:{icon:'😴',name:'نوم',master:52,layers:{waves:22,brown:14,night:10}},
cafe:{icon:'📚',name:'مقهى ومطر',master:60,layers:{cafe:28,rain:20}}
};
const loadSaved=()=>{try{return JSON.parse(localStorage.getItem('mafateehMixerV25')||localStorage.getItem('mafateehMixerV22')||'{}')}catch{return {}}};
const saved=loadSaved();
const state={
context:null,master:null,limiter:null,active:new Map(),timers:new Map(),buffers:new Map(),
masterLevel:Number.isFinite(+saved.masterLevel)?+saved.masterLevel:75,
narratorLevel:Number.isFinite(+saved.narratorLevel)?+saved.narratorLevel:100,
ducking:saved.ducking!==false,duckLevel:Number.isFinite(+saved.duckLevel)?+saved.duckLevel:28,
levels:{...Object.fromEntries(Object.entries(LAYERS).map(([k,v])=>[k,v.level])),...(saved.levels||{})},
enabled:new Set((Array.isArray(saved.enabled)?saved.enabled:[]).filter(k=>LAYERS[k])),
narration:false,preset:saved.preset&&PRESETS[saved.preset]?saved.preset:null,
deviceVoice:false,deviceQueue:[],deviceIndex:0
};
function persist(){
localStorage.setItem('mafateehMixerV25',JSON.stringify({masterLevel:state.masterLevel,narratorLevel:state.narratorLevel,ducking:state.ducking,duckLevel:state.duckLevel,levels:state.levels,enabled:[...state.enabled],preset:state.preset}));
}
function ensureContext(){
if(state.context)return state.context;
const AC=window.AudioContext||window.webkitAudioContext;
if(!AC)throw new Error('Web Audio غير مدعوم على هذا الجهاز');
state.context=new AC();
state.master=state.context.createGain();
state.limiter=state.context.createDynamicsCompressor();
state.limiter.threshold.value=-9;state.limiter.knee.value=18;state.limiter.ratio.value=8;state.limiter.attack.value=.004;state.limiter.release.value=.28;
state.master.connect(state.limiter).connect(state.context.destination);
applyMaster(true);return state.context;
}
function resume(){const c=ensureContext();return c.state==='suspended'?c.resume():Promise.resolve()}
function noiseBuffer(kind='white',seconds=8){
const key=`${kind}:${seconds}`;if(state.buffers.has(key))return state.buffers.get(key);
const c=ensureContext(),len=Math.floor(c.sampleRate*seconds),b=c.createBuffer(1,len,c.sampleRate),d=b.getChannelData(0);
let last=0,b0=0,b1=0,b2=0;
for(let i=0;i<len;i++){
const w=Math.random()*2-1;
if(kind==='brown'){last=(last+.02*w)/1.02;d[i]=last*3.2}
else if(kind==='pink'){b0=.99765*b0+w*.099046;b1=.963*b1+w*.2965164;b2=.57*b2+w*1.0526913;d[i]=(b0+b1+b2+w*.1848)*.2}
else d[i]=w*.48;
}
state.buffers.set(key,b);return b;
}
function noise(kind='white'){const c=ensureContext(),s=c.createBufferSource();s.buffer=noiseBuffer(kind);s.loop=true;return s}
function chain(nodes,gain){const c=ensureContext(),g=c.createGain();g.gain.value=gain;let last=nodes[0];for(let i=1;i<nodes.length;i++){last.connect(nodes[i]);last=nodes[i]}last.connect(g).connect(state.master);return g}
function timer(key,fn,ms){const id=setTimeout(fn,ms);state.timers.set(key,id);return id}
function periodicBurst(layerKey,{min=6,max=16,thunder=false,lightning=false}={}){
const burst=()=>{
if(!state.enabled.has(layerKey))return;
const c=ensureContext(),now=c.currentTime,level=(state.levels[layerKey]||30)/100;
if(thunder){
const s=noise('brown'),f=c.createBiquadFilter(),g=c.createGain();f.type='lowpass';f.frequency.value=220+Math.random()*220;
g.gain.setValueAtTime(.001,now);g.gain.exponentialRampToValueAtTime(Math.max(.01,level*.82),now+.08);g.gain.exponentialRampToValueAtTime(.001,now+2.8+Math.random()*1.8);
s.connect(f).connect(g).connect(state.master);s.start(now);s.stop(now+5.2);
}
if(lightning){
const s=noise('white'),hi=c.createBiquadFilter(),g=c.createGain();hi.type='highpass';hi.frequency.value=2100;
g.gain.setValueAtTime(.001,now);g.gain.exponentialRampToValueAtTime(Math.max(.008,level*.46),now+.008);g.gain.exponentialRampToValueAtTime(.001,now+.12);
s.connect(hi).connect(g).connect(state.master);s.start(now);s.stop(now+.18);
}
};
const schedule=()=>{if(!state.enabled.has(layerKey))return;timer(layerKey,()=>{burst();schedule()},(min+Math.random()*(max-min))*1000)};
burst();schedule();
}
function chirp(key,{min=2.8,max=7.5,base=1500,spread=1200,level=.08}={}){
if(!state.enabled.has(key))return;
const c=ensureContext(),o=c.createOscillator(),g=c.createGain(),now=c.currentTime,v=(state.levels[key]||20)/100;
o.type='sine';o.frequency.setValueAtTime(base+Math.random()*spread,now);o.frequency.exponentialRampToValueAtTime(base+spread+Math.random()*900,now+.14);
g.gain.setValueAtTime(.001,now);g.gain.exponentialRampToValueAtTime(Math.max(.002,v*level),now+.02);g.gain.exponentialRampToValueAtTime(.001,now+.24);
o.connect(g).connect(state.master);o.start(now);o.stop(now+.27);timer(key,()=>chirp(key,{min,max,base,spread,level}),(min+Math.random()*(max-min))*1000);
}
function cricket(key){
if(!state.enabled.has(key))return;
const c=ensureContext(),now=c.currentTime,o=c.createOscillator(),g=c.createGain(),v=(state.levels[key]||20)/100;
o.type='sine';o.frequency.value=3900+Math.random()*500;g.gain.setValueAtTime(.001,now);
for(let i=0;i<5;i++){g.gain.linearRampToValueAtTime(v*.018,now+i*.055+.018);g.gain.linearRampToValueAtTime(.001,now+i*.055+.04)}
o.connect(g).connect(state.master);o.start(now);o.stop(now+.34);timer(key,()=>cricket(key),1200+Math.random()*3100);
}
function createLayer(key){
const c=ensureContext(),cfg=LAYERS[key],level=(state.levels[key]||cfg.level)/100,nodes=[];let gainNode=null;
if(key==='thunder'){periodicBurst(key,{min:9,max:22,thunder:true});return {nodes,gain:null}}
if(key==='lightning'){periodicBurst(key,{min:7,max:19,lightning:true});return {nodes,gain:null}}
if(key==='rain'){
const a=noise('white'),hp=c.createBiquadFilter(),lp=c.createBiquadFilter();hp.type='highpass';hp.frequency.value=900;lp.type='lowpass';lp.frequency.value=7600;gainNode=chain([a,hp,lp],level*cfg.scale);nodes.push(a);a.start();
}else if(key==='waves'){
const a=noise('brown'),lp=c.createBiquadFilter(),g=c.createGain(),osc=c.createOscillator(),lfo=c.createGain();lp.type='lowpass';lp.frequency.value=680;g.gain.value=.54;osc.frequency.value=.075;lfo.gain.value=.36;osc.connect(lfo).connect(g.gain);gainNode=chain([a,lp,g],level*cfg.scale);nodes.push(a,osc);a.start();osc.start();
}else if(key==='wind'){
const a=noise('pink'),bp=c.createBiquadFilter();bp.type='bandpass';bp.frequency.value=580;bp.Q.value=.65;gainNode=chain([a,bp],level*cfg.scale);nodes.push(a);a.start();
}else if(key==='river'){
const a=noise('white'),bp=c.createBiquadFilter(),lp=c.createBiquadFilter();bp.type='bandpass';bp.frequency.value=1450;bp.Q.value=.35;lp.type='lowpass';lp.frequency.value=5200;gainNode=chain([a,bp,lp],level*cfg.scale);nodes.push(a);a.start();
}else if(key==='fire'){
const a=noise('brown'),bp=c.createBiquadFilter();bp.type='bandpass';bp.frequency.value=720;bp.Q.value=.7;gainNode=chain([a,bp],level*cfg.scale);nodes.push(a);a.start();
}else if(key==='forest'){
const a=noise('pink'),lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=2100;gainNode=chain([a,lp],level*cfg.scale);nodes.push(a);a.start();chirp(key,{min:3,max:8,base:1450,spread:900,level:.075});
}else if(key==='night'){
const a=noise('pink'),lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1100;gainNode=chain([a,lp],level*cfg.scale);nodes.push(a);a.start();cricket(key);
}else if(key==='birds'){
const a=noise('pink'),lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1800;gainNode=chain([a,lp],level*.08);nodes.push(a);a.start();chirp(key,{min:1.7,max:4.8,base:1800,spread:1800,level:.12});
}else if(key==='cafe'){
const a=noise('pink'),bp=c.createBiquadFilter(),lp=c.createBiquadFilter();bp.type='bandpass';bp.frequency.value=920;bp.Q.value=.28;lp.type='lowpass';lp.frequency.value=3100;gainNode=chain([a,bp,lp],level*cfg.scale);nodes.push(a);a.start();
}else if(key==='fan'){
const a=noise('white'),lp=c.createBiquadFilter(),hum=c.createOscillator(),hg=c.createGain();lp.type='lowpass';lp.frequency.value=900;hum.type='sine';hum.frequency.value=58;hg.gain.value=level*.025;gainNode=chain([a,lp],level*cfg.scale);hum.connect(hg).connect(state.master);nodes.push(a,hum);a.start();hum.start();
}else if(key==='brown'){
const a=noise('brown'),lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1200;gainNode=chain([a,lp],level*cfg.scale);nodes.push(a);a.start();
}else if(key==='white'){
const a=noise('white'),lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=9000;gainNode=chain([a,lp],level*cfg.scale);nodes.push(a);a.start();
}
return {nodes,gain:gainNode};
}
function stopLayer(key){
const item=state.active.get(key);if(item){for(const n of item.nodes||[]){try{n.stop?.()}catch{}try{n.disconnect?.()}catch{}}try{item.gain?.disconnect()}catch{}state.active.delete(key)}
const t=state.timers.get(key);if(t){clearTimeout(t);state.timers.delete(key)}
}
async function setLayer(key,on,{manual=true}={}){
if(!LAYERS[key])return;if(manual)state.preset=null;
if(on){await resume();const was=state.enabled.has(key);state.enabled.add(key);if(!state.active.has(key)&&!LAYERS[key].periodic)state.active.set(key,createLayer(key));else if(LAYERS[key].periodic&&!was)createLayer(key)}
else{state.enabled.delete(key);stopLayer(key)}persist();render();
}
function setLayerLevel(key,value){
state.preset=null;state.levels[key]=+value;const item=state.active.get(key),cfg=LAYERS[key];if(item?.gain&&state.context)item.gain.gain.setTargetAtTime((+value/100)*(cfg.scale||1),state.context.currentTime,.05);persist();render();
}
function applyMaster(immediate=false){if(!state.master)return;const target=(state.masterLevel/100)*(state.narration&&state.ducking?state.duckLevel/100:1),now=state.context.currentTime;if(immediate)state.master.gain.setValueAtTime(target,now);else state.master.gain.setTargetAtTime(target,now,state.narration?.08:.45)}
function applyNarratorVolume(){const a=$('#audioElement');if(a)a.volume=Math.max(0,Math.min(1,state.narratorLevel/100))}
function setNarrationActive(active){state.narration=!!active;applyMaster();document.dispatchEvent(new CustomEvent('mafateeh:mixer-duck',{detail:{active:state.narration,ducking:state.ducking}}))}
function stopAll({keepPreset=false}={}){for(const key of [...state.enabled]){state.enabled.delete(key);stopLayer(key)}if(!keepPreset)state.preset=null;persist();render()}
async function applyPreset(key){
const p=PRESETS[key];if(!p)return;await resume();stopAll({keepPreset:true});state.preset=key;state.masterLevel=p.master;
for(const [layer,value] of Object.entries(p.layers)){state.levels[layer]=value;state.enabled.add(layer);if(LAYERS[layer].periodic)createLayer(layer);else state.active.set(layer,createLayer(layer))}
applyMaster();persist();render();
}
function splitSpeech(text,max=900){const clean=String(text||'').replace(/\s+/g,' ').trim();if(!clean)return[];const out=[];let rest=clean;while(rest.length>max){let cut=Math.max(rest.lastIndexOf('؟',max),rest.lastIndexOf('.',max),rest.lastIndexOf('!',max),rest.lastIndexOf('،',max));if(cut<max*.5)cut=rest.lastIndexOf(' ',max);if(cut<max*.4)cut=max;out.push(rest.slice(0,cut+1).trim());rest=rest.slice(cut+1).trim()}if(rest)out.push(rest);return out}
function deviceText(){const root=$('#page');if(!root)return'';const picked=['.chead h2','.keybox p','.prose','.sum'].map(s=>root.querySelector(s)?.innerText||'').filter(Boolean).join('\n');return picked||root.innerText||''}
function arabicVoice(){const voices=speechSynthesis.getVoices();return voices.find(v=>/^ar-SA/i.test(v.lang))||voices.find(v=>/^ar-EG/i.test(v.lang))||voices.find(v=>/^ar/i.test(v.lang))||null}
function stopDeviceVoice(){try{speechSynthesis.cancel()}catch{}state.deviceVoice=false;state.deviceQueue=[];state.deviceIndex=0;setNarrationActive(false);render()}
function speakNext(){
if(!state.deviceVoice||state.deviceIndex>=state.deviceQueue.length){stopDeviceVoice();return}
const u=new SpeechSynthesisUtterance(state.deviceQueue[state.deviceIndex++]);u.lang='ar-SA';const v=arabicVoice();if(v)u.voice=v;const rate=Number($('#audioRate')?.value||100)/100;u.rate=Math.max(.7,Math.min(1.45,rate));u.volume=Math.max(0,Math.min(1,state.narratorLevel/100));u.onend=speakNext;u.onerror=()=>stopDeviceVoice();speechSynthesis.speak(u)
}
function toggleDeviceVoice(){
if(!('speechSynthesis'in window)){alert('صوت الجهاز غير مدعوم في هذا المتصفح. استخدم Piper من مركز المكتبة الذكية.');return}
if(state.deviceVoice){stopDeviceVoice();return}
const text=deviceText();if(!text){alert('افتح فصلًا أولًا ثم جرّب القراءة بصوت الجهاز.');return}
state.deviceQueue=splitSpeech(text);state.deviceIndex=0;state.deviceVoice=true;setNarrationActive(true);render();speakNext();
}
function renderValues(){
$('#mxMasterVal')&&($('#mxMasterVal').textContent=state.masterLevel+'%');$('#mxNarratorVal')&&($('#mxNarratorVal').textContent=state.narratorLevel+'%');$('#mxDuckVal')&&($('#mxDuckVal').textContent=state.duckLevel+'%');
if($('#mxMaster'))$('#mxMaster').value=state.masterLevel;if($('#mxNarrator'))$('#mxNarrator').value=state.narratorLevel;if($('#mxDuck'))$('#mxDuck').value=state.duckLevel;
for(const key of Object.keys(LAYERS)){const el=$(`[data-mx-val="${key}"]`),range=$(`[data-mx-range="${key}"]`);if(el)el.textContent=state.levels[key]+'%';if(range)range.value=state.levels[key]}
}
function render(){
for(const key of Object.keys(LAYERS)){const b=$(`[data-mx-toggle="${key}"]`);if(b){b.classList.toggle('on',state.enabled.has(key));b.setAttribute('aria-pressed',String(state.enabled.has(key)))}}
$$('[data-mx-preset]').forEach(b=>b.classList.toggle('on',b.dataset.mxPreset===state.preset));$('#mxDucking')?.classList.toggle('on',state.ducking);
const dv=$('#mxDeviceVoice');if(dv){dv.classList.toggle('on',state.deviceVoice);dv.innerHTML=state.deviceVoice?'■ إيقاف صوت iPhone / الجهاز':'📱 قراءة الفصل بصوت iPhone / الجهاز'}renderValues();
}
function open(){try{if(typeof autoScrollPause==='function')autoScrollPause(true)}catch(_){}shade.classList.add('on');shade.setAttribute('aria-hidden','false');document.documentElement.classList.add('mixer-open');render();requestAnimationFrame(()=>window.MafateehMaster?.syncOverlay?.())}
function close(){shade.classList.remove('on');shade.setAttribute('aria-hidden','true');document.documentElement.classList.remove('mixer-open');requestAnimationFrame(()=>window.MafateehMaster?.syncOverlay?.())}
const rows=Object.entries(LAYERS).map(([key,l])=>`<div class="mx-layer"><button type="button" class="mx-toggle" data-mx-toggle="${key}" aria-pressed="false"><span>${l.icon}</span><b>${l.name}</b><i></i></button><label><input data-mx-range="${key}" type="range" min="0" max="100" step="1" value="${state.levels[key]}"><small data-mx-val="${key}">${state.levels[key]}%</small></label></div>`).join('');
const presets=Object.entries(PRESETS).map(([key,p])=>`<button type="button" data-mx-preset="${key}"><span>${p.icon}</span><b>${p.name}</b></button>`).join('');
document.body.insertAdjacentHTML('beforeend',`<button id="mixerDock" class="mixer-dock" type="button"><span>🎚️</span><b>Mix Pro</b></button><div id="mixerShade" class="mixer-shade" aria-hidden="true"><section class="mixer-sheet" role="dialog" aria-modal="true" aria-label="Mixer الصوت الاحترافي"><div class="mixer-handle"></div><header><div><h2>🎚️ Mixer الصوت Pro</h2><p>14 طبقة صوت · Presets · Ducking · Limiter · صوت الجهاز. يمكنك تشغيل أكثر من مؤثر معًا.</p></div><button id="mixerClose" type="button" aria-label="إغلاق">✕</button></header><div class="mx-master"><label><span>صوت الكتاب <b id="mxNarratorVal">${state.narratorLevel}%</b></span><input id="mxNarrator" type="range" min="0" max="100" value="${state.narratorLevel}"></label><label><span>مستوى الأجواء <b id="mxMasterVal">${state.masterLevel}%</b></span><input id="mxMaster" type="range" min="0" max="100" value="${state.masterLevel}"></label></div><div class="mx-section-title"><b>خلطات جاهزة</b><small>اختيار واحد يضبط عدة أصوات تلقائيًا</small></div><div class="mx-presets">${presets}</div><div class="mx-section-title"><b>طبقات الصوت</b><small>تحكم مستقل في كل مؤثر</small></div><div class="mx-grid">${rows}</div><div class="mx-device"><button id="mxDeviceVoice" type="button">📱 قراءة الفصل بصوت iPhone / الجهاز</button><small>حل مجاني مدمج بالنظام، ويعمل كاحتياطي إذا لم تكن تسجيلات الفصل متاحة.</small></div><div class="mx-duck"><button id="mxDucking" type="button"><span><b>🎙️ Ducking احترافي</b><small>اخفض المؤثرات تلقائيًا أثناء كلام الراوي ثم أعدها بسلاسة.</small></span><i></i></button><label><span>الأجواء أثناء الكلام <b id="mxDuckVal">${state.duckLevel}%</b></span><input id="mxDuck" type="range" min="8" max="70" value="${state.duckLevel}"></label></div><div class="mx-foot"><button id="mxStopAll" type="button">إيقاف المؤثرات</button><button id="mxDone" class="primary" type="button">تم</button></div></section></div>`);
const shade=$('#mixerShade');
const oldAmbiencePlay=$('#ambientSound');if(oldAmbiencePlay&&!$('#openProfessionalMixer')){oldAmbiencePlay.insertAdjacentHTML('afterend','<button id="openProfessionalMixer" type="button" class="ambience-play" style="margin-top:8px"><i>🎚️</i><span>فتح Mixer Pro</span><small>14 صوتًا + خلطات جاهزة + تحكم مستقل</small></button>');$('#openProfessionalMixer').onclick=open}
$('#mixerDock').onclick=open;$('#mixerClose').onclick=close;$('#mxDone').onclick=close;shade.onclick=e=>{if(e.target===shade)close()};
document.addEventListener('click',e=>{const layer=e.target.closest('[data-mx-toggle]');if(layer)setLayer(layer.dataset.mxToggle,!state.enabled.has(layer.dataset.mxToggle));const preset=e.target.closest('[data-mx-preset]');if(preset)applyPreset(preset.dataset.mxPreset)});
document.addEventListener('input',e=>{
if(e.target.matches('[data-mx-range]'))setLayerLevel(e.target.dataset.mxRange,e.target.value);
if(e.target.id==='mxMaster'){state.preset=null;state.masterLevel=+e.target.value;applyMaster();persist();render()}
if(e.target.id==='mxNarrator'){state.narratorLevel=+e.target.value;applyNarratorVolume();persist();render()}
if(e.target.id==='mxDuck'){state.duckLevel=+e.target.value;applyMaster();persist();render()}
});
$('#mxDucking').onclick=()=>{state.ducking=!state.ducking;applyMaster();persist();render()};$('#mxStopAll').onclick=()=>stopAll();$('#mxDeviceVoice').onclick=toggleDeviceVoice;
let audioFallbackLock=false;
const bookAudio=$('#audioElement');if(bookAudio){
bookAudio.addEventListener('playing',()=>{if(state.deviceVoice)stopDeviceVoice();applyNarratorVolume();setNarrationActive(true)});
bookAudio.addEventListener('pause',()=>{if(!state.deviceVoice)setNarrationActive(false)});
bookAudio.addEventListener('ended',()=>{if(!state.deviceVoice)setNarrationActive(false)});
bookAudio.addEventListener('error',()=>{
const src=String(bookAudio.currentSrc||bookAudio.src||'');
if(audioFallbackLock||state.deviceVoice||!/\/audio\/chapter-\d+\.mp3(?:$|\?)/i.test(src)||!('speechSynthesis'in window))return;
audioFallbackLock=true;setTimeout(()=>{audioFallbackLock=false;if(state.deviceVoice)return;const st=$('#audioStatus');if(st)st.textContent='التسجيل المحفوظ غير متاح — تم التحويل تلقائيًا إلى صوت iPhone / الجهاز';const mini=$('#audioMiniStatus');if(mini)mini.textContent='صوت الجهاز الاحتياطي';toggleDeviceVoice()},40);
});
applyNarratorVolume();
}
document.addEventListener('mafateeh:narration',e=>setNarrationActive(!!e.detail?.active));
window.MafateehMixer={open,close,setNarrationActive,setLayer,applyPreset,stopAll,toggleDeviceVoice,getNarratorVolume:()=>state.narratorLevel/100,setNarratorVolume:v=>{state.narratorLevel=Math.round(Math.max(0,Math.min(1,+v))*100);applyNarratorVolume();persist();render()},layers:LAYERS,presets:PRESETS};
if(state.enabled.size){const wanted=[...state.enabled];state.enabled.clear();const restore=async()=>{document.removeEventListener('pointerdown',restore,true);for(const key of wanted)await setLayer(key,true,{manual:false}).catch(()=>{});render()};document.addEventListener('pointerdown',restore,true)}
try{speechSynthesis?.getVoices?.();addEventListener('pagehide',stopDeviceVoice)}catch{}
})();
