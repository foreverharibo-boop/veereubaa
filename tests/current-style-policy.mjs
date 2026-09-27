import assert from 'node:assert/strict';
import { buildScopedOutputPrompt, buildInputPrompt } from '../core.js';
import { settings, identity, segments } from './helpers/taste-fixtures.js';
for (const flags of [{}, {developerMode:true,developerCompressedPromptEnabled:true}, {developerMode:true,developerExtremeCompressedPromptEnabled:true}]) {
 const config={...settings,...flags};
 const build=(extra={},scope='target_dialogue')=>buildScopedOutputPrompt({segments,settings:{...config,...extra},scope,speakerIdentity:identity});
 const mad=build({developerHongjinFlavorEnabled:false});
 assert.match(mad,/SCENE-FIRST RECOMPOSITION/);
 assert.match(mad,/actor→action→target/);
 assert.match(mad,/consent/);
 if(!flags.developerMode) assert.match(mad,/Preserve intensity both ways/);
 else assert.match(mad,/force/);
 if(!flags.developerExtremeCompressedPromptEnabled) {
  assert.match(mad,/OMIT ONLY WHEN MORE NATURAL/);
  assert.match(mad,/Mere recoverability is insufficient/);
 }
 assert.match(mad,/source ellipsis|SOURCE ELLIPSIS/);
 assert.doesNotMatch(mad,/DEEPSEEK V4\.1 FLASH/);
 const both=build();
 assert.match(both,/Surface profanity may be stronger|Voice may add compatible|Profanity:/i);
 assert.match(both,/USER-DIRECTED PROFANITY GUARD/);
 for(const scope of ['narration','other_dialogue','tagged_content']) {
  const p=build({},scope);
  assert.doesNotMatch(p,/DEVELOPER KIM HONGJIN FLAVOR|KIM HONG-JIN VOICE — ULTRA|KIM HONG-JIN FLAVOR — TARGET/);
 }
 assert.doesNotMatch(buildInputPrompt('안녕',config,'male',identity),/SCENE-FIRST RECOMPOSITION/);
 for(const key of ['developerHongjinProfanity','developerHongjinTeasing','developerHongjinVulgarity','developerHongjinPlayfulness']) {
  const values={developerHongjinProfanity:['low','high'],developerHongjinTeasing:['light','active'],developerHongjinVulgarity:['restrained','open'],developerHongjinPlayfulness:['low','high']}[key];
  assert.notEqual(build({[key]:values[0]}),build({[key]:values[1]}),key);
 }
}
console.log('PASS: current long MAD recomposition, conditional subject omission, force fidelity, Hongjin override/controls and scope isolation across compression modes.');
