import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const master=read('public/reader-master-fixes.js');
const reader=read('public/reader.html');
const smart=read('public/reader-smart-suite.css');
const mixer=read('public/reader-mixer.css');
const manifest=read('public/manifest.webmanifest');
const version=JSON.parse(read('public/master-version.json'));

const checks=[
  [version.version==='34.0.0','master version is 34.0.0'],
  [master.includes("const VERSION='34.0.0';"),'runtime version is 34'],
  [!master.includes("body.mk-overlay-open{overflow:hidden"),'body overlay CSS does not disable scrolling'],
  [!master.includes("h.style.overflow='hidden'"),'documentElement overflow lock removed'],
  [!master.includes("b.style.touchAction='none'"),'body touch-action lock removed'],
  [master.includes('Mafateeh iOS direct-scroll fallback v34'),'direct iOS modal scroll fallback exists'],
  [master.includes('primaryOverlayScroller'),'fallback can select the active modal scroller'],
  [reader.includes('document.scrollingElement||document.documentElement'),'auto-scroll uses the real scrolling element'],
  [reader.includes('window.visualViewport?.height||window.innerHeight'),'auto-scroll uses visual viewport on Safari'],
  [reader.includes("behavior:'instant'"),'auto-scroll stays instant'],
  [/"no"\s*:\s*46/.test(reader),'modified chapter 46 is present'],
  [smart.includes('Master v34 — Safari/iPhone scroll stability'),'smart modal v34 CSS exists'],
  [mixer.includes('Master v34 — Safari/iPhone scroll stability'),'mixer modal v34 CSS exists'],
  [manifest.includes('"start_url": "/reader.html?v=34"'),'PWA start URL is v34'],
];
let failed=false;
for(const [ok,label] of checks){console.log(`${ok?'PASS':'FAIL'}: ${label}`);if(!ok)failed=true}
if(failed)process.exit(1);
console.log('v34 scroll regression checks passed.');
