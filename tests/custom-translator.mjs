import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildDefaultCustomTranslatorTemplates } from '../custom-translator-defaults.js';
import { buildOutputPrompt, buildScopedOutputPrompt, buildInputPrompt, buildSelectionPrompt, buildMultiSelectionPrompt, segmentSource } from '../core.js';
import { buildMinimalOutputPrompt } from '../minimal-output.js';

const index = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const defaults = buildDefaultCustomTranslatorTemplates();
const general = ['output', 'input', 'selection', 'flavor'];
for (const key of general) {
    assert.ok(defaults[key].length > 1000, `${key}: original prose is displayed in full, not a short summary`);
    assert.doesNotMatch(defaults[key], /SPEAKER ATTRIBUTION CONTEXT|TARGET CHARACTER GENDER|TARGET ADDRESSEE GENDER|NAME LOCK|@@VERBA|JSON|LEFT CONTEXT|RIGHT CONTEXT|PRIORITY \d|SCENE FACTS AND OUTPUT CONTRACT|Their saved values remain untouched/);
}
assert.match(defaults.output, /Interpret the source as discourse before wording it in Korean/);
assert.match(defaults.input, /KOREAN INTERNET \/ TEXTING SHORTHAND/);
assert.match(defaults.selection, /A retranslation request requires changed wording/);
assert.match(defaults.flavor, /SCENE-FIRST RECOMPOSITION/);

const normalizeStart = index.indexOf('function normalizeCustomTranslatorInstruction(');
const normalizeEnd = index.indexOf('const DEFAULT_SETTINGS =', normalizeStart);
const apiNormalize = Function('CUSTOM_TRANSLATOR_SIMPLE_MARKER', 'CUSTOM_TRANSLATOR_PROMPT_DEFINITIONS', 'DEFAULT_CUSTOM_TRANSLATOR_TEMPLATES', `${index.slice(normalizeStart, normalizeEnd)}\nreturn { normalizeCustomTranslatorSettings };`)(
    '[사용자 추가 지침]', Object.keys(defaults).map(key => ({ key })), defaults,
);
const customValues = {output:'Write terse Korean.',input:'Keep my casual English.',selection:'Keep the meaning; change the rhythm.',flavor:'Use my own Korean voice.',repair:'My saved repair preference.'};
for (const flags of [{},Object.fromEntries(Object.keys(customValues).map(key=>[key,true]))]) {
    const migrated = apiNormalize.normalizeCustomTranslatorSettings(customValues, flags);
    for (const [key,value] of Object.entries(customValues)) {
        assert.equal(migrated.templates[key],value);
        assert.equal(migrated.modified[key],true);
    }
    const reload = apiNormalize.normalizeCustomTranslatorSettings(JSON.parse(JSON.stringify(migrated.templates)), migrated.modified);
    assert.deepEqual(reload,migrated,'save/reload does not replace custom values with defaults');
}
const bundled=apiNormalize.normalizeCustomTranslatorSettings({output:'Old bundled prompt'}, {output:false});
assert.equal(bundled.templates.output,defaults.output);
assert.equal(bundled.modified.output,false);
const oldLong='My legacy custom rule.\nSPEAKER ATTRIBUTION CONTEXT\n- TARGET CHARACTER: "Old name"';
assert.equal(apiNormalize.normalizeCustomTranslatorSettings({output:oldLong},{output:true}).templates.output,oldLong);

const identity={characterName:'Nyen',userName:'혜담은',characterGender:'male',nameLocks:[{source:'Nyen',target:'니엔'}]};
const source='Nyen closed the door. "Come here," he said.\n<Info_panel>Sunny</Info_panel>';
const segmented=segmentSource(source,identity.nameLocks);
const base={globalPrompt:'GLOBAL_LIVE_RULE',allDialoguePrompt:'ALL_DIALOGUE_LIVE_RULE',dialoguePrompt:'TARGET_LIVE_RULE',otherDialoguePrompt:'OTHER_LIVE_RULE',bannedWords:'금지말',relationTemperature:'close',narrationLocalizationLevel:'native',dialogueLocalizationLevel:'balanced',developerRelationshipExperimentEnabled:true,developerTargetToUserAddress:'공주님',developerTargetToUserRegister:'jondaetmal'};
const settings={...base,customTranslatorEnabled:true,customTranslatorTemplates:customValues,customTranslatorModified:Object.fromEntries(general.map(key=>[key,true]))};
const output=buildOutputPrompt(segmented,settings,'ONE_TIME_LIVE_RULE',identity);
assert.equal(output.split(customValues.output).length-1,1);
assert.doesNotMatch(output,/Interpret the source as discourse before wording it in Korean/,'old base translation prose is replaced');
for(const value of ['GLOBAL_LIVE_RULE','ALL_DIALOGUE_LIVE_RULE','TARGET_LIVE_RULE','ONE_TIME_LIVE_RULE','Nyen','혜담은','니엔','금지말','NAME LOCK','SPEAKER ATTRIBUTION CONTEXT','Return exactly this schema:']) assert.ok(output.includes(value),value);
assert.deepEqual(JSON.parse(output.split('\nSEGMENTS\n').at(-1)).map(x=>x.text),segmented.segments.map(x=>x.text));
const scoped=buildScopedOutputPrompt({segments:segmented.segments.filter(x=>x.type==='dialogue_candidate'),sourceContext:source,settings,oneTimeInstruction:'ONE_TIME_LIVE_RULE',nameTokens:segmented.nameTokens,scope:'target_dialogue',speakerIdentity:identity});
for(const value of [customValues.output,'TARGET_LIVE_RULE','ALL_DIALOGUE_LIVE_RULE','GLOBAL_LIVE_RULE','공주님','NAME LOCK','Nyen','혜담은','SOURCE CONTEXT']) assert.ok(scoped.includes(value),value);

const input=buildInputPrompt('니엔, 이리 와.',settings,'male',{...identity,exactNamePairs:[{korean:'니엔',english:'Nyen'}]});
assert.equal(input.split(customValues.input).length-1,1);
assert.match(input,/TARGET ADDRESSEE GENDER\nmale/);
assert.match(input,/EXACT KOREAN → ENGLISH NAME SPELLINGS/);
assert.match(input,/Nyen/);
assert.doesNotMatch(input,/GLOBAL_LIVE_RULE|Write English that a fluent native speaker/);
assert.equal(JSON.parse(input.split('\nSOURCE\n').at(-1))[0].text,'니엔, 이리 와.');

const selected='문을 닫았다';
const selectionArgs={source,sourceContext:source,translation:'니엔은 문을 닫았다.',selected,start:4,end:11,settings,oneTimeInstruction:'SELECTION_ONCE',speakerIdentity:identity,candidateCount:3,contextMode:'paragraph'};
const selection=buildSelectionPrompt(selectionArgs);
for(const value of [customValues.selection,'SELECTION_ONCE','"candidates"','LEFT CONTEXT','RIGHT CONTEXT','ORIGINAL SOURCE CONTEXT','NAME LOCK','혜담은']) assert.ok(selection.includes(value),value);
assert.equal(selection.split(customValues.selection).length-1,1);
assert.doesNotMatch(selection,/Interpret the source as discourse before wording it in Korean/);
const multi=buildMultiSelectionPrompt({...selectionArgs,selections:[{id:'multi_0000',selected,start:4,end:11,sourceContext:source},{id:'multi_0001',selected:'니엔',start:0,end:2,sourceContext:source}]});
assert.equal(multi.split(customValues.selection).length-1,1);
assert.deepEqual(JSON.parse(multi.split('\nSELECTIONS\n').at(-1)).map(x=>x.id),['multi_0000','multi_0001']);

for(const flags of [{developerMadKoreanOutputEnabled:true},{developerHongjinFlavorEnabled:true},{developerMadKoreanOutputEnabled:true,developerHongjinFlavorEnabled:true}]) {
    const flavor=buildOutputPrompt(segmented,{...settings,...flags},'',identity);
    assert.equal(flavor.split(customValues.flavor).length-1,1,'flavor custom applies to the actual initial translation once');
    for(const value of ['Nyen','혜담은','NAME LOCK','금지말','Return exactly this schema:']) assert.ok(flavor.includes(value),value);
    if(flags.developerMadKoreanOutputEnabled) assert.doesNotMatch(flavor,/SCENE-FIRST RECOMPOSITION: source text is scene evidence/);
}
assert.doesNotMatch(output,/Use my own Korean voice/,'disabled taste does not inject flavor custom');
const galbwae=buildOutputPrompt(segmented,{...settings,chuseokGalbwaeScope:'all'},'',identity);
for(const value of Object.values(customValues)) assert.ok(!galbwae.includes(value),'exclusive Galbwae retains its existing isolation');
const galbwaeSelection=buildSelectionPrompt({...selectionArgs,settings:{...settings,chuseokGalbwaeScope:'all'}});
assert.ok(!galbwaeSelection.includes(customValues.selection));
const galbwaeInput=buildInputPrompt('이리 와.',{...settings,chuseokGalbwaeScope:'all'},'male',identity);
assert.ok(galbwaeInput.includes(customValues.input),'output taste does not suppress input customization');
for (const scope of ['narration','other_dialogue','tagged_content']) {
    const scopedFlavor=buildScopedOutputPrompt({segments:segmented.segments,sourceContext:source,settings:{...settings,developerHongjinFlavorEnabled:true},nameTokens:segmented.nameTokens,scope,speakerIdentity:identity});
    assert.ok(!scopedFlavor.includes(customValues.flavor),`Hongjin customization stays out of ${scope}`);
}
const exactSaved='  My exact saved custom text.\n\n';
assert.equal(apiNormalize.normalizeCustomTranslatorSettings({output:exactSaved},{output:true}).templates.output,exactSaved);
const minimal=buildMinimalOutputPrompt(segmented.segments,settings,segmented.nameTokens,'MINIMAL_ONCE');
for(const value of [customValues.output,'JSON only','MINIMAL_ONCE','TARGETS']) assert.ok(minimal.includes(value));

const start=index.indexOf('function customTranslatorPromptKey('), end=index.indexOf('function sendProfileRaceAttempt(',start);
const outgoing=Function('settings',`${index.slice(start,end)}\nreturn applyCustomTranslatorPrompt;`)(settings);
assert.equal(outgoing(output,{stage:'output-translation'}),output,'transport must not rebuild or discard composed requests');
assert.equal(outgoing(selection,{stage:'selection-candidates'}),selection);
assert.equal(outgoing(input,{stage:'input-translation'}),input);
assert.match(outgoing('LIVE_REPAIR_CONTEXT',{stage:'protected-token-repair'}),/My saved repair preference\.[\s\S]*LIVE_REPAIR_CONTEXT/);

const ui=index.slice(index.indexOf('function customTranslatorSettingsMarkup('),index.indexOf('function syncCustomTranslatorControls('));
assert.match(ui,/new Set\(\['output', 'input', 'selection', 'flavor'\]\)/);
assert.doesNotMatch(ui,/advancedFields|고급 내부 항목|custom-translator-advanced/);
assert.match(ui,/기존 영어 번역 지침 원문/);
assert.match(ui,/그 부분만 교체/);
assert.match(ui,/수정한 내용은 업데이트 후에도 그대로 유지/);
console.log('PASS: four original-prose editors; custom replacement preserves dynamic settings, identities, names, payloads, selection contexts and schemas; legacy saved values survive update/reload.');
