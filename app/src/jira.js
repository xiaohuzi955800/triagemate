// Jira / Jira Service Management REST helpers (run as the chatting user).
import api, { route } from '@forge/api';

const ISSUE_FIELDS = 'summary,description,reporter,assignee,status,priority,issuetype,project,created,resolutiondate';

async function jiraFetch(routeValue, { method = 'GET', body } = {}) {
  const options = { method };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
    options.headers = { 'Content-Type': 'application/json' };
  }
  // NOTE: callers must pass a `route` tagged template. Interpolating a whole
  // dynamic path string into route`...` throws "Disallowing path manipulation
  // attempt" — route only accepts static templates with per-segment values.
  const res = await api.asUser().requestJira(routeValue, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira API ${method} ${String(routeValue)} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  // 204 No Content (e.g. assign) has no body.
  if (res.status === 204) return null;
  return res.json();
}

/** Convert Atlassian Document Format (ADF) to plain text. */
export function adfToText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.type === 'text') return node.text || '';
  if (Array.isArray(node.content)) {
    // Block-level children (paragraphs, headings, list items) join with newlines;
    // inline children (text runs, mentions) join directly.
    const blockTypes = new Set(['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'codeBlock', 'panel']);
    const joiner = node.content.some((c) => blockTypes.has(c.type)) ? '\n' : '';
    return node.content.map(adfToText).join(joiner);
  }
  return '';
}

/** Plain text -> minimal ADF paragraph document (for comments / descriptions). */
export function textToAdf(text) {
  return {
    type: 'doc',
    version: 1,
    content: String(text)
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => ({
        type: 'paragraph',
        content: [{ type: 'text', text: line }],
      })),
  };
}

function normalizeIssue(issue) {
  const f = issue.fields || {};
  return {
    key: issue.key,
    id: issue.id,
    summary: f.summary || '',
    description: adfToText(f.description),
    status: f.status?.name || '',
    statusCategory: f.status?.statusCategory?.key || '',
    priority: f.priority?.name || '',
    issueType: f.issuetype?.name || '',
    projectKey: f.project?.key || '',
    projectId: f.project?.id || '',
    reporter: f.reporter ? { accountId: f.reporter.accountId, displayName: f.reporter.displayName } : null,
    assignee: f.assignee ? { accountId: f.assignee.accountId, displayName: f.assignee.displayName } : null,
    created: f.created || '',
    resolutionDate: f.resolutiondate || '',
  };
}

export async function getIssue(issueKey) {
  const issue = await jiraFetch(route`/rest/api/3/issue/${issueKey}?fields=${ISSUE_FIELDS}`);
  return normalizeIssue(issue);
}

export async function searchIssues(jql, maxResults = 20) {
  const data = await jiraFetch(route`/rest/api/3/search/jql`, {
    method: 'POST',
    body: { jql, fields: ISSUE_FIELDS.split(','), maxResults },
  });
  return (data.issues || []).map(normalizeIssue);
}

export async function listUnassigned(projectKey, maxResults = 10) {
  const projectClause = projectKey ? `project = ${projectKey} AND ` : '';
  const jql = `${projectClause}assignee is EMPTY AND statusCategory != Done ORDER BY created DESC`;
  return searchIssues(jql, Math.min(maxResults, 20));
}

/** Resolved/done issues in a project whose text matches any of the keywords. */
export async function findSimilarResolved(projectKey, keywords, maxResults = 25) {
  const terms = (keywords || [])
    .map((k) => String(k).trim())
    .filter(Boolean)
    .slice(0, 4);
  if (terms.length === 0) return [];
  const textClause = terms.map((t) => `text ~ "${t.replace(/"/g, '')}"`).join(' OR ');
  const jql = `project = ${projectKey} AND statusCategory = Done AND (${textClause}) ORDER BY resolved DESC`;
  return searchIssues(jql, maxResults);
}

export async function assignIssue(issueKey, accountId) {
  await jiraFetch(route`/rest/api/3/issue/${issueKey}/assignee`, {
    method: 'PUT',
    body: { accountId },
  });
  return { ok: true };
}

/** Clear the assignee (some sites auto-assign new requests; demo requests should start unassigned). */
export async function unassignIssue(issueKey) {
  await jiraFetch(route`/rest/api/3/issue/${issueKey}/assignee`, {
    method: 'PUT',
    body: { accountId: null },
  });
  return { ok: true };
}

export async function addPublicComment(issueKey, text) {
  // JSM customer-visible comment via the service desk API.
  const data = await jiraFetch(route`/rest/servicedeskapi/request/${issueKey}/comment`, {
    method: 'POST',
    body: { body: text, public: true },
  });
  return { ok: true, commentId: data?.id };
}

export async function getServiceDesks() {
  const data = await jiraFetch(route`/rest/servicedeskapi/servicedesk`);
  return (data.values || []).map((d) => ({ id: d.id, projectKey: d.projectKey, projectName: d.projectName }));
}

export async function getRequestTypes(serviceDeskId) {
  const data = await jiraFetch(route`/rest/servicedeskapi/servicedesk/${serviceDeskId}/requesttype`);
  return (data.values || []).map((t) => ({ id: t.id, name: t.name }));
}

export async function createRequest(serviceDeskId, requestTypeId, summary, description) {
  const data = await jiraFetch(route`/rest/servicedeskapi/request`, {
    method: 'POST',
    body: {
      serviceDeskId: String(serviceDeskId),
      requestTypeId: String(requestTypeId),
      requestFieldValues: { summary, description },
    },
  });
  return { key: data.issueKey, id: data.issueId };
}

export async function getTransitions(issueKey) {
  const data = await jiraFetch(route`/rest/api/3/issue/${issueKey}/transitions`);
  return data.transitions || [];
}

export async function transitionIssue(issueKey, transitionId) {
  await jiraFetch(route`/rest/api/3/issue/${issueKey}/transitions`, {
    method: 'POST',
    body: { transition: { id: transitionId } },
  });
  return { ok: true };
}

/** Users who can be assigned issues in a project (licensed users on the site). */
export async function getAssignableUsers(projectKey) {
  const data = await jiraFetch(
    route`/rest/api/3/user/assignable/search?project=${projectKey}&maxResults=50`
  );
  return (Array.isArray(data) ? data : []).map((u) => ({ accountId: u.accountId, displayName: u.displayName }));
}
