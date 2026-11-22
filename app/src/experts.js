// Shared expert-finding core, used by both the Rovo action handler
// (src/index.js) and the issue panel resolver (src/panel-resolver.js).
import { getIssue, findSimilarResolved } from './jira.js';
import { getUserGraphProfile, getUserTeams } from './graph.js';
import { rankCandidates } from './ranking.js';

// --- Pure helpers (also unit-tested) ---

const CATEGORY_RULES = [
  { category: 'Access & accounts', words: ['password', 'login', 'log in', 'sign in', 'access', 'account', 'permission', 'locked out', 'reset', 'mfa', '2fa', 'sso'] },
  { category: 'Network & VPN', words: ['vpn', 'wi-fi', 'wifi', 'network', 'internet', 'connection', 'offline'] },
  { category: 'Hardware issue', words: ['laptop', 'printer', 'monitor', 'keyboard', 'mouse', 'battery', 'screen', 'hardware', 'jam', 'charger'] },
  { category: 'Billing & orders', words: ['invoice', 'billing', 'payment', 'charge', 'refund', 'order'] },
  { category: 'Onboarding', words: ['new starter', 'new joiner', 'onboarding', 'first day', 'just started'] },
  { category: 'How-to question', words: ['how do i', 'how to', 'how can i', 'where do i', 'where can i'] },
  { category: 'Software issue', words: ['crash', 'error', 'bug', 'fails', 'failing', 'frozen', 'update', 'install', 'not working'] },
];

// Best-effort keyword classifier for the issue panel (the panel has no LLM;
// Rovo classifies with the model instead). Returns 'Other' when nothing matches.
export function suggestCategory(text) {
  const haystack = (text || '').toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.words.some((w) => haystack.includes(w))) return rule.category;
  }
  return 'Other';
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with', 'is', 'it', 'my', 'me',
  'i', 'we', 'our', 'please', 'can', 'cannot', 'will', 'not', 'this', 'that', 'from', 'when',
  'after', 'every', 'time', 'how', 'do', 'does', 'are', 'was', 'been', 'has', 'have', 'had',
  'but', 'there', 'here', 'what', 'which', 'who', 'all', 'any', 'some', 'very', 'just', 'also',
]);

// Pull up to 4 search keywords from a request's summary (plus description as backup).
export function extractKeywords(summary, description) {
  const words = `${summary || ''} ${description || ''}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  return [...new Set(words)].slice(0, 4);
}

// --- Expert finding ---

export async function findExpertsForIssue({ issueKey, category, keywords }) {
  const issue = await getIssue(issueKey);
  const keywordList = Array.isArray(keywords)
    ? keywords
    : (keywords || '').split(',').map((k) => k.trim()).filter(Boolean);

  // 1. Who resolved similar requests before? (JQL over resolved work)
  const similar = await findSimilarResolved(issue.projectKey, keywordList, 25);
  const byAssignee = new Map();
  for (const item of similar) {
    if (!item.assignee) continue;
    const entry = byAssignee.get(item.assignee.accountId) || {
      accountId: item.assignee.accountId,
      displayName: item.assignee.displayName,
      similarResolved: 0,
      similarExamples: [],
    };
    entry.similarResolved += 1;
    if (entry.similarExamples.length < 3) entry.similarExamples.push(item.key);
    byAssignee.set(item.assignee.accountId, entry);
  }
  const candidates = [...byAssignee.values()].slice(0, 5);

  if (candidates.length === 0) {
    return {
      issueKey: issue.key,
      category: category || null,
      candidates: [],
      note: 'No one on this site has resolved a similar request yet. Suggest keeping the request in the queue or assigning it to the on-call agent.',
    };
  }

  // 2. Enrich each candidate from the Teamwork Graph: current workload + teams.
  const reporterTeams = issue.reporter ? await getUserTeams(issue.reporter.accountId) : [];
  const reporterTeamIds = new Set(reporterTeams.map((t) => t.id));

  const enriched = [];
  for (const c of candidates) {
    const profile = await getUserGraphProfile(c.accountId);
    const sameTeam = profile.teams.some((t) => reporterTeamIds.has(t.id));
    enriched.push({ ...c, openCount: profile.openCount, totalAssigned: profile.totalAssigned, sameTeam });
  }

  const ranked = rankCandidates(enriched);
  return {
    issueKey: issue.key,
    category: category || null,
    similarRequestsFound: similar.length,
    candidates: ranked.map((c) => ({
      accountId: c.accountId,
      displayName: c.displayName,
      score: c.score,
      similarResolved: c.similarResolved,
      similarExamples: c.similarExamples,
      openCount: c.openCount,
      sameTeam: c.sameTeam,
      evidence: c.evidence,
    })),
  };
}
