---
name: triage-workflow
description: "Step-by-step procedure for triaging Jira Service Management requests: fetch the request, classify it, find the best person to handle it, draft a first reply, and assign it only after the user confirms. Use this whenever the user asks to triage a request, triage the queue, or find who should handle a request."
allowed-tools: list-unassigned-requests get-request-details find-experts assign-request post-first-response
---

# Triage workflow

Follow these steps in order. Do not skip ahead: each step needs the previous step's output.

## Step 1 — Get the request

- If the user named a request (e.g. DESK-123), call `get-request-details` with that key.
- If the user asked about the queue ("triage the newest", "what needs attention"), call
  `list-unassigned-requests` first, show the list, and ask which request to triage — or triage the
  newest one if the user said "triage the newest unassigned requests".

## Step 2 — Classify

From the summary and description, pick one category:

- Access & accounts
- Software issue
- Hardware issue
- Network & VPN
- How-to question
- Billing & orders
- Onboarding
- Other

State the category in one line, with the reason in a few words. If the request is unclear, say so
and triage on the best available reading — do not ask the user to clarify unless the request is
genuinely ambiguous between two categories that would change who handles it.

## Step 3 — Find experts

Call `find-experts` with the issue key, the category, and 2-4 keywords from the request text.
See the `expert-evidence` skill for how to present the results.

## Step 4 — Draft the first reply

Write a short first reply for the customer (under 120 words):

- Acknowledge the specific problem in their words.
- Say what happens next (who will look at it, or what you need from them).
- Ask at most one clarifying question, only if it unblocks the work.
- Never promise a resolution time.

Show the draft to the user. Do not post it yet.

## Step 5 — Confirm, then act

Present the recommendation as: recommended assignee + evidence + draft reply. Then ask:

> "Shall I assign this to <name> and post the draft reply?"

- Only after the user confirms, call `assign-request` and then `post-first-response`.
- If the user picks a different person, use that person's account ID from the `find-experts`
  results. If they name someone not in the results, say you need that person's account and ask
  them to confirm the name — never guess an account ID.
- If the user wants the reply changed, revise the draft and confirm again before posting.

## Error handling

- `get-request-details` fails: the key may be wrong or the request may be in a project the user
  cannot see. Say so and ask the user to check the key.
- `find-experts` returns no candidates: say plainly that nobody on this site has resolved a
  similar request yet. Suggest keeping the request in the queue or assigning it to the on-call
  agent. Never invent a candidate.
- `assign-request` or `post-first-response` fails: report exactly what failed and what succeeded
  (e.g. "assigned, but the reply did not post"). Offer to retry the failed step.
- Demo data: if the user asks to set up a demo, call `generate-demo-requests`. It creates
  clearly labelled DEMO requests plus resolved history items. Warn the user it creates 18 items.
