// Pure expert-ranking logic (no Forge dependencies, unit-testable).
//
// Scoring: relevant experience matters most, current workload penalises,
// sharing a team with the reporter is a bonus.
//   score = 2 * similarResolvedCount - 0.5 * openCount + (sameTeam ? 2 : 0)

/**
 * @param {Array} candidates - [{ accountId, displayName, similarResolved, similarExamples, openCount, totalAssigned, sameTeam, teams }]
 * @returns ranked candidates (highest score first) with score + evidence lines.
 */
export function rankCandidates(candidates) {
  return candidates
    .map((c) => {
      const similarResolved = c.similarResolved || 0;
      const openCount = c.openCount || 0;
      const sameTeam = !!c.sameTeam;
      const score = 2 * similarResolved - 0.5 * openCount + (sameTeam ? 2 : 0);
      const evidence = [];
      if (similarResolved > 0) {
        evidence.push(`Resolved ${similarResolved} similar request${similarResolved > 1 ? 's' : ''}`);
      }
      evidence.push(`${openCount} open request${openCount === 1 ? '' : 's'} right now`);
      if (sameTeam) evidence.push('Works in a team with the requester');
      if (c.similarExamples?.length) {
        evidence.push(`e.g. ${c.similarExamples.slice(0, 3).join(', ')}`);
      }
      return { ...c, score, evidence };
    })
    .sort((a, b) => b.score - a.score || b.similarResolved - a.similarResolved || a.openCount - b.openCount);
}
