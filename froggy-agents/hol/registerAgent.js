#!/usr/bin/env node

require('dotenv').config({
  path: require('path').resolve(__dirname, '../../../.env'),
});

const {
  RegistryBrokerClient,
  ProfileType,
  AIAgentType,
  isPendingRegisterAgentResponse,
  isPartialRegisterAgentResponse,
  isSuccessRegisterAgentResponse,
} = require('@hashgraphonline/standards-sdk');
const {
  buildPublicAgentSocials,
  PUBLIC_A2A_AGENT_METADATA,
} = require('../http/publicAgentMetadata');

/** @typedef {import('@hashgraphonline/standards-sdk').HCS11Profile} HCS11Profile */
/** @typedef {import('@hashgraphonline/standards-sdk').AgentRegistrationRequest} AgentRegistrationRequest */

const DEFAULT_BROKER_BASE_URL = 'https://hol.org/registry/api/v1';
const DEFAULT_PUBLIC_BASE_URL = 'https://froggyplanner.onrender.com';
const DEFAULT_REGISTRY = 'hashgraph-online';
const DEFAULT_ERC8004_NETWORKS = ['erc-8004'];
const DEFAULT_ERC8004_SEARCH_REGISTRY = 'erc-8004-adapter';
const DEFAULT_WAIT_OPTIONS = {
  intervalMs: 2_000,
  timeoutMs: 120_000,
};

const AGENT_CONFIG = PUBLIC_A2A_AGENT_METADATA;

function serializeError(error) {
  if (!(error instanceof Error)) {
    return {
      ok: false,
      error: String(error),
    };
  }

  const details = {
    ok: false,
    error: error.message,
  };

  if ('status' in error && error.status !== undefined) {
    details.status = error.status;
  }

  if ('statusText' in error && error.statusText) {
    details.statusText = error.statusText;
  }

  if ('body' in error && error.body !== undefined) {
    details.body = error.body;
  }

  const errorBody =
    details.body && typeof details.body === 'object' ? details.body : null;
  if (
    details.status === 401 &&
    errorBody &&
    errorBody.error === 'Authentication required'
  ) {
    details.hint =
      'Registry Broker rejected the credential. HOL_REGISTRY_API_KEY was loaded and sent as x-api-key; if this deployment requires additional auth context, set HOL_REGISTRY_ACCOUNT_ID and/or HOL_LEDGER_API_KEY as well.';
  }

  if ('step' in error && error.step) {
    details.step = error.step;
  }

  if ('cause' in error && error.cause) {
    details.cause =
      error.cause instanceof Error
        ? {
            message: error.cause.message,
            name: error.cause.name,
          }
        : error.cause;
  }

  return details;
}

function parseArgs(argv) {
  const positionals = [];
  const flags = new Set();

  for (const arg of argv) {
    if (arg.startsWith('--')) {
      flags.add(arg);
    } else {
      positionals.push(arg);
    }
  }

  return {
    agentKey: positionals[0],
    quoteOnly: flags.has('--quote'),
  };
}

function getAgentConfig(agentKey) {
  const config = AGENT_CONFIG[agentKey];

  if (!config) {
    throw new Error(
      `Unknown agent "${agentKey}". Use one of: ${Object.keys(AGENT_CONFIG).join(', ')}`,
    );
  }

  return config;
}

function buildAgentAlias(agentKey) {
  const config = getAgentConfig(agentKey);
  const aliasOverride =
    process.env[`HOL_${agentKey.toUpperCase()}_ALIAS`] ||
    process.env.HOL_AGENT_ALIAS;

  if (aliasOverride) {
    return aliasOverride;
  }

  return `${config.aliasPrefix}-${Date.now().toString(36)}`;
}

function getBrokerBaseUrl() {
  return (
    process.env.HOL_REGISTRY_BROKER_BASE_URL ||
    process.env.REGISTRY_BROKER_BASE_URL ||
    process.env.REGISTRY_BROKER_API_URL ||
    DEFAULT_BROKER_BASE_URL
  );
}

function getPublicBaseUrl() {
  return (
    process.env.FROGGY_PLANNER_PUBLIC_BASE_URL || DEFAULT_PUBLIC_BASE_URL
  ).replace(/\/+$/, '');
}

function resolveBrokerApiKey() {
  const apiKey =
    process.env.HOL_REGISTRY_API_KEY ||
    process.env.REGISTRY_BROKER_API_KEY ||
    process.env.HGRAPH_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Missing HOL_REGISTRY_API_KEY. Set HOL_REGISTRY_API_KEY for Registry Broker registration.',
    );
  }

  return apiKey;
}

function resolveBrokerClientOptions() {
  const ledgerApiKey =
    process.env.HOL_LEDGER_API_KEY || process.env.HGRAPH_LEDGER_API_KEY;
  const accountId =
    process.env.HOL_REGISTRY_ACCOUNT_ID ||
    process.env.REGISTRY_BROKER_ACCOUNT_ID ||
    process.env.HGRAPH_ACCOUNT_ID;
  const options = {
    baseUrl: getBrokerBaseUrl(),
    apiKey: resolveBrokerApiKey(),
  };

  if (ledgerApiKey) {
    options.ledgerApiKey = ledgerApiKey;
  }

  if (accountId) {
    options.accountId = String(accountId).trim();
  }

  return options;
}

function resolveRequestedAdditionalRegistries(agentKey) {
  const config = getAgentConfig(agentKey);
  const raw =
    process.env[`HOL_${String(agentKey || '').toUpperCase()}_ERC8004_NETWORKS`] ||
    process.env.HOL_ERC8004_NETWORKS;

  if (typeof raw !== 'string') {
    if (Array.isArray(config.defaultAdditionalRegistries)) {
      return [...config.defaultAdditionalRegistries];
    }
    return [...DEFAULT_ERC8004_NETWORKS];
  }

  if (!raw.trim()) {
    return [];
  }

  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

async function resolveValidatedAdditionalRegistries(client, agentKey) {
  const requested = resolveRequestedAdditionalRegistries(agentKey);

  if (!requested.length) {
    return {
      requested,
      supported: [],
      selected: [],
    };
  }

  const catalog = await client.getAdditionalRegistries();
  const supported = new Set();

  for (const registry of catalog.registries || []) {
    for (const network of registry.networks || []) {
      if (network.key) supported.add(network.key);
      if (network.registryId) supported.add(network.registryId);
      if (network.networkId) supported.add(network.networkId);
    }
  }

  const supportedList = Array.from(supported);

  const missing = requested.filter((value) => !supported.has(value));

  if (missing.length) {
    throw new Error(
      `Unsupported additional registries: ${missing.join(', ')}. Supported values from broker catalog: ${supportedList.join(', ')}`,
    );
  }

  return {
    requested,
    supported: supportedList,
    selected: requested,
  };
}

/**
 * @param {string} agentKey
 * @param {{ alias: string, publicBaseUrl: string }} runtime
 * @returns {HCS11Profile}
 */
function buildHcs11Profile(agentKey, runtime) {
  const config = getAgentConfig(agentKey);
  /** @type {HCS11Profile} */
  const profile = {
    version: '1.0',
    type: ProfileType.AI_AGENT,
    display_name: config.name,
    alias: runtime.alias,
    bio: config.description,
    socials: buildPublicAgentSocials(runtime.publicBaseUrl),
    properties: {
      tags: config.tags,
      documentationUrl: config.documentationUrl,
      discoveryUrl: `${runtime.publicBaseUrl}${config.discoveryPath}`,
      agentCardUrl: `${runtime.publicBaseUrl}${config.agentCardPath}`,
      endpointUrl: `${runtime.publicBaseUrl}${config.endpointPath}`,
      category: config.category,
      source: config.source,
    },
    aiAgent: {
      type: AIAgentType.AUTONOMOUS,
      model: config.getModel(),
      capabilities: config.capabilities,
      creator: config.provider,
    },
  };

  return profile;
}

/**
 * @param {HCS11Profile} profile
 * @param {string} agentKey
 * @param {{ additionalRegistries?: string[] }} [options]
 * @returns {AgentRegistrationRequest}
 */
function buildRegistrationPayload(profile, agentKey, options = {}) {
  const { additionalRegistries = [] } = options;
  const config = getAgentConfig(agentKey);
  const publicBaseUrl = getPublicBaseUrl();
  const serviceEndpoint = `${publicBaseUrl}${config.endpointPath}`;
  const discoveryUrl = `${publicBaseUrl}${config.discoveryPath}`;
  const agentCardUrl = `${publicBaseUrl}${config.agentCardPath}`;
  const documentationUrl = config.documentationUrl;

  /** @type {AgentRegistrationRequest} */
  const payload = {
    profile,
    communicationProtocol: 'a2a',
    registry: DEFAULT_REGISTRY,
    endpoint: discoveryUrl,
    metadata: {
      version: '1.0.0',
      source: config.source,
      provider: config.provider,
      category: config.category,
      publicUrl: serviceEndpoint,
      endpointUrl: serviceEndpoint,
      serviceEndpoint,
      discoveryUrl,
      agentCardUrl,
      documentationUrl,
      model: config.getModel(),
      tags: config.tags,
      skills: config.skills.map((skill) => ({
        id: skill.id,
        name: skill.name,
      })),
      customFields: {
        source: config.source,
        provider: config.provider,
        category: config.category,
        documentationUrl,
        agentCardUrl,
        discoveryUrl,
        endpointUrl: serviceEndpoint,
        serviceEndpoint,
        a2aEndpoint: serviceEndpoint,
      },
    },
  };

  if (additionalRegistries.length) {
    payload.additionalRegistries = additionalRegistries;
  }

  return payload;
}

async function createAuthenticatedClient(agentKey) {
  const client = new RegistryBrokerClient(resolveBrokerClientOptions());

  return client;
}

async function waitForCompletionIfPending(client, response, stage) {
  if (!isPendingRegisterAgentResponse(response) || !response.attemptId) {
    return null;
  }

  const progress = await client.waitForRegistrationCompletion(
    response.attemptId,
    DEFAULT_WAIT_OPTIONS,
  );

  return {
    stage,
    attemptId: response.attemptId,
    progress,
  };
}

function summarizeResponse(response) {
  return {
    success: response.success,
    status: response.status || null,
    uaid: response.uaid || null,
    agentId: response.agentId || null,
    registry: response.registry || null,
    attemptId: response.attemptId || null,
    message: response.message || null,
    additionalRegistries: Array.isArray(response.additionalRegistries)
      ? response.additionalRegistries
      : [],
    partial: isPartialRegisterAgentResponse(response),
    successResponse: isSuccessRegisterAgentResponse(response),
    pending: isPendingRegisterAgentResponse(response),
  };
}

function buildRuntimeContext(agentKey) {
  return {
    agentKey,
    alias: buildAgentAlias(agentKey),
    publicBaseUrl: getPublicBaseUrl(),
    brokerBaseUrl: getBrokerBaseUrl(),
  };
}

async function verifyErc8004Registration(client, runtime) {
  const searchResults = await client.search({
    registries: [DEFAULT_ERC8004_SEARCH_REGISTRY],
    q: runtime.alias,
    limit: 5,
  });

  return {
    registry: DEFAULT_ERC8004_SEARCH_REGISTRY,
    total: searchResults.total,
    hits: (searchResults.hits || []).map((agent) => ({
      name: agent.name || null,
      uaid: agent.uaid || null,
      registry: agent.registry || null,
      metadata: {
        chainName: agent.metadata?.chainName || null,
        ownerWallet: agent.metadata?.ownerWallet || null,
      },
    })),
  };
}

async function quoteAgent(agentKey) {
  const runtime = buildRuntimeContext(agentKey);
  const client = await createAuthenticatedClient(agentKey);
  const additional = await resolveValidatedAdditionalRegistries(client, agentKey);
  /** @type {HCS11Profile} */
  const profile = buildHcs11Profile(agentKey, runtime);
  /** @type {AgentRegistrationRequest} */
  const registrationPayload = buildRegistrationPayload(profile, agentKey);
  const registrationQuote =
    await client.getRegistrationQuote(registrationPayload);
  /** @type {AgentRegistrationRequest} */
  const updatePayload = buildRegistrationPayload(profile, agentKey, {
    additionalRegistries: additional.selected,
  });

  console.log(
    JSON.stringify(
      {
        mode: 'quote',
        agent: agentKey,
        alias: runtime.alias,
        brokerBaseUrl: runtime.brokerBaseUrl,
        publicBaseUrl: runtime.publicBaseUrl,
        profile,
        registration: {
          step: 'registerAgent',
          payload: registrationPayload,
          quote: registrationQuote,
        },
        update: {
          step: 'updateAgent',
          note: 'Run updateAgent(uaid, payload) after registerAgent succeeds. The SDK does not expose a separate update quote helper.',
          payload: updatePayload,
          additionalRegistries: additional.selected,
        },
      },
      null,
      2,
    ),
  );
}

async function registerAgent(agentKey) {
  const runtime = buildRuntimeContext(agentKey);
  const client = await createAuthenticatedClient(agentKey);
  const additional = await resolveValidatedAdditionalRegistries(client, agentKey);
  /** @type {HCS11Profile} */
  const profile = buildHcs11Profile(agentKey, runtime);
  /** @type {AgentRegistrationRequest} */
  const registrationPayload = buildRegistrationPayload(profile, agentKey);
  let registrationResponse;
  try {
    registrationResponse = await client.registerAgent(registrationPayload);
  } catch (error) {
    if (error instanceof Error) {
      error.step = 'registerAgent';
    }
    throw error;
  }
  const registrationProgress = await waitForCompletionIfPending(
    client,
    registrationResponse,
    'registerAgent',
  );
  const uaid = registrationResponse.uaid;

  if (!uaid) {
    throw new Error(
      'registerAgent completed without a UAID; refusing to continue to ERC-8004 update.',
    );
  }

  let updateResponse = null;
  let updateProgress = null;
  let verification = null;

  if (additional.selected.length) {
    /** @type {AgentRegistrationRequest} */
    const updatePayload = buildRegistrationPayload(profile, agentKey, {
      additionalRegistries: additional.selected,
    });

    try {
      updateResponse = await client.updateAgent(uaid, updatePayload);
    } catch (error) {
      if (error instanceof Error) {
        error.step = 'updateAgent';
      }
      throw error;
    }
    updateProgress = await waitForCompletionIfPending(
      client,
      updateResponse,
      'updateAgent',
    );
    verification = await verifyErc8004Registration(client, runtime);
  }

  console.log(
    JSON.stringify(
      {
        mode: 'register',
        agent: agentKey,
        alias: runtime.alias,
        brokerBaseUrl: runtime.brokerBaseUrl,
        publicBaseUrl: runtime.publicBaseUrl,
        registration: summarizeResponse(registrationResponse),
        registrationProgress,
        update: updateResponse
          ? summarizeResponse(updateResponse)
          : {
              skipped: true,
              reason:
                'No ERC-8004 registries selected. Set HOL_ERC8004_NETWORKS to enable the second-step update.',
            },
        updateProgress,
        verification: verification || {
          skipped: true,
          reason:
            'ERC-8004 verification search is only run after updateAgent(...) with additionalRegistries.',
        },
      },
      null,
      2,
    ),
  );
}

async function main() {
  const { agentKey, quoteOnly } = parseArgs(process.argv.slice(2));

  if (!agentKey) {
    throw new Error(
      'Usage: node apps/froggy-planner/hol/registerAgent.js <froggychat|planner|foundry|guardian> [--quote]',
    );
  }

  if (quoteOnly) {
    await quoteAgent(agentKey);
    return;
  }

  await registerAgent(agentKey);
}

main().catch((error) => {
  console.error(JSON.stringify(serializeError(error), null, 2));
  process.exitCode = 1;
});
