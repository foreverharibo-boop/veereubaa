import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const style = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const between = (start, end) => index.slice(index.indexOf(start), index.indexOf(end, index.indexOf(start)));

assert.match(index, /key: 'settingsSearch', label: '설정 검색', selector: '#verba-deep-settings-search'/);
assert.match(index, /\$\{settingsVisibilityMarkup\(\)\}\s*\$\{settingsSearchMarkup\(\)\}\s*<section id="verba-deep-profile-settings-group"/);
assert.match(index, /id="verba-deep-settings-search-input"[\s\S]*?placeholder="설정 이름·옵션·설명 검색"/);
assert.match(index, /function settingsSearchHaystack[\s\S]*?element\.textContent/);
assert.match(index, /function settingsSearchHaystack[\s\S]*?placeholder[\s\S]*?title[\s\S]*?aria-label/);
assert.match(index, /tokens\.every\(token => settingsSearchHaystack\(element, label\)\.includes\(token\)\)/);
assert.match(index, /element\.toggleAttribute\('hidden', !matched\)/);
assert.match(index, /if \(matched\) element\.dataset\.verbaDeepUiHidden = 'false'/);
assert.match(index, /detail\.open = matched && tokens\.every/);
assert.match(index, /verbaDeepSearchWasOpen[\s\S]*?delete detail\.dataset\.verbaDeepSearchWasOpen/);
assert.match(index, /key === 'settingsSearch' && !target\.checked[\s\S]*?resetSettingsSearch\(panel\)/);
assert.match(index, /function clearSettingsSearchHighlights[\s\S]*?mark\.replaceWith\(document\.createTextNode/);
assert.match(index, /function highlightSettingsSearchTokens[\s\S]*?highlight\.className = 'verba-deep-settings-search-highlight'/);
assert.match(index, /인터넷 밈 농도/);
assert.match(style, /\.verba-deep-settings-search\s*\{/);
assert.match(style, /\.verba-deep-settings-search\[hidden\][\s\S]*?display:\s*none\s*!important/);
assert.match(style, /mark\.verba-deep-settings-search-highlight[\s\S]*?#ffeb3b/);
assert.doesNotMatch(style, /\.verba-deep-settings-search-match/);

const normalizeSource = between('function normalizedSettingsSearchText(', 'function settingsSearchTargets(');
const normalize = Function(`${normalizeSource}; return normalizedSettingsSearchText;`)();
assert.equal(normalize('  인터넷   밈　농도 '), '인터넷 밈 농도');
assert.equal(normalize('ABC'), 'abc');

console.log('PASS: settings search highlights matching words, temporarily reveals hidden groups, opens matches, and restores text/layout/open state when cleared.');
