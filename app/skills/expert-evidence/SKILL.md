---
name: expert-evidence
description: "How to interpret find-experts results for a service request: rank candidates by relevant experience, current workload, and team connection with the requester, and present each recommendation with a short evidence chain. Use this whenever find-experts returns candidates."
allowed-tools: find-experts get-request-details
---

# Expert evidence

## Tools this skill uses

- `find-experts` — the source of the ranked candidates and their evidence. Every
  recommendation in this skill starts from its output.
- `get-request-details` — re-read the request itself (summary, description, reporter,
  priority) when the candidate evidence is thin or ambiguous, so the recommendation
  stays grounded in what the customer actually asked for.

`find-experts` returns ranked candidates. Each candidate carries:

- `similarResolved` — how many similar requests they resolved before (the strongest signal)
- `similarExamples` — keys of similar requests they resolved (proof, not just a count)
- `openCount` — how many open requests they currently have (workload penalty)
- `sameTeam` — whether they share a team with the requester (collaboration bonus)
- `score` — the ranking score: `2 × similarResolved − 0.5 × openCount + (sameTeam ? 2 : 0)`
- `evidence` — pre-written evidence lines

## Presenting results

Show the top candidate first, then the next two at most, in a compact table:

| Person | Similar resolved | Open now | Why them |
| --- | --- | --- | --- |
| Ana | 4 (DESK-101, DESK-98) | 2 | Most experience with this category, light load |

Then give the one-sentence recommendation: who, and why them.

## Rules

- Never reorder the ranking without saying why. If you disagree with the top candidate (for
  example, the top candidate is on leave — something the tools cannot see), say so explicitly and
  name the trade-off.
- Never present a score without its evidence. A number without the story behind it is not a
  recommendation.
- If all candidates have zero similar resolved requests, say so: the ranking then reflects
  workload and team connection only, and the recommendation is weaker. Suggest the queue or the
  on-call agent as an alternative.
- If `similarRequestsFound` is 0, the site has no resolved history to learn from. Say that the
  recommendation is based on workload and team data only.
- Do not claim a candidate is "the best" in any absolute sense. Say "the best match from the
  available data" and name what the data shows.
