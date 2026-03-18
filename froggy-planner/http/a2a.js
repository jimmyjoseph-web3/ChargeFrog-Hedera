const { randomUUID } = require('crypto');
const { PUBLIC_A2A_AGENT_METADATA } = require('./publicAgentMetadata');

const A2A_PROTOCOL_VERSION = '0.3.0';
const A2A_TASKS = new Map();
const FOUNDRY_AGENT_CONFIG = {
  ...PUBLIC_A2A_AGENT_METADATA.foundry,
  runnerInputBuilder: ({ text, data }) => ({
    ...(data && typeof data === 'object' ? data : {}),
    ...(text ? { message: text } : {}),
  }),
  responseEndpoint: '/a2a/froggy-foundry',
};
const A2A_AGENTS = Object.freeze({
  froggychat: {
    ...PUBLIC_A2A_AGENT_METADATA.froggychat,
    runnerInputBuilder: ({ text, data, walletAddress }) => ({
      message:
        text ||
        (data &&
        typeof data === 'object' &&
        typeof data.message === 'string'
          ? data.message
          : ''),
      ...((walletAddress ||
        (data &&
          typeof data === 'object' &&
          typeof data.walletAddress === 'string')) && {
        walletAddress:
          walletAddress ||
          (data &&
          typeof data === 'object' &&
          typeof data.walletAddress === 'string'
            ? data.walletAddress
            : undefined),
      }),
    }),
    responseEndpoint: '/a2a/froggy-chat',
  },
  planner: {
    ...PUBLIC_A2A_AGENT_METADATA.planner,
    runnerInputBuilder: ({ text, walletAddress }) => ({
      message: text,
      ...(walletAddress ? { walletAddress } : {}),
    }),
    responseEndpoint: '/a2a/froggy-planner',
  },
  guardian: {
    ...PUBLIC_A2A_AGENT_METADATA.guardian,
    runnerInputBuilder: ({ text }) => ({
      message: text,
    }),
    responseEndpoint: '/a2a/froggy-guardian',
  },
  foundry: FOUNDRY_AGENT_CONFIG,
  froggyFoundry: FOUNDRY_AGENT_CONFIG,
  stationFinder: {
    key: 'stationFinder',
    name: 'StationFinder',
    description: 'Internal worker agent for station discovery and candidate generation.',
    endpointPath: '/a2a/station-finder',
    documentationPath: '/docs',
    source: 'chargefrog-station-finder',
    runnerInputBuilder: ({ data }) => (data && typeof data === 'object' ? data : {}),
    responseEndpoint: '/a2a/station-finder',
    internalOnly: true,
    skills: [],
  },
  investmentProposalGenerator: {
    key: 'investmentProposalGenerator',
    name: 'InvestmentProposalGenerator',
    description: 'Internal worker agent for investment proposal generation.',
    endpointPath: '/a2a/investment-proposal-generator',
    documentationPath: '/docs',
    source: 'chargefrog-investment-proposal-generator',
    runnerInputBuilder: ({ data }) => (data && typeof data === 'object' ? data : {}),
    responseEndpoint: '/a2a/investment-proposal-generator',
    internalOnly: true,
    skills: [],
  },
  stationAssetIssuer: {
    key: 'stationAssetIssuer',
    name: 'StationAssetIssuer',
    description: 'Internal worker agent for station asset issuance.',
    endpointPath: '/a2a/station-asset-issuer',
    documentationPath: '/docs',
    source: 'chargefrog-station-asset-issuer',
    runnerInputBuilder: ({ data }) => (data && typeof data === 'object' ? data : {}),
    responseEndpoint: '/a2a/station-asset-issuer',
    internalOnly: true,
    skills: [],
  },
  guardianPolicySummarizer: {
    key: 'guardianPolicySummarizer',
    name: 'GuardianPolicySummarizer',
    description: 'Internal worker agent for Guardian policy summaries.',
    endpointPath: '/a2a/guardian-policy-summarizer',
    documentationPath: '/docs',
    source: 'chargefrog-guardian-policy-summarizer',
    runnerInputBuilder: ({ data }) => (data && typeof data === 'object' ? data : {}),
    responseEndpoint: '/a2a/guardian-policy-summarizer',
    internalOnly: true,
    skills: [],
  },
  guardianPolicyCreator: {
    key: 'guardianPolicyCreator',
    name: 'GuardianPolicyCreator',
    description: 'Internal worker agent for Guardian policy creation workflows.',
    endpointPath: '/a2a/guardian-policy-creator',
    documentationPath: '/docs',
    source: 'chargefrog-guardian-policy-creator',
    runnerInputBuilder: ({ data }) => (data && typeof data === 'object' ? data : {}),
    responseEndpoint: '/a2a/guardian-policy-creator',
    internalOnly: true,
    skills: [],
  },
});

function resolveAgentConfig(agentKey = 'planner') {
  return A2A_AGENTS[agentKey] || A2A_AGENTS.planner;
}

function buildAgentSkill({
  id,
  name,
  description,
  tags,
  examples,
  inputModes,
  outputModes,
}) {
  return {
    id,
    name,
    description,
    tags,
    examples,
    inputModes,
    outputModes,
  };
}

function buildAgentCard(baseUrl, agentKey = 'planner') {
  const agent = resolveAgentConfig(agentKey);
  const documentationUrl = /^https?:\/\//i.test(agent.documentationUrl || '')
    ? agent.documentationUrl
    : `${baseUrl}${agent.documentationUrl || '/docs'}`;
  const serviceEndpoint = `${baseUrl}${agent.endpointPath}`;
  return {
    id: agent.key,
    protocolVersion: A2A_PROTOCOL_VERSION,
    name: agent.name,
    description: agent.description,
    url: serviceEndpoint,
    serviceEndpoint,
    endpoints: {
      a2a: serviceEndpoint,
    },
    version: '1.0.0',
    documentationUrl,
    provider: {
      organization: 'ChargeFrog',
      url: baseUrl,
    },
    capabilities: {
      streaming: false,
      messageHandling: true,
      pushNotifications: false,
    },
    defaultInputModes: ['text/plain', 'application/json'],
    defaultOutputModes: ['text/plain', 'application/json'],
    supportsAuthenticatedExtendedCard: false,
    skills: agent.skills.map((skill) => buildAgentSkill(skill)),
  };
}

function jsonRpcSuccess(id, result) {
  return {
    jsonrpc: '2.0',
    id: id === undefined ? null : id,
    result,
  };
}

function jsonRpcError(id, code, message, data) {
  return {
    jsonrpc: '2.0',
    id: id === undefined ? null : id,
    error: {
      code,
      message,
      ...(data === undefined ? {} : { data }),
    },
  };
}

function normalizeParts(parts) {
  if (!Array.isArray(parts)) return [];

  return parts
    .map((part) => {
      if (!part || typeof part !== 'object') return null;
      if (typeof part.text === 'string') {
        return { kind: 'text', text: part.text };
      }
      if (part.data !== undefined) {
        return { kind: 'data', data: part.data };
      }
      return null;
    })
    .filter(Boolean);
}

function extractMessageText(message) {
  const parts = normalizeParts(message && message.parts);
  return parts
    .filter((part) => part.kind === 'text')
    .map((part) => String(part.text || '').trim())
    .filter((value) => value !== '')
    .join('\n')
    .trim();
}

function extractMessageData(message) {
  const parts = normalizeParts(message && message.parts);
  const dataPart = parts.find((part) => part.kind === 'data');
  return dataPart ? dataPart.data : undefined;
}

function extractWalletAddress(params) {
  const candidates = [
    params && params.walletAddress,
    params && params.metadata && params.metadata.walletAddress,
    params &&
      params.message &&
      params.message.metadata &&
      params.message.metadata.walletAddress,
  ];

  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null) {
      const value = String(candidate).trim();
      if (value !== '') {
        return value;
      }
    }
  }

  return undefined;
}

function asNonEmptyText(value) {
  if (value === undefined || value === null) return null;

  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized === '' ? null : normalized;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => asNonEmptyText(item))
      .filter(Boolean)
      .join(' ')
      .trim();
    return normalized === '' ? null : normalized;
  }

  if (typeof value === 'object') {
    const direct = [
      value.text,
      value.reply,
      value.summary,
      value.message,
      value.error,
    ]
      .map((item) => asNonEmptyText(item))
      .find(Boolean);

    if (direct) return direct;
    return null;
  }

  return null;
}

function buildStationListText(stations) {
  if (!Array.isArray(stations) || stations.length === 0) return null;

  const lines = stations
    .map((station) => {
      if (!station || typeof station !== 'object') return null;
      const stationId =
        station.stationId !== undefined && station.stationId !== null
          ? `station ${station.stationId}`
          : 'station';
      const stationName =
        typeof station.stationName === 'string' &&
        station.stationName.trim() !== ''
          ? station.stationName.trim()
          : 'Unnamed station';
      const stage = asNonEmptyText(station.stage);
      const equityPrice = asNonEmptyText(
        station?.pricing?.equityPriceHbar ?? station?.equityPriceHbar,
      );
      const bondPrice = asNonEmptyText(
        station?.pricing?.bondPriceHbar ?? station?.bondPriceHbar,
      );
      const detailParts = [];
      if (stage) detailParts.push(stage);
      if (equityPrice) detailParts.push(`equity ${equityPrice} HBAR`);
      if (bondPrice) detailParts.push(`bond ${bondPrice} HBAR`);
      return detailParts.length > 0
        ? `${stationId}: ${stationName} (${detailParts.join(', ')})`
        : `${stationId}: ${stationName}`;
    })
    .filter(Boolean);

  if (lines.length === 0) return null;
  return lines.join('; ');
}

function buildMatchedPoliciesText(policies) {
  if (!Array.isArray(policies) || policies.length === 0) return null;

  const lines = policies
    .map((policy) => {
      if (!policy || typeof policy !== 'object') return null;
      const name =
        asNonEmptyText(policy.name) ||
        asNonEmptyText(policy.policyName) ||
        asNonEmptyText(policy.title) ||
        'Unnamed policy';
      const policyId =
        asNonEmptyText(policy.policyId) || asNonEmptyText(policy.id);
      return policyId ? `${name} (${policyId})` : name;
    })
    .filter(Boolean);

  if (lines.length === 0) return null;
  return lines.join('; ');
}

function buildBalanceText(result) {
  if (!result || typeof result !== 'object' || !result.balance) return null;

  const payload =
    result.balance && typeof result.balance === 'object'
      ? result.balance
      : result;

  const assetType = asNonEmptyText(payload.assetType) || 'token';
  const stationId =
    payload.stationId !== undefined && payload.stationId !== null
      ? ` for station ${payload.stationId}`
      : '';
  const balanceValue =
    asNonEmptyText(payload.balance && payload.balance.value) ||
    asNonEmptyText(payload.balance);

  if (!balanceValue) return null;
  return `Your ${assetType} balance${stationId} is ${balanceValue}.`;
}

function buildIssuanceText(result) {
  if (!result || typeof result !== 'object' || !result.issuance) return null;
  const payload =
    result.issuance && typeof result.issuance === 'object'
      ? result.issuance
      : result;
  const stationId =
    payload.stationId !== undefined && payload.stationId !== null
      ? ` for station ${payload.stationId}`
      : '';
  const detailParts = [];
  if (payload?.equity?.tokenAddress) {
    detailParts.push(`equity ${payload.equity.tokenAddress}`);
  }
  if (payload?.bond?.tokenAddress) {
    detailParts.push(`bond ${payload.bond.tokenAddress}`);
  }
  return detailParts.length > 0
    ? `Asset issuance completed${stationId}: ${detailParts.join(', ')}.`
    : `Asset issuance completed${stationId}.`;
}

function buildChoiceText(result) {
  if (!result || typeof result !== 'object' || !result.choices) return null;
  const payload =
    result.choices && typeof result.choices === 'object'
      ? result.choices
      : result;
  const station =
    payload.station && typeof payload.station === 'object'
      ? payload.station
      : {};
  const pricing =
    payload.pricing && typeof payload.pricing === 'object'
      ? payload.pricing
      : {};
  const stationLabel =
    station.stationId !== undefined && station.stationId !== null
      ? `station ${station.stationId}`
      : 'the station';
  const stationName = asNonEmptyText(station.stationName);
  const equityPrice = asNonEmptyText(pricing.equityPriceHbar);
  const bondPrice = asNonEmptyText(pricing.bondPriceHbar);
  const pricingText = [
    equityPrice ? `equity ${equityPrice} HBAR` : null,
    bondPrice ? `bond ${bondPrice} HBAR` : null,
  ]
    .filter(Boolean)
    .join(', ');

  const prefix = stationName
    ? `${stationLabel} (${stationName})`
    : stationLabel;
  return pricingText
    ? `Investment choices for ${prefix}: ${pricingText}.`
    : `Investment choices are ready for ${prefix}.`;
}

function buildPurchaseText(result) {
  if (!result || typeof result !== 'object' || !result.purchase) return null;
  const payload =
    result.purchase && typeof result.purchase === 'object'
      ? result.purchase
      : result;
  const amount = asNonEmptyText(payload.amount);
  const assetType = asNonEmptyText(payload.assetType) || 'asset';
  const stationId =
    payload.stationId !== undefined && payload.stationId !== null
      ? ` for station ${payload.stationId}`
      : '';
  const txParts = [
    asNonEmptyText(payload.mintTxHash) ? `mint ${payload.mintTxHash}` : null,
    asNonEmptyText(payload.issueTxHash) ? `issue ${payload.issueTxHash}` : null,
  ].filter(Boolean);
  const prefix = amount
    ? `Purchase submitted: ${amount} ${assetType}${stationId}.`
    : `Purchase submitted for ${assetType}${stationId}.`;
  return txParts.length > 0 ? `${prefix} ${txParts.join(', ')}.` : prefix;
}

function buildCandidateText(result) {
  if (!result || typeof result !== 'object' || !result.stationCandidate)
    return null;
  const payload =
    result.stationCandidate && typeof result.stationCandidate === 'object'
      ? result.stationCandidate
      : result;
  const proposedStationName = asNonEmptyText(payload.proposedStationName);
  const area = asNonEmptyText(payload.area);
  const currentCount = asNonEmptyText(payload.currentCount);
  const threshold = asNonEmptyText(payload.threshold);
  const detailParts = [
    proposedStationName ? `proposed station ${proposedStationName}` : null,
    area ? `area ${area}` : null,
    currentCount && threshold ? `interest ${currentCount}/${threshold}` : null,
  ].filter(Boolean);
  if (detailParts.length === 0) return null;
  return `Station candidate ready: ${detailParts.join(', ')}.`;
}

function buildGuardianPolicyCreationText(result) {
  if (!result || typeof result !== 'object') return null;
  if (result.intent !== 'CREATE_GUARDIAN_POLICIES_FOR_STATION') return null;
  const stationName = asNonEmptyText(result.stationName);
  if (!stationName) return null;
  return `Done! Here are the details of your replication workflow for ${stationName}.`;
}

function buildPreferredTextFromResult(result) {
  if (!result || typeof result !== 'object') return null;

  if (result.status === 'listed' && Array.isArray(result.stations)) {
    const stationText = buildStationListText(result.stations);
    if (stationText) {
      return `There are ${result.stations.length} investable station(s) right now: ${stationText}.`;
    }
  }

  if (
    result.intent === 'LIST_FULLY_INVESTED_STATIONS' &&
    Array.isArray(result.stations)
  ) {
    const stationText = buildStationListText(result.stations);
    if (stationText) {
      return result.stations.length === 1
        ? `There is 1 fully-invested station ready for Guardian policy and schema creation: ${stationText}.`
        : `There are ${result.stations.length} fully-invested stations ready for Guardian policy and schema creation: ${stationText}.`;
    }
  }

  return (
    buildChoiceText(result) ||
    buildPurchaseText(result) ||
    buildBalanceText(result) ||
    buildIssuanceText(result) ||
    buildCandidateText(result) ||
    buildGuardianPolicyCreationText(result)
  );
}

function buildFallbackTextFromResult(result) {
  if (!result || typeof result !== 'object') return null;

  if (Array.isArray(result.stations) && result.stations.length > 0) {
    const stationText = buildStationListText(result.stations);
    if (stationText) {
      return `Available stations: ${stationText}.`;
    }
  }

  if (
    Array.isArray(result.matchedPolicies) &&
    result.matchedPolicies.length > 0
  ) {
    const policyText = buildMatchedPoliciesText(result.matchedPolicies);
    if (policyText) {
      return `Matched policies: ${policyText}.`;
    }
  }

  const balanceText = buildBalanceText(result);
  if (balanceText) return balanceText;

  const issuanceText = buildIssuanceText(result);
  if (issuanceText) return issuanceText;

  if (result.status === 'listed' && Array.isArray(result.stations)) {
    return result.stations.length
      ? `There are ${result.stations.length} investable station(s) available.`
      : 'There are no investable stations available.';
  }

  if (result.status === 'no_station_available') {
    return 'No investable station is available yet.';
  }

  if (result.status === 'station_not_found') {
    return 'The requested station could not be found.';
  }

  if (result.status === 'choices_ready') {
    return 'Investment choices are ready.';
  }

  if (result.status === 'balance_retrieved') {
    return 'The requested token balance was retrieved.';
  }

  if (result.status === 'assets_issued') {
    return 'Station assets were issued successfully.';
  }

  if (result.status === 'proposal_created') {
    return 'The investment proposal was created successfully.';
  }

  if (result.status === 'candidate_ready') {
    return 'A station candidate is ready for proposal creation.';
  }

  if (result.status === 'not_enough_interest') {
    return 'There is not enough neighborhood interest yet.';
  }

  return null;
}

function resultToReplyText(result) {
  return (
    asNonEmptyText(result && result.reply) ||
    asNonEmptyText(result && result.summary) ||
    asNonEmptyText(result && result.error) ||
    buildPreferredTextFromResult(result) ||
    buildFallbackTextFromResult(result) ||
    'No reply was produced.'
  );
}