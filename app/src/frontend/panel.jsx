// TriageMate issue panel (UI Kit, @forge/react).
// Shows the request, finds the best person to handle it (same ranking core
// as the Rovo agent), and assigns with one click after the agent confirms.
import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Text,
  Button,
  ButtonGroup,
  Heading,
  SectionMessage,
  Spinner,
  Stack,
} from '@forge/react';
import { invoke } from '@forge/bridge';
import { useProductContext } from '@forge/react';

const App = () => {
  const context = useProductContext();
  const issueKey = context?.extension?.issue?.key;

  const [details, setDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [experts, setExperts] = useState(null);
  const [finding, setFinding] = useState(false);
  const [assigning, setAssigning] = useState(null);
  const [assigned, setAssigned] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!issueKey) return;
    invoke('getDetails', { issueKey })
      .then((d) => {
        setDetails(d);
        setLoadingDetails(false);
      })
      .catch((err) => {
        setError(`Could not load this request: ${err.message}`);
        setLoadingDetails(false);
      });
  }, [issueKey]);

  const onFindExperts = async () => {
    setFinding(true);
    setError(null);
    setAssigned(null);
    try {
      const result = await invoke('findExperts', { issueKey });
      setExperts(result);
    } catch (err) {
      setError(`Expert search failed: ${err.message}`);
    } finally {
      setFinding(false);
    }
  };

  const onAssign = async (candidate) => {
    setAssigning(candidate.accountId);
    setError(null);
    try {
      await invoke('assign', {
        issueKey,
        accountId: candidate.accountId,
        displayName: candidate.displayName,
      });
      setAssigned(candidate.displayName);
      setDetails((d) => (d ? { ...d, assignee: candidate.displayName } : d));
    } catch (err) {
      setError(`Could not assign to ${candidate.displayName}: ${err.message}`);
    } finally {
      setAssigning(null);
    }
  };

  if (!issueKey) {
    return (
      <Stack space="space.200">
        <Text>Loading request…</Text>
      </Stack>
    );
  }

  return (
    <Stack space="space.200">
      <Heading size="medium">TriageMate</Heading>

      {loadingDetails && <Spinner size="medium" label="Loading request" />}

      {error && (
        <SectionMessage appearance="error" title="Something went wrong">
          <Text>{error}</Text>
        </SectionMessage>
      )}

      {details && (
        <Stack space="space.100">
          <Text>
            {details.key} · {details.status}
            {details.priority ? ` · ${details.priority}` : ''}
          </Text>
          <Text>{details.summary}</Text>
          <Text>
            Reporter: {details.reporter || 'Unknown'} · Assignee:{' '}
            {details.assignee || 'Unassigned'}
          </Text>
        </Stack>
      )}

      {assigned && (
        <SectionMessage appearance="confirmation" title="Assigned">
          <Text>
            {details?.key} is now assigned to {assigned}.
          </Text>
        </SectionMessage>
      )}

      <ButtonGroup>
        <Button appearance="primary" onClick={onFindExperts} isDisabled={finding || loadingDetails}>
          {finding ? 'Finding experts…' : 'Find experts'}
        </Button>
      </ButtonGroup>

      {experts && (
        <Stack space="space.200">
          <Text>
            Suggested category: {experts.suggestedCategory}
            {experts.similarRequestsFound != null &&
              ` · ${experts.similarRequestsFound} similar resolved requests found`}
          </Text>

          {experts.candidates.length === 0 && (
            <SectionMessage appearance="information" title="No expert found yet">
              <Text>{experts.note}</Text>
            </SectionMessage>
          )}

          {experts.candidates.slice(0, 3).map((c, i) => (
            <Stack key={c.accountId} space="space.100">
              <Text>
                {i === 0 ? '★ ' : ''}
                {c.displayName} — {c.similarResolved} similar resolved, {c.openCount} open now
                {c.sameTeam ? ', same team as reporter' : ''}
              </Text>
              {c.evidence.map((line) => (
                <Text key={line}>{line}</Text>
              ))}
              <Button
                appearance={i === 0 ? 'primary' : 'default'}
                onClick={() => onAssign(c)}
                isDisabled={assigning !== null}
                isLoading={assigning === c.accountId}
              >
                Assign to {c.displayName}
              </Button>
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
};

ForgeReconciler.render(<App />);
