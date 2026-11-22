import test from 'node:test';
import assert from 'node:assert/strict';
import { rankCandidates } from '../src/ranking.js';
import { adfToText, textToAdf } from '../src/jira.js';
import { suggestCategory, extractKeywords } from '../src/experts.js';

test('rankCandidates: experience beats workload, same team breaks ties', () => {
  const ranked = rankCandidates([
    { accountId: 'a', displayName: 'Ana', similarResolved: 4, similarExamples: ['DESK-1'], openCount: 2, sameTeam: false },
    { accountId: 'b', displayName: 'Bo', similarResolved: 1, similarExamples: ['DESK-2'], openCount: 0, sameTeam: true },
    { accountId: 'c', displayName: 'Cy', similarResolved: 4, similarExamples: ['DESK-3'], openCount: 8, sameTeam: false },
  ]);
  // Ana: 8 - 1 = 7; Bo: 2 - 0 + 2 = 4; Cy: 8 - 4 = 4. Bo and Cy tie on score;
  // the tie-break favours more similar experience, so Cy ranks above Bo.
  assert.equal(ranked[0].displayName, 'Ana');
  assert.equal(ranked[0].score, 7);
  assert.equal(ranked[1].displayName, 'Cy');
  assert.equal(ranked[2].displayName, 'Bo');
  assert.ok(ranked[0].evidence[0].includes('Resolved 4 similar'));
});

test('rankCandidates: empty list stays empty', () => {
  assert.deepEqual(rankCandidates([]), []);
});

test('rankCandidates: zero experience still ranks by workload', () => {
  const ranked = rankCandidates([
    { accountId: 'a', displayName: 'Ana', similarResolved: 0, openCount: 5, sameTeam: false },
    { accountId: 'b', displayName: 'Bo', similarResolved: 0, openCount: 1, sameTeam: false },
  ]);
  assert.equal(ranked[0].displayName, 'Bo');
});

test('adfToText: paragraphs join with newlines', () => {
  const doc = {
    type: 'doc',
    version: 1,
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }, { type: 'text', text: ' world' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Second line' }] },
    ],
  };
  assert.equal(adfToText(doc), 'Hello world\nSecond line');
});

test('adfToText: empty and null safe', () => {
  assert.equal(adfToText(null), '');
  assert.equal(adfToText(undefined), '');
  assert.equal(adfToText('plain'), 'plain');
});

test('textToAdf: round-trips through adfToText', () => {
  const adf = textToAdf('Line one\nLine two');
  assert.equal(adfToText(adf), 'Line one\nLine two');
  assert.equal(adf.type, 'doc');
});

test('suggestCategory: matches keywords, falls back to Other', () => {
  assert.equal(suggestCategory('Cannot log in after password reset'), 'Access & accounts');
  assert.equal(suggestCategory('VPN is extremely slow from home'), 'Network & VPN');
  assert.equal(suggestCategory('Office printer keeps jamming'), 'Hardware issue');
  assert.equal(suggestCategory('How do I set up an out-of-office reply?'), 'How-to question');
  assert.equal(suggestCategory('New starter needs a laptop and accounts'), 'Access & accounts'); // access beats onboarding: rule order
  assert.equal(suggestCategory('The office plant needs watering'), 'Other');
  assert.equal(suggestCategory(''), 'Other');
});

test('extractKeywords: drops stopwords and short words, dedupes', () => {
  const kw = extractKeywords('CRM crashes when exporting reports', 'Every time I export a quarterly report from the CRM, the app closes.');
  assert.ok(kw.includes('crashes') || kw.includes('exporting'));
  assert.ok(kw.length <= 4);
  assert.ok(!kw.includes('when') && !kw.includes('the'));
  assert.equal(new Set(kw).size, kw.length);
});
