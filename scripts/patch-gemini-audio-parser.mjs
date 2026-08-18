import { readFile, writeFile } from 'node:fs/promises';

const file = 'scripts/generate-saved-audiobook.mjs';
let source = await readFile(file, 'utf8');

const oldFn = `function extractAudio(result){if(result?.output_audio?.data)return{data:result.output_audio.data,rate:Number(result.output_audio.sample_rate||24000)};if(result?.outputAudio?.data)return{data:result.outputAudio.data,rate:Number(result.outputAudio.sampleRate||24000)};const item=result?.steps?.slice?.().reverse().flatMap(s=>s?.type==='model_output'?(s.content||[]):[]).find(x=>x?.type==='audio'&&x?.data);return item?{data:item.data,rate:24000}:null}`;

const newFn = `function extractAudio(result){
  if(result?.output_audio?.data)return{data:result.output_audio.data,rate:Number(result.output_audio.sample_rate||24000)};
  if(result?.outputAudio?.data)return{data:result.outputAudio.data,rate:Number(result.outputAudio.sampleRate||24000)};
  const seen=new Set();
  function walk(node){
    if(!node||typeof node!=='object'||seen.has(node))return null;
    seen.add(node);
    if(typeof node.data==='string'){
      const type=String(node.type||node.mime_type||node.mimeType||'').toLowerCase();
      if(type.includes('audio')) return {data:node.data,rate:Number(node.sample_rate||node.sampleRate||24000)};
    }
    if(node.inline_data?.data||node.inlineData?.data){
      const x=node.inline_data||node.inlineData;
      const type=String(x.mime_type||x.mimeType||'').toLowerCase();
      if(type.includes('audio')) return {data:x.data,rate:Number(x.sample_rate||x.sampleRate||24000)};
    }
    if(Array.isArray(node)){
      for(let i=node.length-1;i>=0;i--){const hit=walk(node[i]);if(hit)return hit;}
      return null;
    }
    for(const key of ['content','parts','output','outputs','steps','response','result']){
      if(node[key]!==undefined){const hit=walk(node[key]);if(hit)return hit;}
    }
    for(const value of Object.values(node)){
      const hit=walk(value);if(hit)return hit;
    }
    return null;
  }
  return walk(result);
}`;

if (!source.includes(oldFn)) {
  if (source.includes('function extractAudio(result){\n  if(result?.output_audio?.data)')) {
    console.log('Gemini audio parser already patched.');
    process.exit(0);
  }
  throw new Error('Expected legacy extractAudio() implementation was not found.');
}

source = source.replace(oldFn, newFn);
await writeFile(file, source);
console.log('Patched Gemini TTS parser to recursively extract audio from model_output/content/parts.');
