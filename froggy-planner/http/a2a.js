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