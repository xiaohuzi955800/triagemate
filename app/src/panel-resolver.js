// Resolver for the TriageMate issue panel (jira:issuePanel).
// The panel has no LLM, so it classifies with keywords and reuses the
// same expert-finding core as the Rovo agent.
import Resolver from '@forge/resolver';
import { getIssue, assignIssue } from './jira.js';
import { findExpertsForIssue, suggestCategory, extractKeywords } from './experts.js';

const resolver = new Resolver();

resolver.define('getDetails', async ({ payload }) => {
  const r = await getIssue(payload.issueKey);
  return {
    key: r.key,
    summary: r.summary,
    description: r.description,
    status: r.status,
    priority: r.priority,
    issueType: r.issueType,
    reporter: r.reporter?.displayName || null,
    assignee: r.assignee?.displayName || null,
    created: r.created,
  };
});

resolver.define('findExperts', async ({ payload }) => {
  const r = await getIssue(payload.issueKey);
  const category = suggestCategory(`${r.summary} ${r.description || ''}`);
  const keywords = extractKeywords(r.summary, r.description);
  const result = await findExpertsForIssue({ issueKey: payload.issueKey, category, keywords });
  return { ...result, suggestedCategory: category, keywordsUsed: keywords };
});

resolver.define('assign', async ({ payload }) => {
  await assignIssue(payload.issueKey, payload.accountId);
  return { ok: true, issueKey: payload.issueKey, assignedTo: payload.displayName || payload.accountId };
});

export const handler = resolver.getDefinitions();
