import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { deepseekKoreanEnabled, DEEPSEEK_KOREAN_PROMPT, withDeepseekKoreanPrompt } from '../deepseek-korean.js';
import { minimalOutputEnabled } from '../minimal-output.js';
import { normalizeBaseTranslationCustom } from '../base-editor.js';
import { normalizePostReview, postReviewSettingsMarkup } from '../post-review.js';
import { segmentSource, buildOutputPrompt, buildScopedOutputPrompt, buildSelectionPrompt, buildMultiSelectionPrompt, buildInputPrompt } from '../core.js';
const settings = {
 developerMode:true,developerDeepseekKoreanEnabled:true,developerMinimalPromptEnabled:true,
 globalPromptEnabled:true,globalPrompt:'GLOBAL_SENTINEL',allDialoguePromptEnabled:true,allDialoguePrompt:'ALL_SENTINEL',
 dialoguePromptEnabled:true,dialoguePrompt:'TARGET_SENTINEL',otherDialoguePromptEnabled:true,otherDialoguePrompt:'OTHER_SENTINEL',
 englishFlavorEnabled:true,koreanFlavorEnabled:true,relationTemperatureEnabled:true,relationTemperature:'intimate',
 bannedWords:'금지표현',dialogueEndingPreferred:'ENDING_SENTINEL',translateTaggedContent:true,
};
const source='Dana smiled.\n\n"Come here."\n\n<Info_panel>Sunny</Info_panel>';
const segmented=segmentSource(source,[{source:'Dana',target:'다나'}]);
const identity={sourceCharacterName:'Chris',characterName:'크리스',sourceUserName:'Dana',userName:'다나'};
const prefix=withDeepseekKoreanPrompt('',settings);
const off=s=>({...s,developerDeepseekKoreanEnabled:false});
const selection=s=>({source,translation:'"이리 와."',selected:'이리 와.',start:1,end:6,settings:s,oneTimeInstruction:'ONETIME_SENTINEL',speakerIdentity:identity});
const builders=s=>[
 buildOutputPrompt(segmented,s,'ONETIME_SENTINEL',identity),
 buildScopedOutputPrompt({segments:segmented.segments,sourceContext:source,settings:s,scope:'target_dialogue',speakerIdentity:identity}),
 buildSelectionPrompt(selection(s)),buildSelectionPrompt({...selection(s),candidateCount:3}),
 buildMultiSelectionPrompt({...selection(s),selections:[{id:'multi_0000',selected:'이리 와.',start:1,end:6}]}),
];
test('developer gate and precedence over minimal mode do not alter saved settings',()=>{
 for(const developerMode of [false,true])for(const enabled of [false,true]){
  const s={...settings,developerMode,developerDeepseekKoreanEnabled:enabled},before=structuredClone(s);
  assert.equal(deepseekKoreanEnabled(s),enabled);
  assert.equal(minimalOutputEnabled(s),developerMode&&!enabled);
  assert.equal(buildOutputPrompt(segmented,s).includes(DEEPSEEK_KOREAN_PROMPT),enabled);
  assert.deepEqual(s,before);
 }
});
for(const [name,extra] of [
 ['ordinary tastes',{}],['compressed',{developerCompressedPromptEnabled:true}],['extreme compressed',{developerExtremeCompressedPromptEnabled:true}],
 ['custom output and selection',{customTranslatorEnabled:true,customTranslatorTemplates:{output:'CUSTOM_OUTPUT',selection:'CUSTOM_SELECTION'},customTranslatorModified:{output:true,selection:true}}],
 ['custom base',{baseTranslationCustom:{enabled:true,prompt:'CUSTOM_BASE'}}],
 ['Hongjin',{developerHongjinFlavorEnabled:true}],['MAD',{developerMadKoreanOutputEnabled:true,developerHongjinFlavorEnabled:true}],
 ['Galbwae',{chuseokGalbwaeScope:'all',developerMadKoreanOutputEnabled:true}],
 ['slots off',{globalPromptEnabled:false,allDialoguePromptEnabled:false,dialoguePromptEnabled:false,otherDialoguePromptEnabled:false}],
])test(`all long-form builders retain their ordinary composition: ${name}`,()=>{
 const s={...settings,...extra},before=structuredClone(s);
 const actual=builders(s),expected=builders(off(s));
 actual.forEach((p,i)=>{assert.ok(p.startsWith(prefix));assert.equal(p.slice(prefix.length),expected[i]);assert.equal(p.split(DEEPSEEK_KOREAN_PROMPT).length,2);});
 assert.deepEqual(s,before);
});
test('four active slots, one-time instructions and scoped switches still work',()=>{
 const p=buildOutputPrompt(segmented,settings,'ONETIME_SENTINEL',identity);
 for(const marker of ['GLOBAL_SENTINEL','ALL_SENTINEL','TARGET_SENTINEL','OTHER_SENTINEL','ONETIME_SENTINEL','ENDING_SENTINEL','금지표현'])assert.ok(p.includes(marker),marker);
 for(const key of ['globalPrompt','allDialoguePrompt','dialoguePrompt','otherDialoguePrompt'])assert.ok(!buildOutputPrompt(segmented,{...settings,[key+'Enabled']:false}).includes(settings[key]));
 for(const scope of ['narration','tagged_content','target_dialogue','other_dialogue']){
  const p=buildScopedOutputPrompt({segments:segmented.segments,settings,scope,speakerIdentity:identity});
  assert.equal(p.includes('TARGET_SENTINEL'),scope==='target_dialogue');assert.equal(p.includes('OTHER_SENTINEL'),scope==='other_dialogue');
 }
});
test('input and selected-only source bounds are unchanged',()=>{
 assert.equal(buildInputPrompt('안녕.',settings,'male',identity),buildInputPrompt('안녕.',off(settings),'male',identity));
 const opts={...selection(settings),source:'FULL_SOURCE_SENTINEL',sourceContext:'',contextMode:'selection'};
 assert.doesNotMatch(buildSelectionPrompt(opts),/FULL_SOURCE_SENTINEL/);
 assert.doesNotMatch(buildMultiSelectionPrompt({...opts,selections:[{id:'multi_0000',selected:'이리 와.',start:1,end:6,sourceContext:''}]}),/FULL_SOURCE_SENTINEL/);
});
const index=fs.readFileSync(new URL('../index.js',import.meta.url),'utf8');
const between=(a,b)=>{const start=index.indexOf(a),end=index.indexOf(b,start);assert.ok(start>=0&&end>start,a);return index.slice(start,end);};
const defs=between('const RELATION_TEMPERATURE_OPTIONS','const baseContext =');
const escapeHtml=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
test('promoted toggle is visible without developer mode and persists independently',()=>{
 const markup=Function('settings',between('function deepseekSettingsMarkup(', 'function syncDeveloperQualityControls(')+'\nreturn deepseekSettingsMarkup();');
 assert.match(markup({...settings,developerMode:false}),/id="verba-deep-deepseek-enabled" checked/);
 assert.doesNotMatch(markup({...settings,developerMode:false}),/영어 번역 프롬프트 보기|verba-deep-help|개발자/);
 class Input{};let saves=0,refreshes=0;const s={...settings,developerMode:false};
 const change=Function('target','settings','HTMLInputElement','saveSettings','document','renderCurrentAppliedRules',between("        if (target.id === 'verba-deep-deepseek-enabled'","        if (target.id === 'verba-deep-beginner-character-enabled'"));
 for(const checked of [false,true]){
  change(Object.assign(new Input(),{id:'verba-deep-deepseek-enabled',checked}),s,Input,()=>saves++,{querySelector:()=>({open:true})},()=>refreshes++);
  assert.deepEqual(s,{...settings,developerMode:false,developerDeepseekKoreanEnabled:checked});
 }
 assert.equal(saves,2);assert.equal(refreshes,2);
});
test('developer preset snapshot, normalize and restore keep the toggle',()=>{
 const factory=Function('normalizeBaseTranslationCustom','normalizePostReview',defs+'\n'+between('function normalizedPromptPresetDeveloperSettings(', 'function normalizedPromptPresetTranslationSettings(')+'\nconst settings=structuredClone(DEFAULT_SETTINGS);\n'+between('function applyPromptPresetDeveloperSettings(', 'function applyPromptPresetTranslationSettings(')+'\nreturn {settings,snapshot:currentPromptPresetDeveloperSettingsSnapshot,normalize:normalizedPromptPresetDeveloperSettings,apply:applyPromptPresetDeveloperSettings};');
 const api=factory(normalizeBaseTranslationCustom,normalizePostReview);
 assert.equal(api.settings.developerDeepseekKoreanEnabled,false);
 assert.equal(api.normalize({}).developerDeepseekKoreanEnabled,false);
 for(const value of [true,false]){
  api.settings.developerDeepseekKoreanEnabled=value;const snapshot=api.snapshot(api.settings);
  assert.equal(snapshot.developerDeepseekKoreanEnabled,value);
  api.settings.developerDeepseekKoreanEnabled=!value;assert.equal(api.apply(snapshot),true);assert.equal(api.settings.developerDeepseekKoreanEnabled,value);
 }
});
