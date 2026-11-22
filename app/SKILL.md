---
name: triagemate-triage
description: Triage Jira Service Management requests with the TriageMate MCP tools: list unassigned requests, read request details, and find the best person to handle each request using the team's work graph. Use this when a user asks who should handle a support request, what is waiting in the service desk queue, or wants a request triaged.
---

# TriageMate triage

You have access to the TriageMate MCP server, which exposes three tools from a Jira Service
Management site. Use them to triage support requests with evidence, not guesses.

## Tools

- `list-unassigned-requests` — list unassigned, open requests in a service project, newest first.
  Optional inputs: `projectKey`, `maxResults` (default 10, max 20).
- `get-request-details` — full details of one request: summary, description, reporter, status,
  priority, request type, creation date. Input: `issueKey` (e.g. DESK-123).
- `find-experts` — ranked candidates to handle a request, with evidence. Inputs: `issueKey`,
  `category`, and optional `keywords` (comma separated, 2-4 words from the request).

## Workflow

1. If the user named a request, call `get-request-details` first. If they asked about the queue,
   call `list-unassigned-requests` and show what is waiting.
2. Classify the request: Access & accounts, Software issue, Hardware issue, Network & VPN,
   How-to question, Billing & orders, Onboarding, or Other.
3. Call `find-experts` with the issue key, category, and keywords from the request text.
4. Present the top candidate first, with evidence: how many similar requests they resolved
   (with example keys), how many open requests they currently have, and whether they share a
   team with the requester. Show at most three candidates in a compact table.
5. Recommend one person in one sentence: who, and why them.

## Rules

- These tools are read-only. They cannot assign requests or post replies. If the user wants to
  assign someone, tell them to confirm the assignee in Rovo chat with TriageMate, or assign the
  request in Jira directly.
- Never invent issue keys, user names, or evidence. If `find-experts` returns no candidates, say
  so plainly and suggest the request stays in the queue or goes to the on-call agent.
- Never present a ranking score without its evidence.
- If a tool call fails, report what failed and suggest the next step.

## Connecting

The TriageMate MCP server is exposed by the TriageMate Forge app at
`https://mcp.atlassian.com/forge/<appId>` (see the app's Devpost submission for the app ID).
A site or org admin must enable external MCP exposure for the app in Atlassian Administration
(Apps > Sites > Connected apps) before third-party clients can connect.
