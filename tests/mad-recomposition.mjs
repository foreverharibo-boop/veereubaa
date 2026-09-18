import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as core from '../core.js';

const index = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const defs = index.slice(index.indexOf('const RELATION_TEMPERATURE_OPTIONS'), index.indexOf('const baseContext ='));
const defaults = Function(defs + '\nreturn DEFAULT_SETTINGS;')();
const identity = { characterName: '김홍진', userName: '담은', characterGender: 'male', nameLocks: [] };
const segmented = core.segmentSource('He looked behind them. "Move. Now."');
const translations = new Map(segmented.segments.map(row => [row.id, '번역']));
const settings = {
    ...defaults,
    developerMadKoreanOutputEnabled: true,
    developerHongjinFlavorEnabled: true,
    developerHongjinProfanity: 'high',
};

const builders = {
    output: () => core.buildOutputPrompt(segmented, settings, '', identity),
    narration: () => core.buildScopedOutputPrompt({ segments: segmented.segments, sourceContext: '', settings, scope: 'narration', speakerIdentity: identity }),
    targetDialogue: () => core.buildScopedOutputPrompt({ segments: segmented.segments, sourceContext: '', settings, scope: 'target_dialogue', speakerIdentity: identity }),
    otherDialogue: () => core.buildScopedOutputPrompt({ segments: segmented.segments, sourceContext: '', settings, scope: 'other_dialogue', speakerIdentity: identity }),
    selection: () => core.buildSelectionPrompt({ source: '', translation: '"번역"', selected: '"번역"', start: 0, end: 4, settings, speakerIdentity: identity }),
    multiSelection: () => core.buildMultiSelectionPrompt({ source: '', translation: '"번역"', selections: [{ id: 'm0', selected: '"번역"', start: 0, end: 4 }], settings, speakerIdentity: identity }),
    qualityAudit: () => core.buildQualityAuditPrompt({ segments: segmented.segments, currentTranslations: translations, sourceContext: '', settings, speakerIdentity: identity, enabledChecks: ['meaning', 'voice', 'translationese'] }),
    bannedRepair: () => core.buildBannedRepairPrompt(segmented.segments, translations, settings, identity),
    tokenRepair: () => core.buildProtectedTokenRepairPrompt(segmented.segments, translations, settings, identity),
    untranslatedRepair: () => core.buildUntranslatedRepairPrompt(segmented.segments, translations, settings, identity),
};

let checks = 0;
for (const [name, build] of Object.entries(builders)) {
    const prompt = build();
    assert.equal(prompt.split('SHORT MANDATORY KOREAN REAUTHORING CONTRACT').length - 1, 1, `${name}: one contract`);
    assert.match(prompt, /SCENE-FIRST RECOMPOSITION: SOURCE IS SCENE EVIDENCE, NOT A WORDING TEMPLATE/);
    assert.match(prompt, /silently resolve facts and referents/);
    assert.match(prompt, /compose original Korean/);
    assert.match(prompt, /audit the finished Korean for broken grammar, missing syllables\/words/);
    assert.match(prompt, /actor→action→target/);
    assert.match(prompt, /behind them.*back of the head/);
    assert.match(prompt, /NARRATION: reconstruct paragraph focus/);
    assert.match(prompt, /Do not mirror English clauses/);
    assert.match(prompt, /DIALOGUE: write what this speaker would actually say aloud/);
    assert.match(prompt, /공기가 얇다/);
    assert.match(prompt, /작은 숨 헐떡임/);
    assert.match(prompt, /담은이 몸집/);
    assert.match(prompt, /English “ramp” means 경사로\/진입로/);
    assert.match(prompt, /BANNED KOREAN WORDS/);
    checks += 14;
}

const narration = builders.narration();
const target = builders.targetDialogue();
const other = builders.otherDialogue();
assert.doesNotMatch(narration, /DIVERSE VOICE MODELS/);
assert.match(target, /DIVERSE VOICE MODELS/);
assert.doesNotMatch(other, /DIVERSE VOICE MODELS/);
assert.match(target, /Urgent command/);
assert.match(target, /Rough concern/);
assert.match(target, /Protective warning/);
assert.match(target, /Annoyed correction/);
assert.match(target, /Time pressure/);
assert.match(target, /Defiant reassurance/);
assert.match(target, /Dismissal/);
assert.match(target, /Rough 존댓말/);
assert.match(target, /Contextual expletive choice/);

const off = core.buildOutputPrompt(segmented, { ...settings, developerMadKoreanOutputEnabled: false }, '', identity);
assert.doesNotMatch(off, /SHORT MANDATORY KOREAN REAUTHORING CONTRACT/);
assert.doesNotMatch(core.buildInputPrompt('안녕', settings, 'male', identity), /SHORT MANDATORY KOREAN REAUTHORING CONTRACT/);

console.log(`PASS: Flash-optimized Mad Korean recomposition contract, corruption audit, scoped narration/dialogue rules, and diverse Hongjin examples (${checks + 14} checks).`);
