import assert from 'node:assert/strict';
import fs from 'node:fs';
import { POST_TRANSLATION_AI_REPAIR_ENABLED } from '../minimal-output.js';
import { normalizedServerRetryLimit } from '../retry-policy.js';
const index=fs.readFileSync(new URL('../index.js',import.meta.url),'utf8');
const style=fs.readFileSync(new URL('../style.css',import.meta.url),'utf8');
const between=(a,b)=>{
    const start=index.indexOf(a),end=index.indexOf(b,start);
    assert.ok(start>=0 && end>start,a);
    return index.slice(start,end);
};
const defs=between('const RELATION_TEMPERATURE_OPTIONS','const baseContext =');
const render=Function('dev','escapeHtml','normalizedServerRetryLimit','POST_TRANSLATION_AI_REPAIR_ENABLED',defs+`
    const settings=structuredClone(DEFAULT_SETTINGS);settings.developerMode=dev;
    const EXTENSION_VERSION='0.6.24',lastQualityAuditSummary='',lastDebugDiagnostic=null;
    const outputTiming={latest:()=>null},outputTimingText=()=>'',normalizedPromptPresets=()=>[],normalizedPromptPresetBackups=()=>[],promptPresetSelectMarkup=()=>'',baseTranslationEditorMarkup=()=>'';
    const sourceChangeTracer={diagnostics:()=>({fullTextEnabled:false})};
    const executionTrace={diagnostics:()=>({})};
    const normalizedProfileRaceTimeoutMinutes=()=>5,normalizedProfileRaceStaggerSeconds=()=>35,normalizedProfileFailureTimeoutSeconds=()=>120,normalizedProfileFailureTimeoutMinutes=()=>2;
`+between('function tuningChoiceMarkup(', 'function normalizeTranslationRuleOrder(')
 +between('function generalFlavorSettingsMarkup(', 'function syncDeveloperQualityControls(')
 +between('function customTranslatorInstructionPlaceholder(', 'function injectSettingsPanel(')
 +'const panel={};'+between('    panel.innerHTML = `', '    host.append(panel);')
 +'return panel.innerHTML;');
const escapeHtml=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const panels=[false,true].map(dev=>render(dev,escapeHtml,normalizedServerRetryLimit,POST_TRANSLATION_AI_REPAIR_ENABLED));
for(const html of panels){
    assert.match(html,/<div><b>베에르으바아<\/b><\/div>/);
    assert.match(html,/id="verba-deep-settings-visibility"[\s\S]*?표시할 기능 선택/);
    assert.match(html,/id="verba-deep-settings-visibility"[\s\S]*?id="verba-deep-settings-search"[\s\S]*?id="verba-deep-profile-settings-group"/);
    assert.match(html,/id="verba-deep-translation-engine"[\s\S]*?value="ai"[\s\S]*?value="google-free"/);
    assert.match(html,/id="verba-deep-translate-tagged-content" checked/);
    assert.match(html,/id="verba-deep-selection-candidates"[\s\S]*?id="verba-deep-translate-tagged-content"[\s\S]*?id="verba-deep-selection-menu-settings"/);
    assert.doesNotMatch(html,/<small>v\$?\{?EXTENSION_VERSION|<small>v0\.5\./);
    assert.match(html,/id="verba-deep-prompt-conflict-settings"[\s\S]*?<\/details>\s*<details id="verba-deep-developer-output-split-lab"/);
    assert.match(html,/id="verba-deep-expression-detail"[\s\S]*?<\/details>\s*<details id="verba-deep-developer-relationship-lab"/);
    const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
    assert.equal(new Set(ids).size,ids.length,'No duplicated IDs in complete settings markup');
    assert.equal(ids.filter(x=>x==='verba-deep-developer-output-split-lab').length,1);
    assert.equal(ids.filter(x=>x==='verba-deep-developer-relationship-lab').length,1);
}
assert.doesNotMatch(panels[0],/id="verba-deep-chuseok-galbwae-(?:all|dialogue-inner)"/);
assert.match(panels[1],/id="verba-deep-developer-settings"[\s\S]*?id="verba-deep-chuseok-galbwae-all"[\s\S]*?id="verba-deep-chuseok-galbwae-dialogue-inner"/);
assert.doesNotMatch(panels[1],/id="verba-deep-chuseok-galbwae-(?:all|dialogue-inner)" checked/);
const manifest=JSON.parse(fs.readFileSync(new URL('../manifest.json',import.meta.url),'utf8'));
assert.equal(manifest.name,'verba-deep');assert.equal(manifest.display_name,'베에르으바아');
assert.ok(index.includes("const EXTENSION_VERSION = '"+manifest.version+"';"));
assert.match(style,/#verba-deep-settings > \.inline-drawer > \.inline-drawer-content\s*\{\s*font-size: \.86em;/);
assert.doesNotMatch(style,/#verba-deep-settings\s*\{\s*font-size:/);
assert.doesNotMatch(style,/#verba-deep-settings \.verba-deep-drawer-header\s*\{[^}]*min-height:/s);
if(process.argv.includes('--html')) console.log(JSON.stringify(panels));
else console.log('PASS: complete settings markup, default outer drawer sizing, hidden visible version, compact inner UI, exact adjacent placement, unique IDs and version; developer ON/OFF.');
