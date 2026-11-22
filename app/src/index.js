// TriageMate action handlers (Forge functions backing the rovo:agent actions).
import {
  getIssue,
  listUnassigned,
  assignIssue,
  unassignIssue,
  addPublicComment,
  getServiceDesks,
  getRequestTypes,
  createRequest,
  getTransitions,
  transitionIssue,
  getAssignableUsers,
} from './jira.js';
import { findExpertsForIssue } from './experts.js';

function summarizeRequest(r) {
  return {
    key: r.key,
    summary: r.summary,
    status: r.status,
    priority: r.priority,
    issueType: r.issueType,
    reporter: r.reporter?.displayName || null,
    assignee: r.assignee?.displayName || null,
    created: r.created,
  };
}

export async function listUnassignedRequests(payload) {
  const requests = await listUnassigned(payload.projectKey || null, payload.maxResults || 10);
  return {
    count: requests.length,
    requests: requests.map(summarizeRequest),
  };
}

export async function getRequestDetails(payload) {
  const r = await getIssue(payload.issueKey);
  return {
    key: r.key,
    summary: r.summary,
    description: r.description,
    status: r.status,
    priority: r.priority,
    issueType: r.issueType,
    projectKey: r.projectKey,
    reporter: r.reporter,
    assignee: r.assignee,
    created: r.created,
  };
}

export async function findExperts(payload) {
  return findExpertsForIssue({
    issueKey: payload.issueKey,
    category: payload.category || null,
    keywords: payload.keywords || '',
  });
}

export async function assignRequest(payload) {
  await assignIssue(payload.issueKey, payload.accountId);
  return { ok: true, issueKey: payload.issueKey, assignedTo: payload.accountId };
}

export async function postFirstResponse(payload) {
  const result = await addPublicComment(payload.issueKey, payload.replyText);
  return { ok: true, issueKey: payload.issueKey, commentId: result.commentId };
}

const DEMO_CATEGORIES = [
  {
    category: 'Access & accounts',
    requests: [
      { summary: '[DEMO] Cannot log in to the VPN after password reset', description: 'I reset my password yesterday and now the VPN client rejects my login every time. I have tried restarting the client and my laptop.' },
      { summary: '[DEMO] Need access to the Finance shared drive', description: 'I joined the Finance team last week and I still cannot open the shared drive folder for invoices. Could someone grant me access?' },
    ],
  },
  {
    category: 'Software issue',
    requests: [
      { summary: '[DEMO] CRM crashes when exporting reports', description: 'Every time I export a quarterly report from the CRM, the app closes without an error message. It worked fine last month.' },
      { summary: '[DEMO] Email attachments will not download', description: 'Attachments in the webmail client show a spinner forever. Smaller files work, anything over 5 MB fails.' },
    ],
  },
  {
    category: 'Hardware issue',
    requests: [
      { summary: '[DEMO] Laptop battery drains in under an hour', description: 'My laptop battery went from lasting all day to under an hour this week. The laptop also gets very hot.' },
      { summary: '[DEMO] Office printer keeps jamming on tray 2', description: 'The printer on the 3rd floor jams every time someone prints from tray 2. We have cleared it three times today.' },
    ],
  },
  {
    category: 'Network & VPN',
    requests: [
      { summary: '[DEMO] Wi-Fi drops in the meeting room', description: 'The Wi-Fi in meeting room B drops every few minutes during video calls. Other rooms are fine.' },
      { summary: '[DEMO] VPN is extremely slow from home', description: 'Working from home, the VPN connection is so slow that file transfers time out. It is fine in the office.' },
    ],
  },
  {
    category: 'How-to question',
    requests: [
      { summary: '[DEMO] How do I set up an out-of-office reply?', description: 'I am going on leave next week and I cannot find where to set an automatic out-of-office reply in webmail.' },
      { summary: '[DEMO] How do I book a meeting room?', description: 'Is there a booking system for meeting rooms, or do I just check the calendar? I need room B for Thursday.' },
    ],
  },
  {
    category: 'Onboarding',
    requests: [
      { summary: '[DEMO] New starter needs a laptop and accounts', description: 'A new designer starts on Monday. Please prepare a laptop, email account, and access to the design tools.' },
      { summary: '[DEMO] New starter cannot access the HR portal', description: 'I started this week and my HR portal login does not work. HR said my account was created on Monday.' },
    ],
  },
];

const DEMO_HISTORY = [
  { category: 'Access & accounts', summary: '[DEMO HISTORY] Password reset for VPN access', description: 'Customer could not log in to the VPN after a password reset. Resolved by re-syncing the VPN credentials.' },
  { category: 'Software issue', summary: '[DEMO HISTORY] CRM export failing for large reports', description: 'CRM exports timed out on large reports. Resolved by clearing the report cache and re-running the export.' },
  { category: 'Hardware issue', summary: '[DEMO HISTORY] Replaced faulty laptop battery', description: 'Laptop battery drained in under an hour. Replaced the battery and the laptop is back to normal.' },
  { category: 'Network & VPN', summary: '[DEMO HISTORY] Fixed Wi-Fi access point in meeting room', description: 'Wi-Fi dropped repeatedly in one meeting room. Replaced the faulty access point.' },
  { category: 'How-to question', summary: '[DEMO HISTORY] Showed customer how to set out-of-office', description: 'Walked the customer through setting an out-of-office reply in webmail.' },
  { category: 'Onboarding', summary: '[DEMO HISTORY] Prepared laptop for new starter', description: 'Set up laptop, email, and tool access for a new starter ahead of their first day.' },
];

/** Run async task factories with at most `limit` running at once. */
async function runWithConcurrency(tasks, limit) {
  const results = [];
  const queue = tasks.slice();
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const task = queue.shift();
      results.push(await task());
    }
  });
  await Promise.all(workers);
  return results;
}

export async function generateDemoRequests(payload) {
  const desks = await getServiceDesks();
  if (desks.length === 0) {
    return { ok: false, error: 'No service project found on this site. Create a Jira Service Management project first.' };
  }
  const desk = payload.projectKey
    ? desks.find((d) => d.projectKey === payload.projectKey) || desks[0]
    : desks[0];
  const types = await getRequestTypes(desk.id);
  if (types.length === 0) {
    return { ok: false, error: `Service project ${desk.projectKey} has no request types.` };
  }
  const requestTypeId = types[0].id;

  // NOTE: Forge functions time out after ~25s, so demo creation runs in
  // parallel batches (5 at a time) instead of one request at a time.
  const allRequests = DEMO_CATEGORIES.flatMap((g) => g.requests);
  const created = [];
  const createFailures = [];
  await runWithConcurrency(
    allRequests.map((req) => async () => {
      try {
        const item = await createRequest(desk.id, requestTypeId, req.summary, req.description);
        created.push(item.key);
      } catch (err) {
        createFailures.push(`${req.summary}: ${err.message}`);
      }
    }),
    5
  );
  if (created.length === 0) {
    return { ok: false, error: `Could not create demo requests in ${desk.projectKey}: ${createFailures[0] || 'unknown error'}` };
  }

  // Some sites auto-assign new requests (round-robin). Demo requests should
  // start unassigned so "triage the newest unassigned requests" finds them.
  // Best-effort: if unassigning fails, the requests are still usable by key.
  await runWithConcurrency(
    created.map((key) => async () => {
      try {
        await unassignIssue(key);
      } catch (err) {
        console.log(`Demo request ${key} could not be unassigned: ${err.message}`);
      }
    }),
    5
  );

  // Resolved history items, spread across assignable users so expert finding has data.
  const users = await getAssignableUsers(desk.projectKey);
  const historyItems = [];
  await runWithConcurrency(
    DEMO_HISTORY.map((h) => async () => {
      try {
        const item = await createRequest(desk.id, requestTypeId, h.summary, h.description);
        historyItems.push(item);
      } catch (err) {
        console.log(`Demo history item could not be created: ${err.message}`);
      }
    }),
    5
  );
  const history = [];
  await runWithConcurrency(
    historyItems.map((item, i) => async () => {
      try {
        const assignee = users[i % Math.max(users.length, 1)];
        if (assignee) await assignIssue(item.key, assignee.accountId);
        const transitions = await getTransitions(item.key);
        const done = transitions.find((t) => t.to?.statusCategory?.key === 'done' || /done|resolved|closed/i.test(t.name));
        if (done) await transitionIssue(item.key, done.id);
      } catch (err) {
        // History enrichment is best-effort; the open demo requests are the main deliverable.
        console.log(`Demo history item ${item.key} could not be resolved: ${err.message}`);
      }
      history.push(item.key);
    }),
    5
  );

  return {
    ok: true,
    projectKey: desk.projectKey,
    openDemoRequests: created,
    resolvedHistory: history,
    note: 'Demo requests created. Try: "Triage the newest unassigned requests" or "Who should handle ' + created[0] + '?"',
  };
}
