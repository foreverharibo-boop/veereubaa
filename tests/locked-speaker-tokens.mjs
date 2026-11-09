import test from 'node:test';
import assert from 'node:assert/strict';
import { segmentSource, inferLocalTargetDialogueScopes, buildOutputPrompt, resolveOutputSpeakerIdentity } from '../core.js';

const locks = [{ source: 'Shin', target: '신' }, { source: 'Dana', target: '다나' }];
const identity = resolveOutputSpeakerIdentity({ characterName: 'Shin', userName: 'Dana', characterGender: 'male' }, locks);
const cases = [
    ['Shin smiled. "Hello."', 'target_dialogue'],
    ['Dana smiled. "Hello."', 'other_dialogue'],
    ['"Hello," Shin said.', 'target_dialogue'],
    ['"Hello," Dana said.', 'other_dialogue'],
    ['"Hello," said Shin.', 'target_dialogue'],
    ['"Hello," said Dana.', 'other_dialogue'],
    ['"Hello."', 'unknown_dialogue'],
];

for (const locked of [false, true]) for (const [source, expected] of cases) {
    test(`name locks ${locked}: ${source}`, () => {
        const segmented = segmentSource(source, locked ? locks : [], { speakerIdentity: identity });
        const scopes = inferLocalTargetDialogueScopes(segmented, identity);
        assert.deepEqual(Object.values(scopes), [expected]);
        const prompt = buildOutputPrompt(segmented, { dialoguePrompt: 'TARGET_VOICE_SENTINEL' }, '', identity, null, scopes);
        const rows = JSON.parse(prompt.split('\nSEGMENTS\n').at(-1));
        assert.equal(rows.find(row => row.type === 'dialogue_candidate').speaker_scope, expected);
        assert.ok(prompt.includes('TARGET_VOICE_SENTINEL'));
    });
}
