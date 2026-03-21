const { AIAgentCapability } = require('@hashgraphonline/standards-sdk');

const DEFAULT_ADDITIONAL_REGISTRIES = Object.freeze([
  'erc-8004:arbitrum-sepolia',
]);
const DEFAULT_IO_MODES = Object.freeze(['text/plain', 'application/json']);
const PROVIDER = 'ChargeFrog';

function buildPublicAgentSocials(publicBaseUrl) {
  return Object.freeze([
    { platform: 'website', handle: String(publicBaseUrl || '').trim() },
  ]);
}

function capability(name) {
  return AIAgentCapability && AIAgentCapability[name] !== undefined
    ? AIAgentCapability[name]
    : name;
}

function resolvePlannerModel() {
  return String(process.env.AGENT_MODEL || 'gpt-5.2').trim();
}

function resolveGuardianModel() {
  return String(
    process.env.GUARDIAN_AGENT_MODEL ||
      process.env.AGENT_MODEL ||
      'gpt-5.2',
  ).trim();
}

function resolveFoundryModel() {
  return String(
    process.env.FOUNDRY_AGENT_MODEL ||
      process.env.AGENT_MODEL ||
      'gpt-5.2',
  ).trim();
}

function resolveChatModel() {
  return String(
    process.env.CHAT_AGENT_MODEL ||
      process.env.AGENT_MODEL ||
      'gpt-5.2',
  ).trim();
}

function resolveDocumentationUrl(envKey) {
  return String(process.env[envKey] || '/docs').trim() || '/docs';
}

function resolveProfileImageUrl(envKey, fallbackPath) {
  return String(process.env[envKey] || fallbackPath).trim() || fallbackPath;
}

function buildSkill({
  id,
  name,
  description,
  tags,
  examples,
  inputModes = DEFAULT_IO_MODES,
  outputModes = DEFAULT_IO_MODES,
}) {
  return Object.freeze({
    id,
    name,
    description,
    tags,
    examples,
    inputModes,
    outputModes,
  });
}

function buildAgentMetadata({
  key,
  name,
  description,
  aliasPrefix,
  category,
  endpointPath,
  discoveryPath,
  agentCardPath,
  profileImagePath,
  profileImageFile,
  profileImage,
  documentationUrl,
  source,
  getModel,
  capabilities,
  tags,
  skills,
}) {
  return Object.freeze({
    key,
    name,
    description,
    aliasPrefix,
    category,
    endpointPath,
    discoveryPath,
    agentCardPath,
    profileImagePath,
    profileImageFile,
    profileImage,
    documentationUrl,
    source,
    provider: PROVIDER,
    getModel,
    capabilities: Object.freeze([...capabilities]),
    tags: Object.freeze([...tags]),
    skills: Object.freeze([...skills]),
    defaultAdditionalRegistries: DEFAULT_ADDITIONAL_REGISTRIES,
  });
}

const PUBLIC_A2A_AGENT_METADATA = Object.freeze({
  froggychat: buildAgentMetadata({
    key: 'froggychat',
    name: 'ChargeFrog: FroggyChat',
    description:
      'ChargeFrog public A2A routing agent for planner, foundry, and guardian workflows.',
    aliasPrefix: 'froggychat',
    category: 'chat',
    endpointPath: '/a2a/froggy-chat',
    discoveryPath: '/.well-known/froggychat-agent.json',
    agentCardPath: '/.well-known/froggychat-agent-card.json',
    profileImagePath: '/.well-known/froggychat-agent.png',
    profileImageFile: 'froggy-chat.png',
    profileImage: resolveProfileImageUrl(
      'HOL_PROFILE_IMAGE_CHAT',
      '/.well-known/froggychat-agent.png',
    ),
    documentationUrl: resolveDocumentationUrl('HOL_DOCUMENTATION_CHAT'),
    source: 'chargefrog-froggychat',
    getModel: resolveChatModel,
    capabilities: [
      capability('TEXT_GENERATION'),
      capability('KNOWLEDGE_RETRIEVAL'),
      capability('API_INTEGRATION'),
      capability('MULTI_AGENT_COORDINATION'),
      capability('WORKFLOW_AUTOMATION'),
    ],
    tags: ['chargefrog', 'chat', 'router', 'a2a', 'multi-agent'],
    skills: [
      buildSkill({
        id: 'route-chargefrog-intent',
        name: 'Route ChargeFrog Intent',
        description:
          'Classify a ChargeFrog-domain request and route it to planner, foundry, or guardian.',
        tags: ['routing', 'planner', 'foundry', 'guardian'],
        examples: [
          'Which stations require my attention?',
          'Can you list any available stations for me to invest in?',
          'Show me the guardian policy for Madison Square Garden',
        ],
      }),
    ],
  }),
  planner: buildAgentMetadata({
    key: 'planner',
    name: 'ChargeFrog: FroggyPlanner',
    description:
      'ChargeFrog public A2A coordinator for station discovery, proposal generation, investor purchases, and token balance lookups.',
    aliasPrefix: 'froggyplanner',
    category: 'planner',
    endpointPath: '/a2a/froggy-planner',
    discoveryPath: '/.well-known/froggy-planner-agent.json',
    agentCardPath: '/.well-known/froggy-planner-agent-card.json',
    profileImagePath: '/.well-known/froggy-planner-agent.png',
    profileImageFile: 'froggy-planner.png',
    profileImage: resolveProfileImageUrl(
      'HOL_PROFILE_IMAGE_PLANNER',
      '/.well-known/froggy-planner-agent.png',
    ),
    documentationUrl: resolveDocumentationUrl('HOL_DOCUMENTATION_PLANNER'),
    source: 'chargefrog-planner',
    getModel: resolvePlannerModel,
    capabilities: [
      capability('TEXT_GENERATION'),
      capability('KNOWLEDGE_RETRIEVAL'),
      capability('DATA_INTEGRATION'),
      capability('API_INTEGRATION'),
      capability('WORKFLOW_AUTOMATION'),
    ],
    tags: ['chargefrog', 'planner', 'investment', 'stations', 'a2a'],
    skills: [
      buildSkill({
        id: 'discover-station-opportunity',
        name: 'Discover Station Opportunity',
        description:
          'Evaluate location interest and charging evidence to identify a station opportunity.',
        tags: ['discovery', 'planning', 'location'],
        examples: [
          'I want to invest near Madison Square Garden',
          'Find a station for proposal near Prospect Park',
        ],
      }),
      buildSkill({
        id: 'run-investor-station-workflows',
        name: 'Run Investor Workflows',
        description:
          'List investable stations, execute equity or bond purchases, and retrieve token balances.',
        tags: ['investment', 'equity', 'bond', 'balance'],
        examples: [
          'Which stations are available to invest in?',
          'Give me 10 equity tokens for this station',
          'Check my bond balance for Prospect Park',
        ],
      }),
    ],
  }),
  foundry: buildAgentMetadata({
    key: 'foundry',
    name: 'ChargeFrog: FroggyFoundry',
    description:
      'ChargeFrog public A2A admin agent for pending review, station deployment approval, deployment orchestration, and post-deployment issuance.',
    aliasPrefix: 'froggyfoundry',
    category: 'foundry',
    endpointPath: '/a2a/froggy-foundry',
    discoveryPath: '/.well-known/froggy-foundry-agent.json',
    agentCardPath: '/.well-known/froggy-foundry-agent-card.json',
    profileImagePath: '/.well-known/froggy-foundry-agent.png',
    profileImageFile: 'froggy-foundry.png',
    profileImage: resolveProfileImageUrl(
      'HOL_PROFILE_IMAGE_FOUNDRY',
      '/.well-known/froggy-foundry-agent.png',
    ),
    documentationUrl: resolveDocumentationUrl('HOL_DOCUMENTATION_FOUNDRY'),
    source: 'chargefrog-froggyfoundry',
    getModel: resolveFoundryModel,
    capabilities: [
      capability('TEXT_GENERATION'),
      capability('DATA_INTEGRATION'),
      capability('API_INTEGRATION'),
      capability('TRANSACTION_ANALYTICS'),
      capability('WORKFLOW_AUTOMATION'),
    ],
    tags: ['chargefrog', 'foundry', 'admin', 'deployment', 'issuance'],
    skills: [
      buildSkill({
        id: 'review-pending-admin-actions',
        name: 'Review Pending Stations',
        description:
          'List pending admin-action stations and summarize the proposal context for approval.',
        tags: ['admin', 'review', 'approval'],
        examples: [
          'Which stations require my attention?',
          'Approve station 8',
        ],
      }),
      buildSkill({
        id: 'deploy-and-issue-station-assets',
        name: 'Deploy And Issue Assets',
        description:
          'Deploy the station bundle and trigger equity and bond issuance for an approved proposal.',
        tags: ['deployment', 'issuance', 'hedera'],
        examples: [
          'Approve proposal proposal_1741856400000_abc123def4',
          'Deploy and issue the pending station for proposal proposal_1741856400000_abc123def4',
        ],
      }),
    ],
  }),
  guardian: buildAgentMetadata({
    key: 'guardian',
    name: 'ChargeFrog: FroggyGuardian',
    description:
      'ChargeFrog public A2A coordinator for Guardian policy enquiry, fully-invested station checks, and policy replication workflows.',
    aliasPrefix: 'froggyguardian',
    category: 'guardian',
    endpointPath: '/a2a/froggy-guardian',
    discoveryPath: '/.well-known/froggy-guardian-agent.json',
    agentCardPath: '/.well-known/froggy-guardian-agent-card.json',
    profileImagePath: '/.well-known/froggy-guardian-agent.png',
    profileImageFile: 'froggy-guardian.png',
    profileImage: resolveProfileImageUrl(
      'HOL_PROFILE_IMAGE_GUARDIAN',
      '/.well-known/froggy-guardian-agent.png',
    ),
    documentationUrl: resolveDocumentationUrl('HOL_DOCUMENTATION_GUARDIAN'),
    source: 'chargefrog-guardian',
    getModel: resolveGuardianModel,
    capabilities: [
      capability('TEXT_GENERATION'),
      capability('KNOWLEDGE_RETRIEVAL'),
      capability('COMPLIANCE_ANALYSIS'),
      capability('GOVERNANCE_FACILITATION'),
      capability('WORKFLOW_AUTOMATION'),
    ],
    tags: ['chargefrog', 'guardian', 'policy', 'schema', 'compliance'],
    skills: [
      buildSkill({
        id: 'summarize-guardian-policy',
        name: 'Summarize Guardian Policy',
        description:
          'Locate Guardian policies for a station and explain what they control and track.',
        tags: ['guardian', 'policy', 'summary'],
        examples: [
          'Show me the guardian policy for Madison Square Garden',
        ],
      }),
      buildSkill({
        id: 'replicate-guardian-policy-schema',
        name: 'Replicate Guardian Policies',
        description:
          'Check fully-invested station readiness and initiate Guardian policy and schema replication.',
        tags: ['guardian', 'policy', 'schema', 'replication'],
        examples: [
          'What stations have been fully-invested?',
          'Create guardian policy and schema for Madison Square Garden New York',
        ],
      }),
    ],
  }),
});

module.exports = {
  buildPublicAgentSocials,
  PUBLIC_A2A_AGENT_METADATA,
};
