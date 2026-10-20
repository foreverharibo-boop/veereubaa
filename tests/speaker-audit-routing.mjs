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
 isAbort:e=>e.name==='AbortError',console:{warn(){}}};
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

// Use only real production diagnostic names. A stub for an undeclared
// debugCaptureError previously hid the ReferenceError in the failure test.
assert.doesNotMatch(index, /debugCaptureError/);
for (const debugMode of [false, true]) {
 for (const diagnosticFailure of [false, true]) {
  const original = Object.assign(new Error('original classification error'), { code: 'PROVIDER_FAILURE' });
  const cache = new Map();
  let calls = 0, diagnosticCalls = 0, stored = null;
  const env = {
   settings: { debugMode, dialoguePrompt: 'Keep character voice.' },
   googleFreeEngineEnabled: () => false, madKoreanExclusiveMode: () => false,
   speakerAttributionCache: cache, speakerAttributionCacheKey: () => 'key',
   setBoundedCache: (map, key, value) => map.set(key, value),
   buildSpeakerAttributionPrompt: () => 'classify',
   requestSegments: async () => {
    calls++;
    if (calls === 1) throw original;
    return new Map([['t', 'target'], ['o', 'other']]);
   },
   isAbort: error => error.name === 'AbortError', console: { warn() {} },
   createDebugDiagnostic: (stage, error) => {
    diagnosticCalls++;
    assert.equal(stage, 'speaker-attribution'); assert.equal(error, original);
    return { stage, error };
   },
   storeDebugDiagnostic: value => {
    if (diagnosticFailure) throw Error('diagnostic UI unavailable');
    stored = value;
   },
  };
  const classify = Function(...Object.keys(env), code + ';return classifyOutputDialogueSpeakers;')(...Object.values(env));
  assert.deepEqual(await classify(segmented, {}), { t: 'other_dialogue', o: 'other_dialogue' });
  assert.equal(cache.size, 0, 'do not cache a failed attribution');
  assert.equal(diagnosticCalls, debugMode ? 1 : 0);
  if (debugMode && !diagnosticFailure) assert.equal(stored.error, original);
  assert.deepEqual(await classify(segmented, {}), { t: 'target_dialogue', o: 'other_dialogue' });
  assert.equal(calls, 2, 'a later translation can retry attribution');
  assert.equal(cache.size, 1);
 }
}
const abort = new DOMException('cancelled', 'AbortError');
const cancelEnv = {
 settings: { debugMode: true, dialoguePrompt: 'voice' },
 googleFreeEngineEnabled: () => false, madKoreanExclusiveMode: () => false,
 speakerAttributionCache: new Map(), speakerAttributionCacheKey: () => 'key',
 buildSpeakerAttributionPrompt: () => 'classify', requestSegments: async () => { throw abort; },
 isAbort: error => error.name === 'AbortError',
 console: { warn() { throw Error('abort must not reach fallback'); } },
 createDebugDiagnostic: () => { throw Error('abort must not be logged'); },
};
const cancelClassify = Function(...Object.keys(cancelEnv), code + ';return classifyOutputDialogueSpeakers;')(...Object.values(cancelEnv));
await assert.rejects(cancelClassify(segmented, {}), error => error === abort);
console.log('PASS: actual speaker failure fallback with debug OFF/ON, diagnostic failure isolation, preserved original error, retry cache and cancellation.');
