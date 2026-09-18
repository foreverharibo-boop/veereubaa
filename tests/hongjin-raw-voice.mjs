import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as core from '../core.js';

const index = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const defs = index.slice(index.indexOf('const RELATION_TEMPERATURE_OPTIONS'), index.indexOf('const baseContext ='));
const defaults = Function(defs + '\nreturn DEFAULT_SETTINGS;')();
const identity = { characterName: '김홍진', userName: '담은', characterGender: 'male' };
const segments = [{ id: 'seg_0000', type: 'dialogue_candidate', text: '"Move. Now."' }];
const settings = {
    ...defaults,
    developerMadKoreanOutputEnabled: true,
    developerHongjinFlavorEnabled: true,
    developerHongjinTranscreation: 'maximum',
    developerHongjinProfanity: 'high',
    developerHongjinTeasing: 'active',
    developerHongjinVulgarity: 'open',
    developerHongjinPlayfulness: 'high',
};
const build = scope => core.buildScopedOutputPrompt({ segments, sourceContext: '', settings, scope, speakerIdentity: identity });
const prompt = build('target_dialogue');

assert.equal(prompt.split('KIM HONG-JIN RAW VOICE — MANDATORY EXECUTION').length - 1, 1);
assert.equal(prompt.split('END KIM HONG-JIN RAW VOICE').length - 1, 1);
assert.equal(prompt.split('MANDATORY TRANSLATION CONTRACT').length - 1, 1);
assert.match(prompt, /maximum re-authoring/);
assert.match(prompt, /most eligible TARGET lines/);
assert.match(prompt, /active cheeky needling/);
assert.match(prompt, /openly crude, brazen diction/);
assert.match(prompt, /highly visible playful audacity/);
assert.match(prompt, /neutral translation with one detachable “씨발” fails/);
assert.match(prompt, /voice remains recognizable after removing explicit curses/);
assert.match(prompt, /Serious danger.*blocks forced comedy, not blunt diction/);
assert.match(prompt, /USER-DIRECTED PROFANITY GUARD/);
assert.match(prompt, /Profanity diversity is mandatory/);
assert.match(prompt, /Do not start nearby lines with the same curse/);

for (const example of [
    '당장 발 놀려. 씨발.',
    '하, 개같네. 어디 다친 데 없어?',
    '내 뒤에 처붙어. 떨어지지 마.',
    '말을 존나 안 들어요, 아주.',
    '그거 붙잡고 이 지랄 할 시간 없어.',
    '이 정도로 뒈지겠냐.',
    '쟤들이 뭐라 지랄하든 알 게 뭐야.',
    '그거 좀 그만하시죠. 사람 환장하게 만들지 말고.',
    '좆됐네.',
]) assert.ok(prompt.includes(example), `missing diverse example: ${example}`);

for (const scope of ['narration', 'other_dialogue', 'tagged_content']) {
    assert.doesNotMatch(build(scope), /KIM HONG-JIN RAW VOICE/);
}

const off = core.buildScopedOutputPrompt({
    segments,
    sourceContext: '',
    settings: { ...settings, developerHongjinFlavorEnabled: false },
    scope: 'target_dialogue',
    speakerIdentity: identity,
});
assert.doesNotMatch(off, /KIM HONG-JIN RAW VOICE/);
assert.doesNotMatch(core.buildInputPrompt('안녕', settings, 'male', identity), /KIM HONG-JIN RAW VOICE/);

console.log('PASS: Flash-optimized Kim Hong-jin voice is mandatory, varied, settings-aware, and restricted to confirmed target dialogue.');
