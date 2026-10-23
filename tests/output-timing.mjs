import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createOutputTiming, outputTimingText } from '../timing.js';
import { previousUserSource } from '../previous-user-context.js';
import { minimalOutputEnabled } from '../minimal-output.js';
import { outputSplitCount } from '../output-splitting.js';

const index = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const slice = (a, b) => { const start = index.indexOf(a); return index.slice(start, index.indexOf(b, start)); };
let time = 0;
const performance = { now: () => time };
const recorder = createOutputTiming({ now: () => time });
const env = {
    settings: {
        debugMode: true,
        developerMode: false,
        developerMinimalPromptEnabled: false,
        developerCompressedPromptEnabled: false,
        developerExtremeCompressedPromptEnabled: false,
        activeProfileSlot: 'A',
        profileFailureTimeoutSeconds: 20,
    },
    outputTiming: recorder,
    performance,
    normalizedProfileFailureTimeoutSeconds: () => 20,
    abortError: () => new DOMException('cancel', 'AbortError'),
    rememberRequestError: error => error,
    recordProfileAttempt: () => {},
    readErrorResponse: async () => null,
    isAbort: (error, signal) => signal?.aborted || error?.name === 'AbortError',
};
let queue = execute => execute();
let provider = async () => ({ content: '{"segments":[]}' });
const success = { content: '{"segments":[]}' };
const api = Function(
    ...Object.keys(env),
    'configuredProfileCycle', 'profileList', 'profileSlotForId', 'liveContext',
    'enqueueRequest', 'enqueueProfileRaceRequest', 'enqueueSplitOutputRequest', 'enqueueScopedParallelRequest',
    'VERBA_DEEP_MAX_TOKENS', 'extractResponseText', 'pendingOutputs', 'pendingSelectionTranslations', 'pendingInputControllers',
    slice('function waitForDelay(', 'function fallbackEligibleError(') + '\nreturn { sendProfileRequest, abortActiveTranslations };',
)(
    ...Object.values(env),
    () => ({ active: 'private', slot: 'A' }), () => [{ id: 'private' }], () => 'A',
    () => ({ ConnectionManagerRequestService: { sendRequest: (...args) => provider(...args) } }),
    execute => queue(execute), execute => queue(execute), execute => queue(execute), execute => queue(execute),
    15000, value => value?.content || value || '', new Map(), new Set(), new Set(),
);

const begin = (extra = {}) => recorder.begin({ profileSlot: 'A', mode: '일반', ...extra });
let result = begin();
time = 100;
const request = recorder.enqueue(result, { stage: 'output-translation', profileSlot: 'A' });
time = 150;
recorder.sent(result, request);
time = 300;
recorder.received(result, request);
time = 350;
recorder.settled(result, request, '응답 수신');
time = 400;
recorder.markApplyStart(result);
time = 450;
recorder.markApplyEnd(result);
recorder.finish(result, '완료');
let r = recorder.latest();
assert.equal(r.counts.total, 1); assert.equal(r.durations.queue, 50); assert.equal(r.durations.primary, 150); assert.equal(r.durations.apply, 50);
assert.match(outputTimingText(r), /프로필 A · 일반/);

result = begin({ retranslation: true });
time = 500;
const a = recorder.enqueue(result, { stage: 'output-translation', profileSlot: 'A' });
const b = recorder.enqueue(result, { stage: 'output-translation', profileSlot: 'A' });
recorder.sent(result, a); recorder.sent(result, b);
time = 600; recorder.received(result, a); recorder.settled(result, a, '응답 수신');
time = 700; recorder.received(result, b); recorder.settled(result, b, '응답 수신');
recorder.finish(result, '완료'); r = recorder.latest();
assert.equal(r.counts.total, 2); assert.equal(r.durations.primary, 200); assert.equal(r.retranslation, true);

// Queued request cancelled before provider dispatch: no phantom request count.
queue = execute => new Promise(resolve => setImmediate(() => resolve(execute())));
time = 0; const cancelled = begin();
const ctrl = new AbortController();
const queued = api.sendProfileRequest('private', { timing: cancelled, stage: 'output-translation', signal: ctrl.signal });
ctrl.abort();
await assert.rejects(queued, e => e.name === 'AbortError');
recorder.finish(cancelled, '취소·전환'); r = recorder.latest();
assert.equal(r.counts.total, 0); assert.equal(r.durations.queue, 100);
await queued(); assert.equal(recorder.latest().counts.total, 0);

// Provider ignores abort; Verba Deep still records elapsed time and exits immediately.
queue = execute => execute(); time = 0; const active = begin();
provider = () => new Promise(() => {});
const activeCtrl = new AbortController();
const working = api.sendProfileRequest('private', { timing: active, stage: 'output-translation', signal: activeCtrl.signal });
await new Promise(resolve => setImmediate(resolve)); time = 200; activeCtrl.abort();
await assert.rejects(working, e => e.name === 'AbortError'); recorder.finish(active, '취소·전환');
assert.equal(recorder.latest().counts.total, 1); assert.equal(recorder.latest().durations.primary, 200);

// No timing handle for inputs/connection tests: cannot change the last output result.
const before = recorder.latest(); provider = async () => success;
await api.sendProfileRequest('private', { stage: 'input-translation' });
assert.equal(recorder.latest(), before);

// Real output-job lifecycle: automatic/full retranslation, application failure, and debug OFF.
const message = { is_user: false, mes: 'source' };
const context = { chat: [message] };
let applied = true;
let seenTrace, seenReference;
const lifecycleEnv = { previousUserSource, automaticOutputLifecycle: { started() {} },
    minimalOutputEnabled, outputSplitCount,
    EXTENSION_KEY: 'verba-deep',
    isTranslationExtensionActive: () => true,
    activateTranslationExtension: () => 'verba-deep',
    settings: env.settings, outputTiming: recorder, performance: env.performance, AbortController,
    executionTrace: { trace() {}, heartbeat() {} }, traceSourceForMessage: () => {},
    liveContext: () => context, isNameReplacementMessage: () => true, messageSource: m => m?.mes || '',
    isPredominantlyKorean: () => false, hasForeignText: () => true, currentRecord: () => null,
    failedOutputSignatures: new Map(), pendingOutputs: new Map(), activeProfileSlot: () => 'A',
    hashText: v => v, currentSwipeId: () => 0, showProgress: () => null,
    clearProgress: () => {}, notify: () => {}, recentDialogueEndingRepeatHints: () => [], outputSpeakerIdentity: () => ({}),
    translateOutputText: async (_source, options) => {
        seenTrace = options.timing;
        seenReference = options.previousUserSource;
        await api.sendProfileRequest('private', options);
        return { translation: '번역', sourceMap: [] };
    },
    translationWithLockedSegments: v => v,
    normalizeBilingualMappedTranslation: (translation, sourceMap) => ({ translation, sourceMap }),
    applyTranslation: () => { time += 20; return { renderResult: { status: applied ? 'applied' : 'failed' } }; },
    clearTransientTranslationSelections: () => {}, refreshRetranslateButton: () => {}, renderOutputTiming: () => {},
    recordOutputTranslation: () => {}, isAbort: env.isAbort, reportError: () => {}, console: { info() {}, warn() {}, error() {} },
};
const translate = Function(...Object.keys(lifecycleEnv), slice('async function translateMessage(', 'function latestAssistantMessage(') + '\nreturn translateMessage;')(...Object.values(lifecycleEnv));
for (const force of [false, true]) {
    provider = async () => { time += 100; return success; };
    assert.equal(await translate(0, { force, automatic: !force }), true);
    assert.ok(seenTrace); assert.equal(recorder.latest().retranslation, force);
    assert.equal(recorder.latest().counts.total, 1); assert.equal(recorder.latest().durations.primary, 100);
    assert.equal(recorder.latest().durations.apply, 20); assert.equal(recorder.latest().status, '완료');
}
// Preserve the selected mode through the REAL recorder, summary and rendered log.
// Minimal wins over compression only while the developer gate is open.
for (const [developerMode, minimal, compressed, extreme, expectedMode] of [
    [true, true, false, false, '최소 프롬프트'],
    [true, true, true, true, '최소 프롬프트'],
    [false, true, true, true, '일반'],
    [true, false, true, false, '압축'],
    [true, false, true, true, '미친압축'],
    [true, false, false, false, '일반'],
]) {
    Object.assign(env.settings, { developerMode, developerMinimalPromptEnabled: minimal,
        developerCompressedPromptEnabled: compressed, developerExtremeCompressedPromptEnabled: extreme });
    for (const force of [false, true]) {
        await translate(0, { force, automatic: !force });
        assert.equal(seenTrace.mode, expectedMode);
        assert.equal(recorder.latest().mode, expectedMode);
        assert.ok(outputTimingText(recorder.latest()).includes(`프로필 A · ${expectedMode}\n`));
    }
}
Object.assign(env.settings, { developerMode: true, developerMinimalPromptEnabled: true });
applied = false; assert.equal(await translate(0, {}), undefined);
assert.equal(recorder.latest().status, '실패');
recorder.setEnabled(false); applied = true;
assert.equal(await translate(0, {}), true); assert.equal(seenTrace, null); assert.equal(recorder.latest(), null);

// Real automatic/retranslation lifecycle selects the user before the target,
// even while newer turns exist, and picks up a user edit on a new request.
const priorUser={is_user:true,mes:'We are at the river.'};
context.chat=[priorUser,message,{is_user:true,mes:'FUTURE SEA'}];
for(const force of [false,true]) {
 assert.equal(await translate(1,{force,automatic:!force}),true);
 assert.equal(seenReference,'We are at the river.');
}
priorUser.mes='We are at the lake.';
assert.equal(await translate(1,{force:true}),true);
assert.equal(seenReference,'We are at the lake.');
context.chat=[message];
console.log('PASS: timing queue/provider/apply stages, concurrency wall-clock, cancellation, mode labels, real output lifecycle, previous-user routing, and debug OFF gating.');
