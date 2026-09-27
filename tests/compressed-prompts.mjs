import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as core from '../core.js';
import { normalizeBaseTranslationCustom } from '../base-editor.js';

// No API calls, credentials, browser state, or settings writes.
const index = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const definitions = index.slice(index.indexOf('const RELATION_TEMPERATURE_OPTIONS'), index.indexOf('const baseContext ='));
const defaults = Function(definitions + '\nreturn DEFAULT_SETTINGS;')();
const identity = { characterName: 'CHAR_ID_SENTINEL', userName: 'USER_ID_SENTINEL', characterGender: 'male' };
const segmented = { segments: [
    { id: 'seg_0000', type: 'narration', text: '' },
    { id: 'seg_0001', type: 'dialogue_candidate', text: '""' },
], nameTokens: [] };
const translations = new Map(segmented.segments.map(s => [s.id, '']));
const selectionArgs = { source: '', translation: '""', selected: '""', start: 0, end: 2, speakerIdentity: identity };
const multiArgs = { source: '', translation: '""', selections: [{ id: 'm0', selected: '""', start: 0, end: 2 }], speakerIdentity: identity };
const builders = {
    full: (m, s) => m.buildOutputPrompt(segmented, s, '', identity),
    ...Object.fromEntries(['narration', 'target_dialogue', 'other_dialogue', 'tagged_content'].map(scope => [scope,
        (m, s) => m.buildScopedOutputPrompt({ segments: segmented.segments, sourceContext: '', settings: s, scope, speakerIdentity: identity })])),
    input: (m, s) => m.buildInputPrompt('', s, 'male', identity),
    selection: (m, s) => m.buildSelectionPrompt({ ...selectionArgs, translation: '', selected: '', end: 0, settings: s }),
    selectionDialogue: (m, s) => m.buildSelectionPrompt({ ...selectionArgs, settings: s }),
    selectionCandidates: (m, s) => m.buildSelectionPrompt({ ...selectionArgs, settings: s, candidateCount: 3 }),
    multi: (m, s) => m.buildMultiSelectionPrompt({ ...multiArgs, settings: s }),
    qa: (m, s) => m.buildQualityAuditPrompt({ segments: segmented.segments, currentTranslations: translations,
        sourceContext: '', settings: s, speakerIdentity: identity, enabledChecks: ['meaning', 'referent', 'voice', 'translationese', 'continuity'] }),
    bannedRepair: (m, s) => m.buildBannedRepairPrompt(segmented.segments, translations, s, identity),
    tokenRepair: (m, s) => m.buildProtectedTokenRepairPrompt(segmented.segments, translations, s, identity),
    untranslatedRepair: (m, s) => m.buildUntranslatedRepairPrompt(segmented.segments, translations, s, identity),
    termRepair: (m, s) => m.buildTermConsistencyRepairPrompt({ rows: [], terms: [], settings: s }),
    rolePlan: (m, s) => m.buildRoleTermPlanPrompt({ sourceContext: '', terms: [], settings: s }),
    attribution: (m) => m.buildSpeakerAttributionPrompt(segmented, identity),
    nameMatch: (m) => m.buildNameMatchPrompt(selectionArgs),
    nameHistory: (m) => m.buildNameHistoryFormsPrompt({ sourceName: '', currentName: '', candidates: [] }),
};
const baseline = null; // fixture boundary used by source-policy-update.mjs
let checks=0;
for(const flags of [{},{developerMadKoreanOutputEnabled:true},{developerHongjinFlavorEnabled:true},{developerMadKoreanOutputEnabled:true,developerHongjinFlavorEnabled:true}]) {
 for(const [name,build] of Object.entries(builders)) {
  const base={...defaults,...flags,developerMode:true};
  const full=build(core,base);
  for(const key of ['developerCompressedPromptEnabled','developerExtremeCompressedPromptEnabled']) {
   const compact=build(core,{...base,[key]:true});
   assert.ok(compact.trim(),name);
   assert.equal(build(core,{...base,developerMode:false,[key]:true}),build(core,{...base,developerMode:false}),name+' developer gate');
   if(name==='full' && flags.developerMadKoreanOutputEnabled) assert.ok(compact.length<full.length,'MAD compression actually shortens policy');
   checks++;
  }
 }
}
console.log('PASS: '+checks+' current compression routes and developer gates, with original builder fixtures.');
