import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
    buildMadKoreanTargetedAuditPrompt,
    repairCanonicalKoreanNameSuffixes,
} from '../core.js';

const names = ['담은', '민철', '지수', '혜담은'];
const repaired = repairCanonicalKoreanNameSuffixes(
    '담은이를 밀고 민철이는 멈춰 서있었다. 지수이를 불렀고, 혜담은이에게 줄 것도 챙겼다.',
    names,
);
assert.equal(repaired, '담은을 밀고 민철은 멈춰 서있었다. 지수를 불렀고, 혜담은에게 줄 것도 챙겼다.');

// A normal subject particle, vocative, comitative and unrelated noun survive.
for (const [before, after] of [
    ['담은이 달렸다.', '담은이 달렸다.'],
    ['담은아, 와.', '담은아, 와.'],
    ['담은이랑 갔다.', '담은이랑 갔다.'],
    ['어린이를 보호했다.', '어린이를 보호했다.'],
]) {
    assert.equal(repairCanonicalKoreanNameSuffixes(before, names), after);
}

const segments = [
    { id: 'seg_0000', type: 'dialogue_candidate', outputScope: 'target_dialogue', text: '"The front\'s a death trap!"' },
    { id: 'seg_0001', type: 'narration', outputScope: 'narration', text: 'He shoved Alex through the service entrance.' },
];
const prompt = buildMadKoreanTargetedAuditPrompt({
    segments,
    currentTranslations: new Map([
        ['seg_0000', '"정문은 좆밥이야!"'],
        ['seg_0001', '그는 민철이를 비상구로 밀어 넣었다.'],
    ]),
    sourceContext: segments.map(row => row.text).join('\n'),
    speakerIdentity: {
        characterName: '김홍진',
        userName: '담은',
        nameLocks: [{ source: 'Alex', target: '민철' }],
    },
});
assert.match(prompt, /SPARSE SECOND PASS/);
assert.match(prompt, /"repairs":\[\]/);
assert.match(prompt, /is WRONG because .* means easy\/weak/);
assert.match(prompt, /service entrance is not an emergency exit/i);
assert.match(prompt, /LOCKED=\["민철"\]/);
assert.match(prompt, /담은을\/민철을/);
assert.match(prompt, /각으로 문을 걷어찼다/);

// Exercise the exact sparse parser/request loop extracted from index.js.
const index = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const start = index.indexOf('function parseSparseMadRepairResponse(');
const end = index.indexOf('async function requestSelectionCandidates(', start);
assert.ok(start >= 0 && end > start);
const calls = [];
const responses = [
    '```json\n{"repairs":[{"id":"seg_0000","translation":"\\\"정문으로 가면 뒤져!\\\""}]}\n```',
];
const request = Function(
    'sendWithRetry', 'extractResponseText', 'isAbort', 'errorText',
    `${index.slice(start, end)}\nreturn {parseSparseMadRepairResponse, requestSparseMadRepairs};`,
)(
    async (requestPrompt, options) => {
        calls.push({ requestPrompt, options });
        return { content: responses.shift() };
    },
    response => response.content,
    error => error?.name === 'AbortError',
    error => error?.message || String(error),
);
const sparse = await request.requestSparseMadRepairs('audit', segments, { stage: 'mad-targeted-audit' });
assert.deepEqual([...sparse], [['seg_0000', '"정문으로 가면 뒤져!"']]);
assert.equal(calls.length, 1);
assert.equal(request.parseSparseMadRepairResponse('{"repairs":[]}', segments).size, 0);
assert.throws(
    () => request.parseSparseMadRepairResponse('{"repairs":[{"id":"seg_0000","translation":"A"},{"id":"seg_0000","translation":"B"}]}', segments),
    /중복 수정/,
);

// The audit is transactional: any downstream validation failure restores the
// complete first-pass translation map instead of leaving a half-applied repair.
const auditStart = index.indexOf('async function runMadKoreanTargetedAudit(');
const auditEnd = index.indexOf('async function runExperimentalQualityAudit(', auditStart);
assert.ok(auditStart >= 0 && auditEnd > auditStart);
let auditRequests = 0;
let failIntegrity = false;
const auditEnv = {
    madKoreanExclusiveMode: () => true,
    settings: { developerHongjinFlavorEnabled: true },
    outputScopeForSegment: segment => segment.outputScope,
    buildMadKoreanTargetedAuditPrompt: () => 'audit',
    requestSparseMadRepairs: async () => {
        auditRequests += 1;
        return new Map([['seg_0000', '"정문으로 가면 뒤져!"']]);
    },
    repairKoreanParticleAlternatives: value => value,
    repairStrictCanonicalIdentityNames: value => value,
    repairIndivisibleIdentityNames: value => value,
    findBannedWords: () => [],
    repairSegmentsByOutputScope: async () => {},
    buildBannedRepairPrompt: () => '',
    findUntranslatedSegments: () => [],
    buildUntranslatedRepairPrompt: () => '',
    repairProtectedTokenIntegrity: async () => {
        if (failIntegrity) throw new Error('integrity failed');
    },
    isAbort: () => false,
    console: { info() {}, warn() {} },
};
const runAudit = Function(
    ...Object.keys(auditEnv),
    `${index.slice(auditStart, auditEnd)}\nreturn runMadKoreanTargetedAudit;`,
)(...Object.values(auditEnv));
const auditTranslations = new Map([
    ['seg_0000', '"정문은 좆밥이야!"'],
    ['seg_0001', '민철이를 비상구로 밀었다.'],
]);
const auditArgs = {
    segmented: { segments, protectedText: segments.map(row => row.text).join('\n') },
    translations: auditTranslations,
    speakerScopes: {},
    speakerIdentity: {},
    options: {},
};
let auditResult = await runAudit(auditArgs);
assert.equal(auditResult.changed, 1);
assert.equal(auditTranslations.get('seg_0000'), '"정문으로 가면 뒤져!"');
auditTranslations.set('seg_0000', '1차 번역');
failIntegrity = true;
auditResult = await runAudit(auditArgs);
assert.equal(auditResult.changed, 0);
assert.equal(auditTranslations.get('seg_0000'), '1차 번역');
assert.equal(auditTranslations.get('seg_0001'), '민철이를 비상구로 밀었다.');
assert.equal(auditRequests, 2);

console.log('PASS: generic canonical-name suffix repair, sparse Mad+Hongjin semantic audit prompt, lock-name coverage, parser and transactional rollback.');
