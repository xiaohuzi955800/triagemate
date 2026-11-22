// Teamwork Graph queries (curated queries only — no Cypher registration needed).
// All calls run as the current user and are permission-filtered for that user.
import api from '@forge/api';

export function userAri(accountId) {
  return `ari:cloud:identity::user/${accountId}`;
}

export function jiraProjectSpaceAri(cloudId, projectId) {
  return `ari:cloud:jira:${cloudId}:project/${projectId}`;
}

async function graphQuery(query, variables) {
  const res = await api.asUser().requestTeamworkGraph(query, variables);
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`Teamwork Graph error: ${JSON.stringify(json.errors).slice(0, 400)}`);
  }
  return json.data;
}

const ASSIGNED_WORK_QUERY = `
query triageMate_assignedWork($userId: ID!) {
  atlassianUserAssignedJiraWorkItems(userId: $userId, first: 25) {
    edges {
      node {
        ... on JiraWorkItem {
          id
          title
          status { name }
        }
      }
    }
    pageInfo { hasNextPage }
  }
}`;

const USER_TEAMS_QUERY = `
query triageMate_userTeams($userId: ID!) {
  atlassianUserInTeams(userId: $userId, first: 25) {
    edges {
      node {
        ... on AtlassianTeam {
          id
          displayName
        }
      }
    }
  }
}`;

const USER_WORK_QUERY = `
query triageMate_userWork($userId: ID!) {
  atlassianUserWorkQuery(userId: $userId, first: 25) {
    edges {
      node {
        __typename
        ... on JiraWorkItem {
          id
          title
          status { name }
        }
      }
    }
  }
}`;

const SPACE_WORK_QUERY = `
query triageMate_spaceWork($spaceAri: ID!) {
  jiraSpaceWorkItems(spaceAri: $spaceAri, first: 25) {
    edges {
      node {
        ... on JiraWorkItem {
          id
          title
          status { name }
        }
      }
    }
  }
}`;

function edgesToNodes(connection) {
  return (connection?.edges || []).map((e) => e.node).filter(Boolean);
}

function isOpenStatus(statusName) {
  const name = (statusName || '').toLowerCase();
  return !['done', 'resolved', 'closed', 'complete', 'completed', 'cancelled', 'canceled'].includes(name);
}

/**
 * Workload + recent activity for one user, from the graph.
 * Returns { openCount, totalAssigned, recentTitles, teams }.
 * Any single query failing degrades gracefully (returns partial data + error note).
 */
export async function getUserGraphProfile(accountId) {
  const ari = userAri(accountId);
  const profile = { openCount: 0, totalAssigned: 0, recentTitles: [], teams: [], errors: [] };

  try {
    const data = await graphQuery(ASSIGNED_WORK_QUERY, { userId: ari });
    const items = edgesToNodes(data?.atlassianUserAssignedJiraWorkItems);
    profile.totalAssigned = items.length;
    profile.openCount = items.filter((i) => isOpenStatus(i.status?.name)).length;
    profile.recentTitles = items.slice(0, 5).map((i) => i.title).filter(Boolean);
  } catch (err) {
    profile.errors.push(`assigned work: ${err.message}`);
  }

  try {
    const data = await graphQuery(USER_TEAMS_QUERY, { userId: ari });
    profile.teams = edgesToNodes(data?.atlassianUserInTeams).map((t) => ({ id: t.id, name: t.displayName }));
  } catch (err) {
    profile.errors.push(`teams: ${err.message}`);
  }

  return profile;
}

/** Teams for a user (used to check reporter/candidate collaboration). */
export async function getUserTeams(accountId) {
  try {
    const data = await graphQuery(USER_TEAMS_QUERY, { userId: userAri(accountId) });
    return edgesToNodes(data?.atlassianUserInTeams).map((t) => ({ id: t.id, name: t.displayName }));
  } catch {
    return [];
  }
}

/**
 * Broad work activity for a user (recent items across relationship types).
 * Used as a fallback signal when assigned-work data is thin.
 */
export async function getUserRecentWork(accountId) {
  try {
    const data = await graphQuery(USER_WORK_QUERY, { userId: userAri(accountId) });
    return edgesToNodes(data?.atlassianUserWorkQuery)
      .filter((n) => n.__typename === 'JiraWorkItem')
      .map((i) => ({ title: i.title, status: i.status?.name || '' }));
  } catch {
    return [];
  }
}

/** Recent work items in a Jira project space (graph view of the project). */
export async function getSpaceWorkItems(cloudId, projectId) {
  try {
    const data = await graphQuery(SPACE_WORK_QUERY, { spaceAri: jiraProjectSpaceAri(cloudId, projectId) });
    return edgesToNodes(data?.jiraSpaceWorkItems).map((i) => ({ title: i.title, status: i.status?.name || '' }));
  } catch {
    return [];
  }
}
