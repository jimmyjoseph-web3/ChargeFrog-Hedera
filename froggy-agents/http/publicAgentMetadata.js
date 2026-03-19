const { AIAgentCapability } = require('@hashgraphonline/standards-sdk');

function buildPublicAgentSocials(publicBaseUrl) {
  return Object.freeze([
    { platform: 'website', handle: String(publicBaseUrl || '').trim() },
  ]);
}

function buildPublicAgentSocials(publicBaseUrl) {
  return Object.freeze([
    { platform: 'website', handle: String(publicBaseUrl || '').trim() },
  ]);
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

function resolveChatDocumentationUrl() {
  return String(process.env.HOL_DOCUMENTATION_CHAT || '/docs').trim() || '/docs';
}

const PUBLIC_A2A_AGENT_METADATA = Object.freeze({
  froggychat: {
    key: 'froggychat',
    name: 'FroggyChat',
    aliasPrefix: 'froggychat',
    endpointPath: '/a2a/froggy-chat',
    discoveryPath: '/.well-known/froggychat-agent.json',
    agentCardPath: '/.well-known/froggychat-agent-card.json',
    documentationUrl: resolveChatDocumentationUrl(),
    source: 'chargefrog-froggychat',
    description:
      'ChargeFrog FroggyChat is the public A2A entrypoint that routes incoming ChargeFrog requests to FroggyPlanner, FroggyFoundry, or FroggyGuardian based on intent.',
    provider: 'ChargeFrog',
    category: 'chat',
    tags: ['chargefrog', 'froggychat', 'chat', 'a2a', 'multi-agent', 'hedera'],
    capabilities: [
      AIAgentCapability.KNOWLEDGE_RETRIEVAL,
      AIAgentCapability.DATA_INTEGRATION,
      AIAgentCapability.MULTI_AGENT_COORDINATION,
      AIAgentCapability.API_INTEGRATION,
      AIAgentCapability.WORKFLOW_AUTOMATION,
    ],
    getModel: resolvePlannerModel,
    skills: [
      {
        id: 'chargefrog-intent-routing',
        name: 'FroggyChat Routing',
        description:
          'Routes investment, admin, and Guardian workflow questions to the correct public ChargeFrog A2A agent.',
        tags: ['routing', 'multi-agent', 'chargefrog', 'froggychat'],
        examples: [
          'Can you list any available stations for me to invest in?',
          'Which stations require my attention?',
          'Show me the guardian policy for Madison Square Garden',
        ],
        inputModes: ['text/plain', 'application/json'],
        outputModes: ['text/plain', 'application/json'],
      },
    ],
  },
  planner: {
    key: 'planner',
    name: 'FroggyPlanner',
    aliasPrefix: 'froggy-planner',
    endpointPath: '/a2a/froggy-planner',
    discoveryPath: '/.well-known/froggy-planner-agent.json',
    agentCardPath: '/.well-known/froggy-planner-agent-card.json',
    documentationUrl:
      'https://green-late-sailfish-40.mypinata.cloud/ipfs/bafkreifcstidhxanozomqlaajhrusmeg43z3ycxk2kff4hiffu2d65exhi',
    source: 'chargefrog-froggyplanner',
    description:
      'ChargeFrog FroggyPlanner is the public A2A coordinator agent for EV station opportunity discovery, investment proposal orchestration, and investor-facing station investment workflows. It stops after proposal creation, sets the proposal into pending admin approval, and hands deployment plus token creation to FroggyFoundry.',
    provider: 'ChargeFrog',
    category: 'planner',
    tags: ['chargefrog', 'planner', 'a2a', 'erc-8004', 'hedera'],
    capabilities: [
      AIAgentCapability.KNOWLEDGE_RETRIEVAL,
      AIAgentCapability.DATA_INTEGRATION,
      AIAgentCapability.MULTI_AGENT_COORDINATION,
      AIAgentCapability.API_INTEGRATION,
      AIAgentCapability.WORKFLOW_AUTOMATION,
    ],
    getModel: resolvePlannerModel,
    skills: [
      {
        id: 'station-opportunity-discovery',
        name: 'Station Opportunity Discovery',
        description:
          'Finds candidate EV station opportunities based on location demand, neighborhood interest, and charging evidence.',
        tags: ['ev', 'infrastructure', 'station', 'discovery', 'planning'],
        examples: [
          'I want to invest near Madison Square Garden',
          'Find a station for proposal near Brooklyn Heights',
          'Is there enough interest to propose a station near Times Square?',
        ],
        inputModes: ['text/plain', 'application/json'],
        outputModes: ['text/plain', 'application/json'],
      },
      {
        id: 'investment-proposal-orchestration',
        name: 'Investment Proposal Orchestration',
        description:
          'Creates station investment proposals after a viable candidate location has been identified, then places them into pending admin approval for FroggyFoundry review.',
        tags: ['investment', 'proposal', 'station', 'tokenization'],
        examples: [
          'Create an investment proposal for a station near Madison Square Garden',
          'Generate a proposal for a station in Brooklyn Heights',
          'Propose a new ChargeFrog station near Petronas Twin Towers',
        ],
        inputModes: ['text/plain', 'application/json'],
        outputModes: ['text/plain', 'application/json'],
      },
      {
        id: 'station-investment-execution',
        name: 'Station Investment Execution',
        description:
          'Lists investable stations, surfaces investment choices, executes station investments, and retrieves token balances for stations that already have issued equity and bond tokens.',
        tags: ['investment', 'equity', 'bond', 'balance', 'station'],
        examples: [
          'What stations are available right now?',
          'Give me 10 equity tokens for the station ChargeFrog Station - Madison Square Garden',
          'What is my equity balance for station 1?',
        ],
        inputModes: ['text/plain', 'application/json'],
        outputModes: ['text/plain', 'application/json'],
      },
    ],
  },
  foundry: {
    key: 'foundry',
    name: 'FroggyFoundry',
    aliasPrefix: 'froggy-foundry',
    endpointPath: '/a2a/froggy-foundry',
    discoveryPath: '/.well-known/froggy-foundry-agent.json',
    agentCardPath: '/.well-known/froggy-foundry-agent-card.json',
    documentationUrl:
      'https://green-late-sailfish-40.mypinata.cloud/ipfs/bafkreic4fyumdl3rusoci5zuf7g52trafkj6kdvaxrbn3t5tv4bmntunfa',
    source: 'chargefrog-froggyfoundry',
    description:
      'ChargeFrog FroggyFoundry is the A2A admin agent for reviewing pending station proposals, approving station deployment on Hedera testnet, and orchestrating equity and bond token creation after deployment.',
    provider: 'ChargeFrog',
    category: 'foundry',
    defaultAdditionalRegistries: ['erc-8004'],
    tags: [
      'chargefrog',
      'foundry',
      'deployment',
      'issuance',
      'a2a',
      'hedera',
    ],
    capabilities: [
      AIAgentCapability.KNOWLEDGE_RETRIEVAL,
      AIAgentCapability.DATA_INTEGRATION,
      AIAgentCapability.MULTI_AGENT_COORDINATION,
      AIAgentCapability.API_INTEGRATION,
      AIAgentCapability.WORKFLOW_AUTOMATION,
    ],
    getModel: resolveFoundryModel,
    skills: [
      {
        id: 'station-review',
        name: 'gets all stations up for review and summarizes',
        description:
          'Gets all stations up for review, summarizes the pending proposal for each station, and prepares the admin approval decision before deployment and token creation.',
        tags: ['admin', 'approval', 'station', 'queue'],
        examples: [
          'Which stations require my attention?',
          'What station proposals are pending admin action?',
          'Show me the pending admin queue',
        ],
        inputModes: ['text/plain', 'application/json'],
        outputModes: ['text/plain', 'application/json'],
      },
      {
        id: 'station-deployment-and-issuance',
        name: 'Station Deployment And Issuance',
        description:
          'Approves a pending station proposal, deploys the station contracts on Hedera testnet through ChargeFrog contracts, and then triggers equity and bond token creation.',
        tags: ['deployment', 'issuance', 'station', 'admin', 'hedera'],
        examples: [
          'Approve station 8',
          'Approve proposal proposal_1741856400000_abc123def4',
          'Deploy and issue the pending station for proposal proposal_1741856400000_abc123def4',
        ],
        inputModes: ['text/plain', 'application/json'],
        outputModes: ['text/plain', 'application/json'],
      },
    ],
  },
  guardian: {
    key: 'guardian',
    name: 'FroggyGuardian',
    aliasPrefix: 'froggy-guardian',
    endpointPath: '/a2a/froggy-guardian',
    discoveryPath: '/.well-known/froggy-guardian-agent.json',
    agentCardPath: '/.well-known/froggy-guardian-agent-card.json',
    documentationUrl:
      'https://green-late-sailfish-40.mypinata.cloud/ipfs/bafkreiaiviztkplabszob3rvmflh64dtsnslfgxyj7yjcufflp7vd465aq',
    source: 'chargefrog-froggyguardian',
    description:
      'ChargeFrog FroggyGuardian is the public A2A coordinator agent for station-specific Guardian policy enquiries and policy creation workflows. It coordinates internal worker agents and uses Hedera Guardian for policy summarization, policy replication, and compliance-oriented station workflows.',
    provider: 'ChargeFrog',
    category: 'guardian',
    tags: ['chargefrog', 'guardian', 'a2a', 'erc-8004', 'hedera'],
    capabilities: [
      AIAgentCapability.SUMMARIZATION_EXTRACTION,
      AIAgentCapability.KNOWLEDGE_RETRIEVAL,
      AIAgentCapability.DATA_INTEGRATION,
      AIAgentCapability.MULTI_AGENT_COORDINATION,
      AIAgentCapability.API_INTEGRATION,
      AIAgentCapability.WORKFLOW_AUTOMATION,
    ],
    getModel: resolveGuardianModel,
    skills: [
      {
        id: 'guardian-policy-enquiry',
        name: 'Guardian Policy Enquiry',
        description:
          'Explains station-specific Guardian policies, including what they govern, what they track, and which station they apply to.',
        tags: ['guardian', 'policy', 'station', 'compliance'],
        examples: [
          'Show me the guardian policy for Madison Square Garden',
          'What does the Guardian policy for Brooklyn Heights Promenade do?',
          'Summarize the policy for ChargeFrog Station - Madison Square Garden',
        ],
        inputModes: ['text/plain', 'application/json'],
        outputModes: ['text/plain', 'application/json'],
      },
      {
        id: 'guardian-policy-creation',
        name: 'Guardian Policy Creation',
        description:
          'Lists fully-invested stations that are ready for Guardian policy creation and starts the fixed Guardian policy creation workflow for a selected station.',
        tags: ['guardian', 'policy', 'schema', 'station', 'creation'],
        examples: [
          'What stations have been fully-invested?',
          'Create guardian policy and schema for Madison Square Garden New York',
          'Use Brooklyn Heights Promenade for Guardian policy creation',
        ],
        inputModes: ['text/plain', 'application/json'],
        outputModes: ['text/plain', 'application/json'],
      },
    ],
  },
});

module.exports = {
  buildPublicAgentSocials,
  PUBLIC_A2A_AGENT_METADATA,
};