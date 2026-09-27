import assert from 'node:assert/strict';
import { buildScopedOutputPrompt,buildInputPrompt } from '../core.js';
import { segments,settings,identity } from './helpers/taste-fixtures.js';
for(const scope of ['target_dialogue','narration','other_dialogue','tagged_content']) {
 const p=buildScopedOutputPrompt({segments,settings,scope,speakerIdentity:identity,sourceContext:''});
 assert.equal(p.includes('DEVELOPER KIM HONGJIN FLAVOR'),scope==='target_dialogue');
 if(scope==='target_dialogue')for(const control of ['PROFANITY — HIGH','TEASING / NEEDLING — ACTIVE','VULGAR VOICE — OPEN','PLAYFULNESS — HIGH','AGE VOICE — LATE TWENTIES'])assert.ok(p.includes(control),control);
}
assert.doesNotMatch(buildInputPrompt('안녕',settings,'male',identity),/DEVELOPER KIM HONGJIN FLAVOR/);
console.log('PASS: concise voice control values and speaker/input isolation.');
