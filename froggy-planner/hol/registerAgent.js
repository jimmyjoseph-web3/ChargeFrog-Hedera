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