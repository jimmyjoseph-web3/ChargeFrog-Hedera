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