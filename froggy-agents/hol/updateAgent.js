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
const DEFAULT_ERC8004_NETWORKS = ['erc-8004:arbitrum-sepolia'];
const DEFAULT_ERC8004_SEARCH_REGISTRY = 'erc-8004-adapter';
const DEFAULT_WAIT_OPTIONS = {
  intervalMs: 2_000,
  timeoutMs: 120_000,
};

const AGENT_CONFIG = PUBLIC_A2A_AGENT_METADATA;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneJson(value) {
  if (!isRecord(value) && !Array.isArray(value)) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

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

function isProfileRegistryUnavailableError(error) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      error.status === 503 &&
      error.body &&
      typeof error.body === 'object' &&
      error.body.error === 'profile_registry_unavailable',
  );
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
    leanProfile: flags.has('--lean-profile'),
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
      'Missing HOL_REGISTRY_API_KEY. Set HOL_REGISTRY_API_KEY for Registry Broker update.',
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

function resolveUaid(agentKey) {
  const envKey = `HOL_${agentKey.toUpperCase()}_UAID`;
  const uaid = process.env[envKey] || process.env.HOL_AGENT_UAID;

  if (!uaid) {
    throw new Error(
      `Missing ${envKey}. Set ${envKey} to the existing UAID you want to update.`,
    );
  }

  return String(uaid).trim();
}

function resolveRequestedAdditionalRegistries(agentKey) {
  const config = getAgentConfig(agentKey);
  const raw =
    process.env[
      `HOL_${String(agentKey || '').toUpperCase()}_ERC8004_NETWORKS`
    ] || process.env.HOL_ERC8004_NETWORKS;

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

function extractNativeIdFromUaid(uaid) {
  const segments = String(uaid || '')
    .split(';')
    .slice(1);

  for (const segment of segments) {
    const [rawKey, ...rawValueParts] = segment.split('=');
    if (String(rawKey || '').trim() !== 'nativeId') continue;
    return rawValueParts.join('=').trim() || null;
  }

  return null;
}

function estimateJsonSizeBytes(value) {
  return Buffer.byteLength(JSON.stringify(value));
}

function getResolvedAgentProfile(resolved) {
  const profile =
    resolved && resolved.agent && isRecord(resolved.agent.profile)
      ? resolved.agent.profile
      : null;

  return profile ? cloneJson(profile) : null;
}

function getResolvedAgentMetadata(resolved) {
  const metadata =
    resolved && resolved.agent && isRecord(resolved.agent.metadata)
      ? resolved.agent.metadata
      : null;

  return metadata ? cloneJson(metadata) : {};
}

async function resolveExistingAgentState(client, runtime) {
  const resolved = await client.resolveUaid(runtime.uaid);
  const profile = getResolvedAgentProfile(resolved);
  const metadata = getResolvedAgentMetadata(resolved);
  const nativeId =
    (resolved &&
      resolved.agent &&
      typeof resolved.agent.nativeId === 'string' &&
      resolved.agent.nativeId.trim()) ||
    (typeof metadata.nativeId === 'string' && metadata.nativeId.trim()) ||
    extractNativeIdFromUaid(runtime.uaid);

  return {
    resolved,
    profile,
    metadata,
    nativeId: nativeId || null,
  };
}

/**
 * @param {string} agentKey
 * @param {{ publicBaseUrl: string, leanProfile?: boolean }} runtime
 * @returns {HCS11Profile}
 */
function buildHcs11Profile(agentKey, runtime) {
  const config = getAgentConfig(agentKey);
  const useLeanProfile = Boolean(runtime.leanProfile);
  const bio = useLeanProfile
    ? `${config.name} is a ChargeFrog A2A ${config.category} agent.`
    : config.description;
  const properties = {
    documentationUrl: config.documentationUrl,
    discoveryUrl: `${runtime.publicBaseUrl}${config.discoveryPath}`,
    agentCardUrl: `${runtime.publicBaseUrl}${config.agentCardPath}`,
    endpointUrl: `${runtime.publicBaseUrl}${config.endpointPath}`,
    category: config.category,
    source: config.source,
    ...(useLeanProfile ? {} : { tags: config.tags }),
  };

  /** @type {HCS11Profile} */
  const profile = {
    version: '1.0',
    type: ProfileType.AI_AGENT,
    display_name: config.name,
    bio,
    socials: useLeanProfile
      ? []
      : buildPublicAgentSocials(runtime.publicBaseUrl),
    properties,
    aiAgent: {
      type: AIAgentType.AUTONOMOUS,
      model: config.getModel(),
      capabilities: config.capabilities,
      creator: config.provider,
    },
  };

  return profile;
}

function mergeLockedProfileFields(profile, existingProfile) {
  if (!isRecord(existingProfile)) {
    return profile;
  }

  const merged = cloneJson(existingProfile);
  const nextAiAgent = isRecord(profile.aiAgent) ? profile.aiAgent : {};
  const currentAiAgent = isRecord(merged.aiAgent) ? merged.aiAgent : {};

  merged.type = profile.type;
  merged.bio = profile.bio;
  merged.socials = cloneJson(profile.socials);
  merged.properties = cloneJson(profile.properties);
  merged.aiAgent = {
    ...currentAiAgent,
    ...cloneJson(nextAiAgent),
  };

  if (Array.isArray(currentAiAgent.capabilities)) {
    merged.aiAgent.capabilities = cloneJson(currentAiAgent.capabilities);
  }

  return merged;
}

/**
 * @param {HCS11Profile} profile
 * @param {string} agentKey
 * @param {{ additionalRegistries?: string[] }} [options]
 * @returns {AgentRegistrationRequest}
 */
function buildUpdatePayload(profile, agentKey, options = {}) {
  const {
    additionalRegistries = [],
    existingMetadata = {},
    nativeId = null,
  } = options;
  const config = getAgentConfig(agentKey);
  const publicBaseUrl = getPublicBaseUrl();
  const serviceEndpoint = `${publicBaseUrl}${config.endpointPath}`;
  const discoveryUrl = `${publicBaseUrl}${config.discoveryPath}`;
  const agentCardUrl = `${publicBaseUrl}${config.agentCardPath}`;
  const documentationUrl = config.documentationUrl;
  const mergedMetadata = {
    ...(isRecord(existingMetadata) ? existingMetadata : {}),
  };

  /** @type {AgentRegistrationRequest} */
  const payload = {
    profile,
    communicationProtocol: 'a2a',
    registry: DEFAULT_REGISTRY,
    endpoint: discoveryUrl,
    metadata: mergedMetadata,
  };

  payload.metadata.version = '1.0.0';
  payload.metadata.source = config.source;
  payload.metadata.provider = config.provider;
  payload.metadata.category = config.category;
  payload.metadata.publicUrl = serviceEndpoint;
  payload.metadata.endpointUrl = serviceEndpoint;
  payload.metadata.serviceEndpoint = serviceEndpoint;
  payload.metadata.discoveryUrl = discoveryUrl;
  payload.metadata.agentCardUrl = agentCardUrl;
  payload.metadata.documentationUrl = documentationUrl;
  payload.metadata.model = config.getModel();
  payload.metadata.tags = config.tags;
  payload.metadata.skills = config.skills.map((skill) => ({
    id: skill.id,
    name: skill.name,
  }));

  if (nativeId) {
    payload.metadata.nativeId = nativeId;
  }

  const existingCustomFields = isRecord(payload.metadata.customFields)
    ? payload.metadata.customFields
    : {};

  payload.metadata.customFields = {
    ...existingCustomFields,
    source: config.source,
    provider: config.provider,
    category: config.category,
    documentationUrl,
    agentCardUrl,
    discoveryUrl,
    endpointUrl: serviceEndpoint,
    serviceEndpoint,
    a2aEndpoint: serviceEndpoint,
    ...(nativeId ? { nativeId } : {}),
  };

  if (additionalRegistries.length) {
    payload.additionalRegistries = additionalRegistries;
  }

  return payload;
}

async function createClient() {
  return new RegistryBrokerClient(resolveBrokerClientOptions());
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
    publicBaseUrl: getPublicBaseUrl(),
    brokerBaseUrl: getBrokerBaseUrl(),
    uaid: resolveUaid(agentKey),
  };
}

async function verifyErc8004Registration(client, agentKey, runtime) {
  const config = getAgentConfig(agentKey);
  const searchResults = await client.search({
    registries: [DEFAULT_ERC8004_SEARCH_REGISTRY],
    q: config.name,
    limit: 10,
  });

  return {
    registry: DEFAULT_ERC8004_SEARCH_REGISTRY,
    total: searchResults.total,
    hits: (searchResults.hits || [])
      .filter(
        (agent) => agent.uaid === runtime.uaid || agent.name === config.name,
      )
      .map((agent) => ({
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

async function quoteUpdate(agentKey, options = {}) {
  const runtime = buildRuntimeContext(agentKey);
  const client = await createClient();
  const additional = await resolveValidatedAdditionalRegistries(
    client,
    agentKey,
  );
  const existing = await resolveExistingAgentState(client, runtime);
  /** @type {HCS11Profile} */
  const profile = mergeLockedProfileFields(
    buildHcs11Profile(agentKey, {
      ...runtime,
      leanProfile: options.leanProfile,
    }),
    existing.profile,
  );
  /** @type {AgentRegistrationRequest} */
  const payload = buildUpdatePayload(profile, agentKey, {
    additionalRegistries: additional.selected,
    existingMetadata: existing.metadata,
    nativeId: existing.nativeId,
  });
}

async function updateAgent(agentKey, options = {}) {
  const runtime = buildRuntimeContext(agentKey);
  const client = await createClient();
  const additional = await resolveValidatedAdditionalRegistries(
    client,
    agentKey,
  );
  const existing = await resolveExistingAgentState(client, runtime);
  /** @type {HCS11Profile} */
  const profile = mergeLockedProfileFields(
    buildHcs11Profile(agentKey, {
      ...runtime,
      leanProfile: options.leanProfile,
    }),
    existing.profile,
  );
  /** @type {AgentRegistrationRequest} */
  const payload = buildUpdatePayload(profile, agentKey, {
    additionalRegistries: additional.selected,
    existingMetadata: existing.metadata,
    nativeId: existing.nativeId,
  });
  const quote = await client.getRegistrationQuote(payload);

  let updateResponse;
  try {
    updateResponse = await client.updateAgent(runtime.uaid, payload);
  } catch (error) {
    if (isProfileRegistryUnavailableError(error) && !options.leanProfile) {
      return updateAgent(agentKey, {
        ...options,
        leanProfile: true,
        autoRetriedWithLeanProfile: true,
      });
    }
    if (error instanceof Error) {
      error.step = 'updateAgent';
    }
    throw error;
  }

  let finalUaid = isSuccessRegisterAgentResponse(updateResponse)
    ? updateResponse.uaid || runtime.uaid
    : null;
  let updateProgress = null;

  if (
    isPendingRegisterAgentResponse(updateResponse) &&
    updateResponse.attemptId
  ) {
    updateProgress = await waitForCompletionIfPending(
      client,
      updateResponse,
      'updateAgent',
    );

    const final = updateProgress?.progress;
    if (final?.status === 'completed' && final.uaid) {
      finalUaid = final.uaid;
    } else if (final?.status && final.status !== 'completed') {
      throw new Error(`Update ended with status: ${final.status}`);
    }
  } else if (isPartialRegisterAgentResponse(updateResponse)) {
    throw new Error(
      `Update completed with partial status: ${updateResponse.message || updateResponse.status || 'partial'}`,
    );
  } else if (
    !isSuccessRegisterAgentResponse(updateResponse) &&
    !isPendingRegisterAgentResponse(updateResponse)
  ) {
    throw new Error(
      `Unexpected update status: ${updateResponse.status || 'unknown'}`,
    );
  }

  const verification = additional.selected.length
    ? await verifyErc8004Registration(client, agentKey, runtime)
    : {
        skipped: true,
        reason:
          'No additional registries selected. Set HOL_ERC8004_NETWORKS to enable ERC-8004 update.',
      };

  console.log(
    JSON.stringify(
      {
        mode: 'update',
        agent: agentKey,
        uaid: runtime.uaid,
        brokerBaseUrl: runtime.brokerBaseUrl,
        publicBaseUrl: runtime.publicBaseUrl,
        quote: {
          requiredCredits: quote.requiredCredits,
          shortfallCredits: quote.shortfallCredits ?? 0,
          availableCredits: quote.availableCredits ?? null,
          freeQuotaRemaining: quote.freeQuotaRemaining ?? null,
        },
        leanProfile: Boolean(options.leanProfile),
        autoRetriedWithLeanProfile: Boolean(
          options.autoRetriedWithLeanProfile,
        ),
        profileSizeBytesEstimate: estimateJsonSizeBytes(profile),
        preservedLockedFields: {
          display_name: profile.display_name || null,
          version: profile.version || null,
          capabilities:
            profile &&
            profile.aiAgent &&
            Array.isArray(profile.aiAgent.capabilities)
              ? profile.aiAgent.capabilities
              : [],
          nativeId: existing.nativeId,
        },
        update: summarizeResponse(updateResponse),
        updateProgress,
        updatedUaid: finalUaid,
        verification,
      },
      null,
      2,
    ),
  );
}

async function main() {
  const { agentKey, quoteOnly, leanProfile } = parseArgs(process.argv.slice(2));

  if (!agentKey) {
    throw new Error(
      'Usage: node apps/froggy-planner/hol/updateAgent.js <froggychat|planner|foundry|guardian> [--quote] [--lean-profile]',
    );
  }

  if (quoteOnly) {
    await quoteUpdate(agentKey, { leanProfile });
    return;
  }

  await updateAgent(agentKey, { leanProfile });
}

main().catch((error) => {
  console.error(JSON.stringify(serializeError(error), null, 2));
  process.exitCode = 1;
});
