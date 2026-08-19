/* Mafateeh v36.4 — dedicated mobile audio modal touch guard.
   Owns vertical gestures before legacy document-level handlers can route them to the book. */
(function(){
'use strict';
const $=s=>document.querySelector(s);
let shade=null,sheet=null,open=false,tracking=false,startY=0,startX=0,startScroll=0,startTarget=null;
const isOpen=()=>!!(shade&&shade.classList.contains('on'));
const interactive=el=>!!el?.closest?.('input,button,select,textarea,a,[contenteditable="true"]');

function enforce(){
  shade=$('#audioShade');sheet=$('#audioSheet');if(!shade||!sheet)return;
  open=isOpen();
  if(open){
    shade.style.setProperty('position','fixed','important');
    shade.style.setProperty('inset','0','important');
    shade.style.setProperty('overflow','hidden','important');
    shade.style.setProperty('touch-action','none','important');
    shade.style.setProperty('overscroll-behavior','none','important');
    shade.style.setProperty('display','flex','important');
    shade.style.setProperty('align-items','flex-end','important');
    sheet.style.setProperty('height','min(92dvh,calc(var(--mk-vvh,100dvh) - 8px))','important');
    sheet.style.setProperty('max-height','min(92dvh,calc(var(--mk-vvh,100dvh) - 8px))','important');
    sheet.style.setProperty('min-height','0','important');
    sheet.style.setProperty('overflow-y','auto','important');
    sheet.style.setProperty('overflow-x','hidden','important');
    sheet.style.setProperty('-webkit-overflow-scrolling','touch','important');
    sheet.style.setProperty('overscroll-behavior-y','contain','important');
    sheet.style.setProperty('touch-action','none','important');
  }else tracking=false;
}

function begin(e){
  if(!isOpen()||e.touches?.length!==1)return;
  const t=e.touches[0];tracking=true;startY=t.clientY;startX=t.clientX;startScroll=sheet?.scrollTop||0;startTarget=e.target;
}
function move(e){
  if(!isOpen()||e.touches?.length!==1)return;
  if(!tracking)begin(e);
  const t=e.touches[0],dx=t.clientX-startX,dy=t.clientY-startY;
  // Keep horizontal range-slider gestures usable; vertical gestures always belong to the sheet.
  if(interactive(startTarget)&&Math.abs(dx)>Math.abs(dy)*1.2)return;
  if(sheet){
    const max=Math.max(0,sheet.scrollHeight-sheet.clientHeight);
    const next=Math.max(0,Math.min(max,startScroll-dy));
    if(Math.abs(sheet.scrollTop-next)>.1)sheet.scrollTop=next;
  }
  e.preventDefault();
  e.stopImmediatePropagation();
}
function end(){tracking=false;startTarget=null;}

function init(){
  shade=$('#audioShade');sheet=$('#audioSheet');if(!shade||!sheet)return false;
  new MutationObserver(enforce).observe(shade,{attributes:true,attributeFilter:['class','aria-hidden','style']});
  enforce();
  return true;
}

// Window capture runs before the legacy document capture handlers.
window.addEventListener('touchstart',begin,{capture:true,passive:true});
window.addEventListener('touchmove',move,{capture:true,passive:false});
window.addEventListener('touchend',end,{capture:true,passive:true});
window.addEventListener('touchcancel',end,{capture:true,passive:true});
window.addEventListener('resize',()=>{if(isOpen())enforce()},{passive:true});

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{if(!init()){const m=new MutationObserver(()=>{if(init())m.disconnect()});m.observe(document.body,{subtree:true,childList:true})}},{once:true});
else if(!init()){const m=new MutationObserver(()=>{if(init())m.disconnect()});m.observe(document.body,{subtree:true,childList:true})}
})();
