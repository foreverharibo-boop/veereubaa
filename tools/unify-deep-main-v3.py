from pathlib import Path


def replace_once(path, old, new, label):
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one anchor, found {count}')
    file.write_text(text.replace(old, new, 1))


def replace_once_or_already(path, old, new, label):
    file = Path(path)
    text = file.read_text()
    old_count = text.count(old)
    new_count = text.count(new)
    if old_count == 1:
        file.write_text(text.replace(old, new, 1))
        return
    if old_count == 0 and new_count == 1:
        return
    raise SystemExit(f'{label}: expected one old anchor or one applied anchor, found old={old_count}, new={new_count}')


def replace_exact_count(path, old, new, expected, label):
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != expected:
        raise SystemExit(f'{label}: expected {expected} anchors, found {count}')
    file.write_text(text.replace(old, new))


def replace_many(path, replacements):
    for old, new, label in replacements:
        replace_once(path, old, new, label)


# Keep the intentionally isolated minimal engine ahead of every optional helper.
replace_once(
    'index.js',
    """    const initialSegmented = segmentSource(source, characterNameLocks, segmentationOptions);
    await planBilingualDialogueVerdicts(initialSegmented, { signal: options.signal, timing: options.timing });
    if (minimalOutputEnabled(settings)) {
        return translateMinimalOutput(initialSegmented, settings, options, { requestSegments, buildSourceMap, reviewEnglish: reviewFinalEnglish });
    }
    const roleTermLocks = await planRepeatedRoleTermLocks(initialSegmented, {""",
    """    const initialSegmented = segmentSource(source, characterNameLocks, segmentationOptions);
    if (minimalOutputEnabled(settings)) {
        return translateMinimalOutput(initialSegmented, settings, options, { requestSegments, buildSourceMap, reviewEnglish: reviewFinalEnglish });
    }
    await planBilingualDialogueVerdicts(initialSegmented, { signal: options.signal, timing: options.timing });
    const roleTermLocks = await planRepeatedRoleTermLocks(initialSegmented, {""",
    'minimal mode before bilingual planning',
)
replace_once(
    'index.js',
    "const SERVER_ENGINE_VERSION = '0.6.43';",
    "const SERVER_ENGINE_VERSION = '0.6.44';",
    'Deep server engine version',
)

# Main diagnostics added two runtime dependencies after the experimental tests
# were written. Supply harmless fixtures instead of weakening the production code.
replace_many('tests/diagnostics.mjs', [
    (
        """const api = Function('settings', 'document', 'copyText', 'debugDiagnosticText',
    'verbaServer', 'createDebugDiagnostic', 'pendingOutputs', 'automaticTranslationTimers', 'swipeTranslationJobs', 'serverRetryStates',
    'let lastDebugDiagnostic = null;\\n' + storeSource + copySource + '\\nreturn { storeDebugDiagnostic, copyDebugDiagnostic, latest: () => lastDebugDiagnostic };')(
    settings, { querySelector: () => button }, async value => copies.push(JSON.parse(value)), JSON.stringify,
    { refreshDiagnostics: async () => {} }, () => ({ automaticOutput: { events: [...lifecycleEvents] } }), outputJobs, new Map(), new Map(), retries);""",
        """const api = Function('settings', 'document', 'copyText', 'debugDiagnosticText',
    'verbaServer', 'createDebugDiagnostic', 'pendingOutputs', 'automaticTranslationTimers', 'swipeTranslationJobs', 'serverRetryStates',
    'executionTrace', 'traceLatestAssistantSource',
    'let lastDebugDiagnostic = null;\\n' + storeSource + copySource + '\\nreturn { storeDebugDiagnostic, copyDebugDiagnostic, latest: () => lastDebugDiagnostic };')(
    settings, { querySelector: () => button }, async value => copies.push(JSON.parse(value)), JSON.stringify,
    { refreshDiagnostics: async () => {} }, () => ({ automaticOutput: { events: [...lifecycleEvents] } }), outputJobs, new Map(), new Map(), retries,
    { heartbeat() {} }, () => {});""",
        'diagnostic fixture dependencies',
    ),
    (
        "assert.ok(index.includes('if (!settings.debugMode) lastDebugDiagnostic = null;'));",
        "assert.match(index, /if \\(!settings\\.debugMode\\) \\{[\\s\\S]*?lastDebugDiagnostic = null;/);",
        'diagnostic reset assertion',
    ),
])

replace_once(
    'tests/display-resume.mjs',
    """const env={EXTENSION_KEY:'verba',STATE_KEY:'verba',SOURCE_VIEW_KEY:'sourceView',settings:{autoOutput:true},
 automaticOutputLifecycle:lifecycle,isTranslationExtensionActive:()=>owner,liveContext:()=>({chat}),""",
    """const env={EXTENSION_KEY:'verba',STATE_KEY:'verba',SOURCE_VIEW_KEY:'sourceView',settings:{autoOutput:true},
 executionTrace:{heartbeat(){}},traceLatestAssistantSource(){},
 automaticOutputLifecycle:lifecycle,isTranslationExtensionActive:()=>owner,liveContext:()=>({chat}),""",
    'display resume fixture dependencies',
)

# Isolated Function(...) tests must explicitly receive the newly introduced
# bilingual planner and server-settings renderer.
replace_many('tests/minimal-output.mjs', [
    (
        "const route=Function('settings','normalizedCharacterNameLocks','segmentSource','minimalOutputEnabled','translateMinimalOutput','requestSegments','buildSourceMap','planRepeatedRoleTermLocks','reviewFinalEnglish',between('async function translateOutputText(', 'function inputIdentitySpellingContext(')+'\\nreturn translateOutputText;');",
        "const route=Function('settings','normalizedCharacterNameLocks','segmentSource','minimalOutputEnabled','translateMinimalOutput','requestSegments','buildSourceMap','planBilingualDialogueVerdicts','planRepeatedRoleTermLocks','reviewFinalEnglish',between('async function translateOutputText(', 'function inputIdentitySpellingContext(')+'\\nreturn translateOutputText;');",
        'minimal route helper parameters',
    ),
    (
        "const run=route(settings,()=>[],segmentSource,minimalOutputEnabled,translateMinimalOutput,requestSegments,buildSourceMap,()=>{throw Error('NORMAL_PATH');},async ({translations})=>{assert.ok(translations instanceof Map);});",
        "const run=route(settings,()=>[],segmentSource,minimalOutputEnabled,translateMinimalOutput,requestSegments,buildSourceMap,async()=>{},()=>{throw Error('NORMAL_PATH');},async ({translations})=>{assert.ok(translations instanceof Map);});",
        'minimal route helper arguments',
    ),
    (
        "const markup=Function('settings','escapeHtml','baseTranslationEditorMarkup','lastQualityAuditSummary',defs+'\\n'+between('function developerChuseokGalbwaeMarkup(', 'function syncDeveloperQualityControls(')+'\\nreturn developerSettingsMarkup();');",
        "const markup=Function('settings','escapeHtml','baseTranslationEditorMarkup','lastQualityAuditSummary','serverTranslationSettingsMarkup',defs+'\\n'+between('function developerChuseokGalbwaeMarkup(', 'function syncDeveloperQualityControls(')+'\\nreturn developerSettingsMarkup();');",
        'minimal markup server settings dependency',
    ),
    (
        "markup(settings,escapeHtml,()=>'', '', '')",
        "markup(settings,escapeHtml,()=>'', '', ()=> '')",
        'minimal markup enabled call',
    ),
    (
        "markup({...settings,developerMode:false},escapeHtml,()=>'', '', '')",
        "markup({...settings,developerMode:false},escapeHtml,()=>'', '', ()=> '')",
        'minimal markup disabled call',
    ),
])

replace_once(
    'tests/name-macro-translation.mjs',
    """    requestSegments: () => {}, buildSourceMap: () => [], reviewFinalEnglish: () => {},
    planRepeatedRoleTermLocks: async prepared => {""",
    """    requestSegments: () => {}, buildSourceMap: () => [], reviewFinalEnglish: () => {},
    planBilingualDialogueVerdicts: async () => {},
    planRepeatedRoleTermLocks: async prepared => {""",
    'name macro bilingual planner fixture',
)

replace_once(
    'tests/post-translation-ai-repair-disabled.mjs',
    """    translateMinimalOutput: () => { throw new Error('minimal path must stay off'); },
    planRepeatedRoleTermLocks: async () => [],""",
    """    translateMinimalOutput: () => { throw new Error('minimal path must stay off'); },
    planBilingualDialogueVerdicts: async () => {},
    planRepeatedRoleTermLocks: async () => [],""",
    'post-repair bilingual planner fixture',
)

replace_many('tests/output-splitting.mjs', [
    (
        """ normalizedCharacterNameLocks:()=>[{source:'Hong-jin',target:'홍진'}],
 planRepeatedRoleTermLocks:async s=>{planned++;assert.equal(s.segments.length,segmented.segments.length);return [];},""",
        """ normalizedCharacterNameLocks:()=>[{source:'Hong-jin',target:'홍진'}],
 planBilingualDialogueVerdicts:async()=>{},
 planRepeatedRoleTermLocks:async s=>{planned++;assert.equal(s.segments.length,segmented.segments.length);return [];},""",
        'split output bilingual planner fixture',
    ),
    (
        "const markup=Function('settings','escapeHtml','baseTranslationEditorMarkup','lastQualityAuditSummary',defs+between('function developerChuseokGalbwaeMarkup(', 'function syncDeveloperQualityControls(')+'\\nreturn developerSettingsMarkup();');",
        "const markup=Function('settings','escapeHtml','baseTranslationEditorMarkup','lastQualityAuditSummary','serverTranslationSettingsMarkup',defs+between('function developerChuseokGalbwaeMarkup(', 'function syncDeveloperQualityControls(')+'\\nreturn developerSettingsMarkup();');",
        'split markup server settings dependency',
    ),
])
replace_exact_count(
    'tests/output-splitting.mjs',
    "markup(settings,String,()=>'', '', '')",
    "markup(settings,String,()=>'', '', ()=> '')",
    2,
    'split markup calls',
)

replace_once_or_already(
    'tests/taste-audit-wiring.mjs',
    """ normalizedCharacterNameLocks:()=>[],segmentSource:()=>segmented,minimalOutputEnabled:()=>false,planRepeatedRoleTermLocks:async()=>[],""",
    """ normalizedCharacterNameLocks:()=>[],segmentSource:()=>segmented,minimalOutputEnabled:()=>false,planBilingualDialogueVerdicts:async()=>{},planRepeatedRoleTermLocks:async()=>[],""",
    'taste audit bilingual planner fixture',
)

print('Deep main integration fixtures patched')
