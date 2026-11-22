# TriageMate for JSM

A Rovo agent that triages Jira Service Management requests: it classifies new requests, finds the
best person to handle each one using the Teamwork Graph, and drafts a first reply for the customer.

Built for **Codegeist 2026** (Atlassian hackathon on Devpost).
Track: Apps for Business Teams.
Bonus prizes entered: Best Agents, Best app with Atlassian MCP, Best apps with Teamwork Graph integration.

## How it works

1. A support agent asks TriageMate to triage the queue or a specific request in Rovo chat.
2. TriageMate reads the request, classifies it, then calls `find-experts`:
   - JQL finds who resolved similar requests before.
   - Teamwork Graph curated queries enrich each candidate with current open workload
     (`atlassianUserAssignedJiraWorkItems`) and team membership (`atlassianUserInTeams`).
   - Candidates are ranked: relevant experience first, workload as a penalty, sharing a team
     with the requester as a bonus. Every recommendation comes with an evidence chain.
3. TriageMate drafts a first reply. Nothing is assigned or posted until the user confirms.

## Modules

- `rovo:agent` — TriageMate (prompt + conversation starters)
- `rovo:skill` — `triage-workflow`, `expert-evidence`
- `rovo:mcp` — exposes `find-experts`, `get-request-details`, `list-unassigned-requests` as MCP tools
- `action` — six actions backed by Forge functions in `src/`
- `jira:issuePanel` — TriageMate panel on each request (UI Kit, `@forge/react`):
  shows the request, finds experts with the same ranking core as the agent
  (keyword classification, since the panel has no LLM), and assigns with one click

`SKILL.md` in this repo root is an open-source skill for third-party MCP clients.

## Demo data

Ask TriageMate to "Generate demo requests for testing". It creates 12 clearly labelled DEMO
requests across 6 categories plus 6 resolved history items, so triage and expert finding can be
demonstrated on a fresh site in about 10 minutes.

## Development

```bash
npm install
forge deploy
forge install --demo-site   # needs a Forge demo site (Enterprise Jira/Confluence/JSM + Rovo)
```

Notes:

- No Forge LLM module is used (its cost falls on the developer, including during judging).
  Classification and drafting are done by the Rovo agent itself.
- No `rovo:agentConnector` (requires a self-hosted A2A server).
- Rovo usage is billed to the site where the app is installed, not to the developer.
