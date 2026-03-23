const AGENT_NAMES = Object.freeze({
  froggychat: 'FroggyChat',
  planner: 'FroggyPlanner',
  foundry: 'FroggyFoundry',
  guardian: 'FroggyGuardian',
  stationFinder: 'StationFinder',
  investmentProposalGenerator: 'InvestmentProposalGenerator',
  stationAssetIssuer: 'StationAssetIssuer',
  guardianPolicyCreator: 'GuardianPolicyCreator',
  guardianPolicySummarizer: 'GuardianPolicySummarizer',
});

const ENDPOINTS = Object.freeze({
  planner: '/a2a/froggy-planner',
  foundry: '/a2a/froggy-foundry',
  guardian: '/a2a/froggy-guardian',
  stationFinder: '/a2a/station-finder',
  investmentProposalGenerator: '/a2a/investment-proposal-generator',
  stationAssetIssuer: '/a2a/station-asset-issuer',
  guardianPolicyCreator: '/a2a/guardian-policy-creator',
  guardianPolicySummarizer: '/a2a/guardian-policy-summarizer',
});

const FAILURE_RESULT_RESERVED_KEYS = new Set([
  'status',
  'degraded',
  'reply',
  'errorCode',
  'trail',
  'workerTrail',
  '__trailReady',
]);

const TRAIL_META_KEYS = new Set(['trail', 'workerTrail', '__trailReady']);

function buildTrailEntry({
  stage,
  agentKey,
  endpointPath,
  thought,
  intent,
  status,
  errorCode,
  tools,
  transport,
  workerAgentKey,
  workerEndpointPath,
}) {
  return {
    stage,
    agentKey,
    agentName: AGENT_NAMES[agentKey] || agentKey,
    ...(endpointPath ? { endpointPath } : {}),
    thought,
    ...(intent ? { intent } : {}),
    ...(status ? { status } : {}),
    ...(errorCode ? { errorCode } : {}),
    ...(Array.isArray(tools) && tools.length > 0 ? { tools } : {}),
    ...(transport ? { transport } : {}),
    ...(workerAgentKey ? { workerAgentKey } : {}),
    ...(workerEndpointPath ? { workerEndpointPath } : {}),
  };
}

function omitReservedKeys(value, reservedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !reservedKeys.has(key)),
  );
}

function getEndpointPath(agentKey) {
  return ENDPOINTS[agentKey] || null;
}

function extractErrorMessage(error) {
  if (error instanceof Error) {
    return String(error.message || '').trim();
  }
  return String(error || '').trim();
}

function classifyPublicError(error, agentKey) {
  const rawMessage = extractErrorMessage(error);
  const text = rawMessage.toLowerCase();
  const defaultAgentName = AGENT_NAMES[agentKey] || 'workflow';

  if (
    text.includes('walletaddress is required') ||
    text.includes('message is required') ||
    text.includes('message or proposalid is required') ||
    text.includes('proposalid is required')
  ) {
    return {
      errorCode: 'missing_required_input',
      category: 'input',
      reply: 'I need more input to continue with this workflow.',
    };
  }

  if (
    text.includes('target area') ||
    text.includes('coordinates first') ||
    text.includes('unable to geocode') ||
    text.includes('could not resolve the requested area')
  ) {
    return {
      errorCode: 'location_input_invalid',
      category: 'input',
      reply: 'I need a clearer target location to continue with this workflow.',
    };
  }

  if (
    text.includes('could not find station') ||
    text.includes('station not found') ||
    text.includes('stationid not found') ||
    text.includes('proposal not found') ||
    text.includes('proposalid not found') ||
    text.includes('approval target required') ||
    text.includes('does not have a proposalid') ||
    text.includes('not pending admin action')
  ) {
    return {
      errorCode: 'target_not_resolved',
      category: 'resolution',
      reply:
        'I could not resolve the requested station or proposal for this workflow.',
    };
  }

  if (text.includes('mongodb') || text.includes('mongo')) {
    return {
      errorCode: 'storage_unavailable',
      category: 'dependency',
      reply:
        'I hit a storage dependency error while executing this workflow. Please try again shortly.',
    };
  }

  if (
    text.includes('tomtom') ||
    text.includes('geocode') ||
    text.includes('charging availability') ||
    text.includes('poi')
  ) {
    return {
      errorCode: 'location_data_unavailable',
      category: 'dependency',
      reply:
        'I hit a location-data dependency error while executing this workflow. Please try again shortly.',
    };
  }

  if (text.includes('pinata') || text.includes('ipfs')) {
    return {
      errorCode: 'metadata_dependency_error',
      category: 'dependency',
      reply:
        'I hit a metadata dependency error while executing this workflow. Please try again shortly.',
    };
  }

  if (
    text.includes('guardian') ||
    text.includes('hedera') ||
    text.includes('hcs') ||
    text.includes('mirror') ||
    text.includes('ats') ||
    text.includes('token') ||
    text.includes('deploystationbundle') ||
    text.includes('contract artifact') ||
    text.includes('rpc')
  ) {
    return {
      errorCode: 'ledger_dependency_error',
      category: 'dependency',
      reply:
        'I hit a ledger dependency error while executing this workflow. Please try again shortly.',
    };
  }

  if (
    text.includes('openai') ||
    text.includes('websearch') ||
    text.includes('llm')
  ) {
    return {
      errorCode: 'model_dependency_error',
      category: 'dependency',
      reply:
        'I hit a model or research dependency error while executing this workflow. Please try again shortly.',
    };
  }

  return {
    errorCode: 'workflow_execution_failed',
    category: 'unexpected',
    reply: `I hit an unexpected ${defaultAgentName} workflow error. Please try again shortly.`,
  };
}

function buildFailureThought(category) {
  if (category === 'input') {
    return "I don't have the required input to continue this workflow.";
  }
  if (category === 'resolution') {
    return "I can't resolve the requested target for this workflow.";
  }
  if (category === 'dependency') {
    return 'I hit a downstream dependency error while executing this workflow.';
  }
  return 'I hit an unexpected workflow error while executing this workflow.';
}

function buildCompletionThoughtForFailure({ agentKey, category, failedWorkerAgentKey }) {
  const agentName = AGENT_NAMES[agentKey] || agentKey;
  if (category === 'input') {
    return `I'm returning a degraded ${agentName} reply because I don't have enough information to continue.`;
  }
  if (category === 'resolution') {
    return `I'm returning a degraded ${agentName} reply because I can't resolve the requested target.`;
  }
  if (failedWorkerAgentKey) {
    return `I hit a downstream failure while calling ${AGENT_NAMES[failedWorkerAgentKey] || failedWorkerAgentKey}, so I'm returning a degraded ${agentName} reply.`;
  }
  return `I'm returning a degraded ${agentName} reply because the workflow did not finish cleanly.`;
}

function buildFailureResult({
  agentKey,
  intent,
  error,
  existingTrail,
  failedAgentKey,
  status = 'failed',
  failureThought,
  completionThought,
  extra,
}) {
  const safeError = classifyPublicError(error, agentKey);
  const normalizedExtra = omitReservedKeys(extra, FAILURE_RESULT_RESERVED_KEYS);
  const trail = [
    ...(Array.isArray(existingTrail) ? existingTrail : []),
    buildTrailEntry({
      stage: 'failed',
      agentKey: failedAgentKey || agentKey,
      endpointPath: getEndpointPath(failedAgentKey || agentKey),
      intent: intent || null,
      status,
      errorCode: safeError.errorCode,
      thought: failureThought || buildFailureThought(safeError.category),
    }),
    buildTrailEntry({
      stage: 'completed',
      agentKey,
      endpointPath: getEndpointPath(agentKey),
      intent: intent || null,
      status,
      errorCode: safeError.errorCode,
      thought:
        completionThought ||
        buildCompletionThoughtForFailure({
          agentKey,
          category: safeError.category,
          failedWorkerAgentKey:
            failedAgentKey && failedAgentKey !== agentKey
              ? failedAgentKey
              : null,
        }),
    }),
  ];

  return {
    status,
    degraded: true,
    reply: safeError.reply,
    errorCode: safeError.errorCode,
    ...(intent ? { intent } : {}),
    ...normalizedExtra,
    trail,
    __trailReady: true,
  };
}

function buildPlannerFailureTrail({
  intent,
  stationFinderResult,
  investmentProposalGeneratorResult,
  failedWorkerAgentKey,
  errorCode,
  category,
}) {
  const trail = [
    buildTrailEntry({
      stage: 'classified',
      agentKey: 'planner',
      endpointPath: ENDPOINTS.planner,
      intent,
      status: 'failed',
      errorCode,
      thought:
        "I see this request in FroggyPlanner, and I'm classifying it as a station discovery and proposal workflow.",
    }),
  ];

  const stationFinderTrail = normalizeTrail(stationFinderResult);
  const investmentProposalGeneratorTrail = normalizeTrail(
    investmentProposalGeneratorResult,
  );

  if (
    intent === 'FIND_STATION_FOR_PROPOSAL' ||
    stationFinderTrail.length > 0 ||
    failedWorkerAgentKey === 'stationFinder' ||
    investmentProposalGeneratorTrail.length > 0 ||
    failedWorkerAgentKey === 'investmentProposalGenerator'
  ) {
    trail.push(
      buildTrailEntry({
        stage: 'worker_call_started',
        agentKey: 'planner',
        endpointPath: ENDPOINTS.planner,
        intent,
        status: 'failed',
        errorCode,
        workerAgentKey: 'stationFinder',
        workerEndpointPath: ENDPOINTS.stationFinder,
        transport: 'a2a_http_internal',
        thought:
          "I'm going to call StationFinder through ChargeFrog internal A2A at /a2a/station-finder.",
      }),
    );
  }

  if (stationFinderTrail.length > 0) {
    trail.push(...stationFinderTrail);
  }

  if (
    investmentProposalGeneratorTrail.length > 0 ||
    failedWorkerAgentKey === 'investmentProposalGenerator'
  ) {
    trail.push(
      buildTrailEntry({
        stage: 'worker_call_started',
        agentKey: 'planner',
        endpointPath: ENDPOINTS.planner,
        intent,
        status: 'failed',
        errorCode,
        workerAgentKey: 'investmentProposalGenerator',
        workerEndpointPath: ENDPOINTS.investmentProposalGenerator,
        transport: 'a2a_http_internal',
        thought:
          "Back in FroggyPlanner, I now have the station candidate, and I'm going to call InvestmentProposalGenerator through ChargeFrog internal A2A at /a2a/investment-proposal-generator.",
      }),
    );
    if (investmentProposalGeneratorTrail.length > 0) {
      trail.push(...investmentProposalGeneratorTrail);
    }
  }

  trail.push(
    buildTrailEntry({
      stage: 'failed',
      agentKey: failedWorkerAgentKey || 'planner',
      endpointPath: getEndpointPath(failedWorkerAgentKey || 'planner'),
      intent,
      status: 'failed',
      errorCode,
      thought: buildFailureThought(category),
    }),
    buildTrailEntry({
      stage: 'completed',
      agentKey: 'planner',
      endpointPath: ENDPOINTS.planner,
      intent,
      status: 'failed',
      errorCode,
      thought: buildCompletionThoughtForFailure({
        agentKey: 'planner',
        category,
        failedWorkerAgentKey,
      }),
    }),
  );

  return trail;
}

function buildFoundryFailureTrail({
  phase,
  failedWorkerAgentKey,
  errorCode,
  category,
}) {
  const trail = [
    buildTrailEntry({
      stage: 'classified',
      agentKey: 'foundry',
      endpointPath: ENDPOINTS.foundry,
      status: 'failed',
      errorCode,
      thought:
        phase === 'queue'
          ? "I see this request in FroggyFoundry, and I'm classifying it as a pending-admin-attention workflow."
          : "I see this request in FroggyFoundry, and I'm classifying it as a deployment-and-issuance workflow.",
    }),
  ];

  if (phase === 'deployment' || phase === 'issuance') {
    trail.push(
      buildTrailEntry({
        stage: 'tools_executed',
        agentKey: 'foundry',
        endpointPath: ENDPOINTS.foundry,
        status: 'failed',
        errorCode,
        tools: [
          'readOnChainProposal',
          'readOffChainMetadata',
          'getStationByProposalId',
          'getStation',
          'deployStationBundle',
          'saveStationDeployment',
        ],
        thought:
          "I'm resolving the proposal and station context and executing the ChargeFrog deployment flow for this station.",
      }),
    );
  }

  if (phase === 'issuance' || failedWorkerAgentKey === 'stationAssetIssuer') {
    trail.push(
      buildTrailEntry({
        stage: 'worker_call_started',
        agentKey: 'foundry',
        endpointPath: ENDPOINTS.foundry,
        status: 'failed',
        errorCode,
        workerAgentKey: 'stationAssetIssuer',
        workerEndpointPath: ENDPOINTS.stationAssetIssuer,
        transport: 'a2a_http_internal',
        thought:
          "I'm going to call StationAssetIssuer through ChargeFrog internal A2A at /a2a/station-asset-issuer.",
      }),
    );
  }

  trail.push(
    buildTrailEntry({
      stage: 'failed',
      agentKey: failedWorkerAgentKey || 'foundry',
      endpointPath: getEndpointPath(failedWorkerAgentKey || 'foundry'),
      status: 'failed',
      errorCode,
      thought: buildFailureThought(category),
    }),
    buildTrailEntry({
      stage: 'completed',
      agentKey: 'foundry',
      endpointPath: ENDPOINTS.foundry,
      status: 'failed',
      errorCode,
      thought: buildCompletionThoughtForFailure({
        agentKey: 'foundry',
        category,
        failedWorkerAgentKey,
      }),
    }),
  );

  return trail;
}

function buildGuardianFailureTrail({
  intent,
  failedWorkerAgentKey,
  errorCode,
  category,
}) {
  const trail = [
    buildTrailEntry({
      stage: 'classified',
      agentKey: 'guardian',
      endpointPath: ENDPOINTS.guardian,
      intent,
      status: 'failed',
      errorCode,
      thought:
        intent === 'POLICY_ENQUIRY'
          ? "I see this is a Guardian policy enquiry, so I'm routing it through FroggyGuardian."
          : intent === 'CREATE_GUARDIAN_POLICIES_FOR_STATION'
            ? "I see this is a Guardian policy and schema creation request, so I'm routing it through FroggyGuardian."
            : "I see this is a Guardian admin request, so I'm routing it through FroggyGuardian.",
    }),
  ];

  if (failedWorkerAgentKey) {
    trail.push(
      buildTrailEntry({
        stage: 'worker_call_started',
        agentKey: 'guardian',
        endpointPath: ENDPOINTS.guardian,
        intent,
        status: 'failed',
        errorCode,
        workerAgentKey: failedWorkerAgentKey,
        workerEndpointPath: getEndpointPath(failedWorkerAgentKey),
        transport: 'a2a_http_internal',
        thought: `I'm going to call ${AGENT_NAMES[failedWorkerAgentKey] || failedWorkerAgentKey} through ChargeFrog internal A2A at ${getEndpointPath(failedWorkerAgentKey)}.`,
      }),
    );
  }

  trail.push(
    buildTrailEntry({
      stage: 'failed',
      agentKey: failedWorkerAgentKey || 'guardian',
      endpointPath: getEndpointPath(failedWorkerAgentKey || 'guardian'),
      intent,
      status: 'failed',
      errorCode,
      thought: buildFailureThought(category),
    }),
    buildTrailEntry({
      stage: 'completed',
      agentKey: 'guardian',
      endpointPath: ENDPOINTS.guardian,
      intent,
      status: 'failed',
      errorCode,
      thought: buildCompletionThoughtForFailure({
        agentKey: 'guardian',
        category,
        failedWorkerAgentKey,
      }),
    }),
  );

  return trail;
}

function buildWorkerFailureTrail({ agentKey, errorCode, category }) {
  const initialThoughtByAgent = {
    stationFinder:
      "I see this request in StationFinder, and I'm starting the station discovery workflow.",
    investmentProposalGenerator:
      "I see a candidate-ready station, and I'm starting the proposal generation workflow.",
    stationAssetIssuer:
      "I see this request in StationAssetIssuer, and I'm starting the station asset issuance workflow.",
    guardianPolicyCreator:
      "I see this request in GuardianPolicyCreator, and I'm starting the Guardian policy creation workflow.",
    guardianPolicySummarizer:
      "I see this request in GuardianPolicySummarizer, and I'm starting the Guardian policy summarization workflow.",
  };

  return [
    buildTrailEntry({
      stage: 'classified',
      agentKey,
      endpointPath: getEndpointPath(agentKey),
      status: 'failed',
      errorCode,
      thought: initialThoughtByAgent[agentKey] || 'I am starting this workflow.',
    }),
    buildTrailEntry({
      stage: 'failed',
      agentKey,
      endpointPath: getEndpointPath(agentKey),
      status: 'failed',
      errorCode,
      thought: buildFailureThought(category),
    }),
    buildTrailEntry({
      stage: 'completed',
      agentKey,
      endpointPath: getEndpointPath(agentKey),
      status: 'failed',
      errorCode,
      thought:
        "I'm returning a degraded result to the calling workflow because this internal step did not finish cleanly.",
    }),
  ];
}

function normalizeTrail(result) {
  return Array.isArray(result?.trail) ? result.trail : [];
}

function buildPlannerCoordinatorTrail({
  result,
  stationFinderResult,
  investmentProposalGeneratorResult,
}) {
  if (
    !result ||
    typeof result !== 'object' ||
    (!result.intent && !result.stationCandidate)
  ) {
    return [];
  }

  const intent = result.intent || 'FIND_STATION_FOR_PROPOSAL';
  if (intent !== 'FIND_STATION_FOR_PROPOSAL') {
    return [];
  }

  const stationFinderTrail = normalizeTrail(stationFinderResult);
  const investmentProposalGeneratorTrail = normalizeTrail(
    investmentProposalGeneratorResult,
  );
  const failedWorkerAgentKey =
    stationFinderResult?.status === 'failed'
      ? 'stationFinder'
      : investmentProposalGeneratorResult?.status === 'failed'
        ? 'investmentProposalGenerator'
        : null;
  const isFailureResult =
    result?.status === 'failed' ||
    result?.degraded === true ||
    Boolean(failedWorkerAgentKey);

  const trail = [
    buildTrailEntry({
      stage: 'classified',
      agentKey: 'planner',
      endpointPath: ENDPOINTS.planner,
      intent,
      status: result.status || null,
      thought:
        "I see this request in FroggyPlanner, and I'm classifying it as a station discovery and proposal workflow.",
    }),
    buildTrailEntry({
      stage: 'worker_call_started',
      agentKey: 'planner',
      endpointPath: ENDPOINTS.planner,
      workerAgentKey: 'stationFinder',
      workerEndpointPath: ENDPOINTS.stationFinder,
      transport: 'a2a_http_internal',
      thought:
        "I'm going to call StationFinder through ChargeFrog internal A2A at /a2a/station-finder.",
    }),
  ];

  if (stationFinderTrail.length > 0) {
    trail.push(...stationFinderTrail);
  }

  if (investmentProposalGeneratorTrail.length > 0) {
    trail.push(
      buildTrailEntry({
        stage: 'worker_call_started',
        agentKey: 'planner',
        endpointPath: ENDPOINTS.planner,
        workerAgentKey: 'investmentProposalGenerator',
        workerEndpointPath: ENDPOINTS.investmentProposalGenerator,
        transport: 'a2a_http_internal',
        thought:
          "Back in FroggyPlanner, I now have the station candidate, and I'm going to call InvestmentProposalGenerator through ChargeFrog internal A2A at /a2a/investment-proposal-generator.",
      }),
      ...investmentProposalGeneratorTrail,
    );
  }

  trail.push(
    buildTrailEntry({
      stage: 'completed',
      agentKey: 'planner',
      endpointPath: ENDPOINTS.planner,
      intent,
      status: result.status || null,
      thought:
        isFailureResult
          ? buildCompletionThoughtForFailure({
              agentKey: 'planner',
              category: 'dependency',
              failedWorkerAgentKey,
            })
          : result.status === 'not_enough_interest'
          ? "I see the threshold is still below the requirement, so I'm returning the final not-enough-interest reply from FroggyPlanner."
          : "I'm returning the final FroggyPlanner reply now that the proposal workflow has finished.",
    }),
  );

  return trail;
}

function buildFoundryCoordinatorTrail({ result, stationAssetIssuerResult }) {
  if (!result || typeof result !== 'object') {
    return [];
  }

  const status = result.status || null;
  if (
    status !== 'deployment_and_issuance_complete' &&
    status !== 'deployment_complete_issuance_pending'
  ) {
    return [];
  }

  const issuerTrail = normalizeTrail(stationAssetIssuerResult);
  const isFailureResult =
    result?.degraded === true || stationAssetIssuerResult?.status === 'failed';
  const trail = [
    buildTrailEntry({
      stage: 'classified',
      agentKey: 'foundry',
      endpointPath: ENDPOINTS.foundry,
      status,
      thought:
        "I see this request in FroggyFoundry, and I'm classifying it as a deployment-and-issuance workflow.",
    }),
    buildTrailEntry({
      stage: 'tools_executed',
      agentKey: 'foundry',
      endpointPath: ENDPOINTS.foundry,
      status,
      tools: [
        'readOnChainProposal',
        'readOffChainMetadata',
        'getStationByProposalId',
        'getStation',
        'deployStationBundle',
        'saveStationDeployment',
      ],
      thought:
        "I'm resolving the proposal and station context, executing the ChargeFrog station deployment flow, and persisting the deployment metadata.",
    }),
    buildTrailEntry({
      stage: 'worker_call_started',
      agentKey: 'foundry',
      endpointPath: ENDPOINTS.foundry,
      status,
      workerAgentKey: 'stationAssetIssuer',
      workerEndpointPath: ENDPOINTS.stationAssetIssuer,
      transport: 'a2a_http_internal',
      thought:
        "Now that deployment is finished, I'm going to call StationAssetIssuer through ChargeFrog internal A2A at /a2a/station-asset-issuer.",
    }),
  ];

  if (issuerTrail.length > 0) {
    trail.push(...issuerTrail);
  }

  trail.push(
    buildTrailEntry({
      stage: 'completed',
      agentKey: 'foundry',
      endpointPath: ENDPOINTS.foundry,
      status,
      thought:
        isFailureResult
          ? buildCompletionThoughtForFailure({
              agentKey: 'foundry',
              category: 'dependency',
              failedWorkerAgentKey:
                stationAssetIssuerResult?.status === 'failed'
                  ? 'stationAssetIssuer'
                  : null,
            })
          : status === 'deployment_and_issuance_complete'
          ? "I'm returning the final FroggyFoundry reply with the station deployment and asset issuance result."
          : "I'm returning the deployment result from FroggyFoundry, but the asset issuance step is not finishing cleanly.",
    }),
  );

  return trail;
}

function buildGuardianCoordinatorTrail({
  result,
  workerAgentKey,
  workerResult,
}) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return [];
  }

  const intent = result.intent || null;
  if (
    intent !== 'LIST_FULLY_INVESTED_STATIONS' &&
    intent !== 'CREATE_GUARDIAN_POLICIES_FOR_STATION' &&
    intent !== 'POLICY_ENQUIRY'
  ) {
    return [];
  }

  const resolvedWorkerAgentKey =
    workerAgentKey ||
    (intent === 'POLICY_ENQUIRY'
      ? 'guardianPolicySummarizer'
      : 'guardianPolicyCreator');
  const workerEndpointPath = ENDPOINTS[resolvedWorkerAgentKey];
  const workerTrail = normalizeTrail(workerResult);
  const isFailureResult =
    result?.status === 'failed' ||
    result?.degraded === true ||
    workerResult?.status === 'failed';
  const classifiedThoughtByIntent = {
    LIST_FULLY_INVESTED_STATIONS:
      "I see this is a Guardian admin request about fully-invested stations, so I'm routing it through FroggyGuardian.",
    CREATE_GUARDIAN_POLICIES_FOR_STATION:
      "I see this is a Guardian policy and schema creation request, so I'm routing it through FroggyGuardian.",
    POLICY_ENQUIRY:
      "I see this is a Guardian policy enquiry, so I'm routing it through FroggyGuardian.",
  };
  const completionThoughtByIntent = {
    LIST_FULLY_INVESTED_STATIONS:
      Array.isArray(result.stations) && result.stations.length === 0
        ? `I'm returning the final FroggyGuardian reply that there are currently no fully-invested stations ready for Guardian work.`
        : "I'm returning the final FroggyGuardian reply with the fully-invested stations that are ready for Guardian work.",
    CREATE_GUARDIAN_POLICIES_FOR_STATION:
      "I'm returning the final FroggyGuardian replication workflow response now that the policy-creation flow is finished.",
    POLICY_ENQUIRY:
      "I'm returning the final FroggyGuardian policy explanation now that the lookup and summarization flow is finished.",
  };

  const trail = [
    buildTrailEntry({
      stage: 'classified',
      agentKey: 'guardian',
      endpointPath: ENDPOINTS.guardian,
      intent,
      thought: classifiedThoughtByIntent[intent],
    }),
    buildTrailEntry({
      stage: 'worker_call_started',
      agentKey: 'guardian',
      endpointPath: ENDPOINTS.guardian,
      intent,
      workerAgentKey: resolvedWorkerAgentKey,
      workerEndpointPath,
      transport: 'a2a_http_internal',
      thought: `I'm going to call ${AGENT_NAMES[resolvedWorkerAgentKey]} through ChargeFrog internal A2A at ${workerEndpointPath}.`,
    }),
  ];

  if (workerTrail.length > 0) {
    trail.push(...workerTrail);
  }

  trail.push(
    buildTrailEntry({
      stage: 'completed',
      agentKey: 'guardian',
      endpointPath: ENDPOINTS.guardian,
      intent,
      thought: isFailureResult
        ? buildCompletionThoughtForFailure({
            agentKey: 'guardian',
            category: 'dependency',
            failedWorkerAgentKey:
              workerResult?.status === 'failed' ? resolvedWorkerAgentKey : null,
          })
        : completionThoughtByIntent[intent],
    }),
  );

  return trail;
}

function applyAgentTrail(agentKey, result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return result;
  }

  if (result.__trailReady === true) {
    return omitReservedKeys(result, new Set(['__trailReady']));
  }

  const existingTrail = normalizeTrail(result);
  const trail = buildAgentTrail({ agentKey, result });
  const normalizedResult = omitReservedKeys(result, TRAIL_META_KEYS);

  if (trail.length === 0 && existingTrail.length === 0) {
    return result;
  }

  if (trail.length === 0) {
    return result;
  }

  if (existingTrail.length === 0) {
    return {
      ...normalizedResult,
      trail,
    };
  }

  return {
    ...normalizedResult,
    trail: [...trail, ...existingTrail],
  };
}

function buildPlannerTrail(result) {
  const trail = [];
  const status = result?.status || null;
  const intent = result?.intent || null;

  if (intent === 'FIND_STATION_FOR_PROPOSAL' || result?.stationCandidate) {
    trail.push(
      buildTrailEntry({
        stage: 'classified',
        agentKey: 'planner',
        endpointPath: ENDPOINTS.planner,
        intent: intent || 'FIND_STATION_FOR_PROPOSAL',
        status,
        thought:
          'I see this request in FroggyPlanner, and I am classifying it as a station discovery and proposal workflow.',
      }),
      buildTrailEntry({
        stage: 'worker_call_started',
        agentKey: 'planner',
        endpointPath: ENDPOINTS.planner,
        workerAgentKey: 'stationFinder',
        workerEndpointPath: ENDPOINTS.stationFinder,
        transport: 'a2a_http_internal',
        thought:
          'I am calling StationFinder through ChargeFrog internal A2A at /a2a/station-finder.',
      }),
    );

    if (status === 'not_enough_interest') {
      trail.push(
        buildTrailEntry({
          stage: 'worker_tools_executed',
          agentKey: 'stationFinder',
          endpointPath: ENDPOINTS.stationFinder,
          status,
        tools: [
          'resolveAreaCenter',
          'registerMiniNode',
          'getNeighborhoodSummary',
        ],
        thought:
          "I'm going to use resolveAreaCenter, registerMiniNode, and getNeighborhoodSummary to resolve the area and measure current demand.",
      }),
        buildTrailEntry({
          stage: 'completed',
          agentKey: 'planner',
          endpointPath: ENDPOINTS.planner,
          status,
        thought:
          "I see the current interest count is still below the threshold, so I'm returning the final reply without generating a proposal.",
      }),
      );
      return trail;
    }

    trail.push(
      buildTrailEntry({
        stage: 'worker_tools_executed',
        agentKey: 'stationFinder',
        endpointPath: ENDPOINTS.stationFinder,
        status: 'candidate_ready',
        tools: [
          'resolveAreaCenter',
          'registerMiniNode',
          'getNeighborhoodSummary',
          'getPoi',
          'getChargingAvailability',
          'proposeStationArea',
          'reverseGeocode',
        ],
        thought:
          "I'm resolving the area, registering interest, checking neighborhood demand, and using POI and charging evidence to propose a concrete station candidate.",
      }),
      buildTrailEntry({
        stage: 'worker_call_started',
        agentKey: 'planner',
        endpointPath: ENDPOINTS.planner,
        workerAgentKey: 'investmentProposalGenerator',
        workerEndpointPath: ENDPOINTS.investmentProposalGenerator,
        transport: 'a2a_http_internal',
        thought:
          "I see the interest threshold is met, so I'm going to call InvestmentProposalGenerator through ChargeFrog internal A2A at /a2a/investment-proposal-generator.",
      }),
      buildTrailEntry({
        stage: 'worker_tools_executed',
        agentKey: 'investmentProposalGenerator',
        endpointPath: ENDPOINTS.investmentProposalGenerator,
        status: result?.proposalWorkflowStatus || status,
        tools: [
          'findStationByLocation',
          'webSearch',
          'llm.investmentProposalGenerator',
          'createInvestmentProposal',
          'createInvestmentProposalRecord',
          'uploadJsonToIpfsWithPinata',
          'publishInvestmentProposalOnChain',
          'updateProposalOnChainRecord',
          'appendAuditLog',
        ],
        thought:
          "I'm checking for duplicate stations, gathering web research, drafting the proposal, pinning metadata to IPFS, and anchoring the proposal on Hedera HCS.",
      }),
      buildTrailEntry({
        stage: 'completed',
        agentKey: 'planner',
        endpointPath: ENDPOINTS.planner,
        status,
        thought:
          "I'm returning the final reply that the proposal is created and is now waiting for admin approval.",
      }),
    );
    return trail;
  }

  if (status === 'listed') {
    return [
      buildTrailEntry({
        stage: 'classified',
        agentKey: 'planner',
        endpointPath: ENDPOINTS.planner,
        status,
        thought:
          'I see this request in FroggyPlanner, and I am recognizing it as an investable-stations listing workflow.',
      }),
      buildTrailEntry({
        stage: 'tools_executed',
        agentKey: 'planner',
        endpointPath: ENDPOINTS.planner,
        status,
        tools: ['listStationsAvailable'],
        thought:
          'I am using listStationsAvailable to fetch the current set of investable stations.',
      }),
      buildTrailEntry({
        stage: 'completed',
        agentKey: 'planner',
        endpointPath: ENDPOINTS.planner,
        status,
        thought: 'I am returning the formatted investable station list.',
      }),
    ];
  }

  if (status === 'equity_purchased' || status === 'bond_purchased') {
    const assetType = result?.purchase?.assetType || 'asset';
    const mintTool = assetType === 'bond' ? 'mintBond' : 'mintEquity';
    const issueTool = assetType === 'bond' ? 'issueBond' : 'issueEquity';
    return [
      buildTrailEntry({
        stage: 'classified',
        agentKey: 'planner',
        endpointPath: ENDPOINTS.planner,
        status,
        thought: `I see this request in FroggyPlanner, and I am classifying it as a ${assetType} purchase workflow.`,
      }),
      buildTrailEntry({
        stage: 'station_resolved',
        agentKey: 'planner',
        endpointPath: ENDPOINTS.planner,
        status,
        tools: ['getStation', 'listStationsAvailable', 'listAllStations'],
        thought:
          'I am resolving the target station and token context before attempting the purchase.',
      }),
      buildTrailEntry({
        stage: 'tools_executed',
        agentKey: 'planner',
        endpointPath: ENDPOINTS.planner,
        status,
        tools: [mintTool, issueTool],
        thought: `I am executing ${mintTool} and ${issueTool}, which perform the ATS mint and issue flow for the selected station.`,
      }),
      buildTrailEntry({
        stage: 'completed',
        agentKey: 'planner',
        endpointPath: ENDPOINTS.planner,
        status,
        thought: `I am returning the final ${assetType} purchase response with the mint and issue transaction results.`,
      }),
    ];
  }

  if (status === 'balance_retrieved') {
    return [
      buildTrailEntry({
        stage: 'classified',
        agentKey: 'planner',
        endpointPath: ENDPOINTS.planner,
        status,
        thought:
          'I see this request in FroggyPlanner, and I am classifying it as a token balance lookup workflow.',
      }),
      buildTrailEntry({
        stage: 'station_resolved',
        agentKey: 'planner',
        endpointPath: ENDPOINTS.planner,
        status,
        tools: ['getStation', 'listStationsAvailable', 'listAllStations'],
        thought:
          'I am resolving the station and token context before performing the balance lookup.',
      }),
      buildTrailEntry({
        stage: 'tools_executed',
        agentKey: 'planner',
        endpointPath: ENDPOINTS.planner,
        status,
        tools: ['getTokenBalance'],
        thought:
          'I am running getTokenBalance, which performs the ATS balance lookup for the selected token.',
      }),
      buildTrailEntry({
        stage: 'completed',
        agentKey: 'planner',
        endpointPath: ENDPOINTS.planner,
        status,
        thought: 'I am returning the final token balance response.',
      }),
    ];
  }

  return [];
}

function buildFoundryTrail(result) {
  const status = result?.status || null;

  if (status === 'pending_admin_action_queue') {
    return [
      buildTrailEntry({
        stage: 'classified',
        agentKey: 'foundry',
        endpointPath: ENDPOINTS.foundry,
        status,
        thought:
          'I see this request in FroggyFoundry, and I am classifying it as a pending-admin-attention workflow.',
      }),
      buildTrailEntry({
        stage: 'tools_executed',
        agentKey: 'foundry',
        endpointPath: ENDPOINTS.foundry,
        status,
        tools: [
          'listStationsByStage',
          'readOnChainProposal',
          'readOffChainMetadata',
        ],
        thought:
          'I am listing the pending-admin-action stations, then reconstructing each proposal summary from on-chain and off-chain metadata.',
      }),
      buildTrailEntry({
        stage: 'completed',
        agentKey: 'foundry',
        endpointPath: ENDPOINTS.foundry,
        status,
        thought:
          'I am returning the list of stations that currently require admin attention.',
      }),
    ];
  }

  if (
    status === 'deployment_and_issuance_complete' ||
    status === 'deployment_complete_issuance_pending'
  ) {
    return [
      buildTrailEntry({
        stage: 'classified',
        agentKey: 'foundry',
        endpointPath: ENDPOINTS.foundry,
        status,
        thought:
          'I see this request in FroggyFoundry, and I am classifying it as a deployment-and-issuance workflow.',
      }),
      buildTrailEntry({
        stage: 'tools_executed',
        agentKey: 'foundry',
        endpointPath: ENDPOINTS.foundry,
        status,
        tools: [
          'readOnChainProposal',
          'readOffChainMetadata',
          'getStationByProposalId',
          'getStation',
          'deployStationBundle',
          'saveStationDeployment',
        ],
        thought:
          'I am resolving the proposal and station context, executing the ChargeFrog station deployment flow, and persisting the deployment metadata.',
      }),
      buildTrailEntry({
        stage: 'worker_call_started',
        agentKey: 'foundry',
        endpointPath: ENDPOINTS.foundry,
        status,
        workerAgentKey: 'stationAssetIssuer',
        workerEndpointPath: ENDPOINTS.stationAssetIssuer,
        transport: 'a2a_http_internal',
        thought:
          'Now that deployment is finished, I am calling StationAssetIssuer through ChargeFrog internal A2A at /a2a/station-asset-issuer.',
      }),
      buildTrailEntry({
        stage: 'worker_tools_executed',
        agentKey: 'stationAssetIssuer',
        endpointPath: ENDPOINTS.stationAssetIssuer,
        status: result?.issuance?.status || null,
        tools: [
          'readOnChainProposal',
          'readOffChainMetadata',
          'generateISIN',
          'createEquityToken',
          'createBondToken',
          'saveIssuedAssets',
        ],
        thought:
          "I'm loading the proposal context, generating ISIN values, creating the equity and bond tokens, and saving the issued asset state.",
      }),
      buildTrailEntry({
        stage: 'completed',
        agentKey: 'foundry',
        endpointPath: ENDPOINTS.foundry,
        status,
        thought:
          status === 'deployment_and_issuance_complete'
            ? 'I am returning the final response with the complete deployment and token-issuance result.'
            : 'I am returning the deployment result, but token issuance is not finishing cleanly.',
      }),
    ];
  }

  return [];
}

function buildGuardianTrail(result) {
  const intent = result?.intent || null;

  if (intent === 'LIST_FULLY_INVESTED_STATIONS') {
    return [
      buildTrailEntry({
        stage: 'classified',
        agentKey: 'guardian',
        endpointPath: ENDPOINTS.guardian,
        intent,
        thought:
          'I see this request in FroggyGuardian, and I am classifying it as a fully-invested-stations admin workflow.',
      }),
      buildTrailEntry({
        stage: 'worker_call_started',
        agentKey: 'guardian',
        endpointPath: ENDPOINTS.guardian,
        intent,
        workerAgentKey: 'guardianPolicyCreator',
        workerEndpointPath: ENDPOINTS.guardianPolicyCreator,
        transport: 'a2a_http_internal',
        thought:
          'I am calling GuardianPolicyCreator through ChargeFrog internal A2A at /a2a/guardian-policy-creator.',
      }),
      buildTrailEntry({
        stage: 'worker_tools_executed',
        agentKey: 'guardianPolicyCreator',
        endpointPath: ENDPOINTS.guardianPolicyCreator,
        intent,
        tools: ['listFullyInvestedStations', "listStationsByStage('fully-invested')"],
        thought:
          "I'm listing the fully-invested stations that are ready for Guardian policy work.",
      }),
      buildTrailEntry({
        stage: 'completed',
        agentKey: 'guardian',
        endpointPath: ENDPOINTS.guardian,
        intent,
        thought:
          'I am returning the final fully-invested-stations response to the caller.',
      }),
    ];
  }

  if (intent === 'CREATE_GUARDIAN_POLICIES_FOR_STATION') {
    return [
      buildTrailEntry({
        stage: 'classified',
        agentKey: 'guardian',
        endpointPath: ENDPOINTS.guardian,
        intent,
        thought:
          'I see this request in FroggyGuardian, and I am classifying it as a Guardian policy and schema creation workflow.',
      }),
      buildTrailEntry({
        stage: 'worker_call_started',
        agentKey: 'guardian',
        endpointPath: ENDPOINTS.guardian,
        intent,
        workerAgentKey: 'guardianPolicyCreator',
        workerEndpointPath: ENDPOINTS.guardianPolicyCreator,
        transport: 'a2a_http_internal',
        thought:
          'I am calling GuardianPolicyCreator through ChargeFrog internal A2A at /a2a/guardian-policy-creator.',
      }),
      buildTrailEntry({
        stage: 'worker_tools_executed',
        agentKey: 'guardianPolicyCreator',
        endpointPath: ENDPOINTS.guardianPolicyCreator,
        intent,
        tools: [
          'listFullyInvestedStations',
          'getStationById',
          'createStationPolicies',
          'getPolicyById',
          'listPolicies',
          'createPolicy',
          'updatePolicyById',
          'listSchemasByTopicId',
          'pushSchemaByTopic',
          'publishPolicyById',
          'publishPolicyByIdTreasury',
        ],
        thought:
          "I'm confirming the eligible station, cloning the fixed Guardian templates, pushing the new schemas, and publishing the resulting policies.",
      }),
      buildTrailEntry({
        stage: 'completed',
        agentKey: 'guardian',
        endpointPath: ENDPOINTS.guardian,
        intent,
        thought:
          'I am returning the final Guardian policy replication workflow response.',
      }),
    ];
  }

  if (intent === 'POLICY_ENQUIRY') {
    return [
      buildTrailEntry({
        stage: 'classified',
        agentKey: 'guardian',
        endpointPath: ENDPOINTS.guardian,
        intent,
        thought:
          'I see this request in FroggyGuardian, and I am classifying it as a policy lookup workflow.',
      }),
      buildTrailEntry({
        stage: 'worker_call_started',
        agentKey: 'guardian',
        endpointPath: ENDPOINTS.guardian,
        intent,
        workerAgentKey: 'guardianPolicySummarizer',
        workerEndpointPath: ENDPOINTS.guardianPolicySummarizer,
        transport: 'a2a_http_internal',
        thought:
          'I am calling GuardianPolicySummarizer through ChargeFrog internal A2A at /a2a/guardian-policy-summarizer.',
      }),
      buildTrailEntry({
        stage: 'worker_tools_executed',
        agentKey: 'guardianPolicySummarizer',
        endpointPath: ENDPOINTS.guardianPolicySummarizer,
        intent,
        tools: [
          'listPolicies',
          'getPolicyById',
          'classifyGuardianIntent',
          'summarizeGuardianReply',
        ],
        thought:
          "I'm loading the matched Guardian policies and, when configured, using model-assisted summarization to explain them clearly.",
      }),
      buildTrailEntry({
        stage: 'completed',
        agentKey: 'guardian',
        endpointPath: ENDPOINTS.guardian,
        intent,
        thought:
          'I am returning the final station-specific Guardian policy explanation.',
      }),
    ];
  }

  return [];
}

function buildStationFinderTrail(result) {
  const status = result?.status || null;
  const trail = [
    buildTrailEntry({
      stage: 'classified',
      agentKey: 'stationFinder',
      endpointPath: ENDPOINTS.stationFinder,
      status,
      thought:
        "I see this request in StationFinder, and I'm starting the station discovery workflow.",
    }),
  ];

  if (status === 'not_enough_interest') {
    trail.push(
      buildTrailEntry({
        stage: 'tools_executed',
        agentKey: 'stationFinder',
        endpointPath: ENDPOINTS.stationFinder,
        status,
        tools: [
          'resolveAreaCenter',
          'registerMiniNode',
          'getNeighborhoodSummary',
        ],
        thought:
          "I'm resolving the area, registering the interest event, and measuring neighborhood demand.",
      }),
      buildTrailEntry({
        stage: 'completed',
        agentKey: 'stationFinder',
        endpointPath: ENDPOINTS.stationFinder,
        status,
        thought:
          "I see the threshold is not met, and I'm returning a not-enough-interest result.",
      }),
    );
    return trail;
  }

  if (status === 'candidate_ready') {
    trail.push(
      buildTrailEntry({
        stage: 'tools_executed',
        agentKey: 'stationFinder',
        endpointPath: ENDPOINTS.stationFinder,
        status,
        tools: [
          'resolveAreaCenter',
          'registerMiniNode',
          'getNeighborhoodSummary',
          'getPoi',
          'getChargingAvailability',
          'proposeStationArea',
          'reverseGeocode',
        ],
        thought:
          "I'm resolving the area, measuring demand, evaluating nearby charging evidence, and proposing a concrete station candidate.",
      }),
      buildTrailEntry({
        stage: 'completed',
        agentKey: 'stationFinder',
        endpointPath: ENDPOINTS.stationFinder,
        status,
        thought:
          "I'm returning a candidate-ready result to the calling planner workflow.",
      }),
    );
  }

  return trail;
}

function buildInvestmentProposalGeneratorTrail(result) {
  const status = result?.status || null;
  if (status !== 'proposal_created') return [];
  return [
    buildTrailEntry({
      stage: 'classified',
      agentKey: 'investmentProposalGenerator',
      endpointPath: ENDPOINTS.investmentProposalGenerator,
      status,
      thought:
        "I see a candidate-ready station, and I'm starting the proposal generation workflow.",
    }),
    buildTrailEntry({
      stage: 'tools_executed',
      agentKey: 'investmentProposalGenerator',
      endpointPath: ENDPOINTS.investmentProposalGenerator,
      status,
      tools: [
        'findStationByLocation',
        'webSearch',
        'llm.investmentProposalGenerator',
        'createInvestmentProposal',
        'createInvestmentProposalRecord',
        'uploadJsonToIpfsWithPinata',
        'publishInvestmentProposalOnChain',
        'updateProposalOnChainRecord',
        'appendAuditLog',
      ],
      thought:
        "I'm checking for duplicates, gathering web research, drafting the proposal, pinning metadata, and anchoring the proposal on Hedera HCS.",
    }),
    buildTrailEntry({
      stage: 'completed',
      agentKey: 'investmentProposalGenerator',
      endpointPath: ENDPOINTS.investmentProposalGenerator,
      status,
      thought:
        "I'm returning the completed proposal result to the calling planner workflow.",
    }),
  ];
}

function buildStationAssetIssuerTrail(result) {
  const status = result?.status || null;
  if (!status) return [];
  return [
    buildTrailEntry({
      stage: 'classified',
      agentKey: 'stationAssetIssuer',
      endpointPath: ENDPOINTS.stationAssetIssuer,
      status,
      thought:
        "I see this request in StationAssetIssuer, and I'm starting the station asset issuance workflow.",
    }),
    buildTrailEntry({
      stage: 'tools_executed',
      agentKey: 'stationAssetIssuer',
      endpointPath: ENDPOINTS.stationAssetIssuer,
      status,
      tools: [
        'readOnChainProposal',
        'readOffChainMetadata',
        'generateISIN',
        'createEquityToken',
        'createBondToken',
        'saveIssuedAssets',
      ],
      thought:
        "I'm loading the proposal context, generating ISIN values, creating the equity and bond tokens, and saving the issued asset state.",
    }),
    buildTrailEntry({
      stage: 'completed',
      agentKey: 'stationAssetIssuer',
      endpointPath: ENDPOINTS.stationAssetIssuer,
      status,
      thought:
        status === 'assets_issued'
          ? "I'm returning the completed asset issuance result."
          : "I'm returning the current asset issuance state for this station.",
    }),
  ];
}

function buildAgentTrail({ agentKey, result }) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return [];
  }

  switch (agentKey) {
    case 'planner':
      return buildPlannerTrail(result);
    case 'foundry':
    case 'froggyFoundry':
      return buildFoundryTrail(result);
    case 'guardian':
      return buildGuardianTrail(result);
    case 'stationFinder':
      return buildStationFinderTrail(result);
    case 'investmentProposalGenerator':
      return buildInvestmentProposalGeneratorTrail(result);
    case 'stationAssetIssuer':
      return buildStationAssetIssuerTrail(result);
    default:
      return [];
  }
}

module.exports = {
  applyAgentTrail,
  buildAgentTrail,
  buildPlannerCoordinatorTrail,
  buildFoundryCoordinatorTrail,
  buildGuardianCoordinatorTrail,
  buildPlannerFailureTrail,
  buildFoundryFailureTrail,
  buildGuardianFailureTrail,
  buildWorkerFailureTrail,
  buildFailureResult,
  classifyPublicError,
};
