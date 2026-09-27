import assert from 'node:assert/strict';
import fs from 'node:fs';
const index=fs.readFileSync(new URL('../index.js',import.meta.url),'utf8');
const code=index.slice(index.indexOf('async function classifyOutputDialogueSpeakers('),index.indexOf('async function requestScopedGroupTranslations('));
const segmented={segments:[{id:'t',type:'dialogue_candidate',text:'"Wait."'},{id:'o',type:'dialogue_candidate',text:'"No."'}]};
for(const response of ['valid','failed','unknown']) {
 let calls=0;
 const cache=new Map();
 const env={settings:{},googleFreeEngineEnabled:()=>false,madKoreanExclusiveMode:()=>true,speakerAttributionCache:cache,
 speakerAttributionCacheKey:()=> 'key',setBoundedCache:(m,k,v)=>m.set(k,v),buildSpeakerAttributionPrompt:()=> 'classify',
 requestSegments:async()=>{calls++;if(response==='failed')throw Error('mock provider failure');return new Map([['t',response==='valid'?'target':'unknown'],['o','other']]);},
 isAbort:e=>e.name==='AbortError',console:{warn(){}},debugCaptureError:()=>{}};
 const classify=Function(...Object.keys(env),code+';return classifyOutputDialogueSpeakers;')(...Object.values(env));
 assert.deepEqual(await classify(segmented,{}),{t:'other_dialogue',o:'other_dialogue'});
 assert.equal(calls,0,'ordinary MAD path unchanged');
 const scopes=await classify(segmented,{}, {forceTasteAuditSpeakerIsolation:true});
 assert.equal(calls,1);
 assert.equal(scopes.t,response==='valid'?'target_dialogue':'other_dialogue');
 assert.equal(scopes.o,'other_dialogue');
 if(response==='failed')assert.equal(cache.size,0,'failed classification must not poison retry cache');
}
console.log('PASS: dormant audit can classify speakers when explicitly enabled; unknown/failure never grants Hongjin voice. Ordinary MAD routing unchanged.');
