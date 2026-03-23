#!/usr/bin/env node

require('dotenv').config();

const { randomUUID } = require('crypto');
const { RegistryBrokerClient } = require('@hashgraphonline/standards-sdk');

const DEFAULT_BROKER_BASE_URL = 'https://hol.org/registry/api/v1';
const DEFAULT_ENCRYPTION_PREFERENCE = 'disabled';

const AGENTS = Object.freeze({
  froggychat: {
    label: 'FroggyChat',
    envVar: 'HOL_FROGGYCHAT_UAID',
  },
  planner: {
    label: 'FroggyPlanner',
    envVar: 'HOL_PLANNER_UAID',
  },
  guardian: {
    label: 'FroggyGuardian',
    envVar: 'HOL_GUARDIAN_UAID',
  },
  foundry: {
    label: 'FroggyFoundry',
    envVar: 'HOL_FOUNDRY_UAID',
  },
});

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

function getBrokerBaseUrl() {
  return (
    process.env.HOL_REGISTRY_BROKER_BASE_URL ||
    process.env.REGISTRY_BROKER_BASE_URL ||
    process.env.REGISTRY_BROKER_API_URL ||
    DEFAULT_BROKER_BASE_URL
  );
}

function createBrokerClient() {
  const apiKey =
    process.env.HOL_REGISTRY_API_KEY ||
    process.env.REGISTRY_BROKER_API_KEY ||
    process.env.HGRAPH_API_KEY;
  const ledgerApiKey =
    process.env.HOL_LEDGER_API_KEY || process.env.HGRAPH_LEDGER_API_KEY;
  const accountId =
    process.env.HOL_REGISTRY_ACCOUNT_ID ||
    process.env.REGISTRY_BROKER_ACCOUNT_ID ||
    process.env.HGRAPH_ACCOUNT_ID;

  const options = {
    baseUrl: getBrokerBaseUrl(),
  };

  if (apiKey) {
    options.apiKey = apiKey;
  }
  if (ledgerApiKey) {
    options.ledgerApiKey = ledgerApiKey;
  }
  if (accountId) {
    options.accountId = accountId;
  }

  return new RegistryBrokerClient(options);
}

function normalizeAgentKey(agentKey) {
  const normalized = String(agentKey || '')
    .trim()
    .toLowerCase();
  if (!normalized || !AGENTS[normalized]) {
    throw new Error(
      `Unknown agent "${agentKey}". Use one of: ${Object.keys(AGENTS).join(', ')}`,
    );
  }
  return normalized;
}

function getAgentDescriptor(agentKey) {
  const normalizedAgentKey = normalizeAgentKey(agentKey);
  const descriptor = AGENTS[normalizedAgentKey];
  const uaid = String(process.env[descriptor.envVar] || '').trim();

  if (!uaid) {
    throw new Error(
      `Missing ${descriptor.envVar}. Set ${descriptor.envVar} in .env before using workflow.js.`,
    );
  }

  return {
    agentKey: normalizedAgentKey,
    label: descriptor.label,
    envVar: descriptor.envVar,
    uaid,
  };
}

function normalizeEncryptionPreference(value) {
  const normalized = String(value || DEFAULT_ENCRYPTION_PREFERENCE)
    .trim()
    .toLowerCase();
  if (
    normalized === 'disabled' ||
    normalized === 'preferred' ||
    normalized === 'required'
  ) {
    return normalized;
  }
  throw new Error(
    `Unsupported encryption preference "${value}". Use disabled, preferred, or required.`,
  );
}

function toFiniteInteger(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return Math.floor(parsed);
}

function coerceJsonValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return raw;
  }
}

function formatResolvedAgent(resolved) {
  const agent = resolved && resolved.agent ? resolved.agent : {};
  return {
    id: agent.id || null,
    uaid: agent.uaid || null,
    name: agent.name || null,
    registry: agent.registry || null,
    protocol:
      agent.communicationProtocol ||
      agent.protocol ||
      (Array.isArray(agent.protocols) && agent.protocols.length
        ? agent.protocols[0]
        : null),
    endpoints: agent.endpoints || null,
    metadata: agent.metadata || null,
  };
}

function isA2aResolvedAgent(resolvedAgent) {
  const candidates = [
    resolvedAgent && resolvedAgent.protocol,
    resolvedAgent &&
      resolvedAgent.metadata &&
      resolvedAgent.metadata.communicationProtocol,
    resolvedAgent &&
      resolvedAgent.metadata &&
      resolvedAgent.metadata.protocol,
  ];

  return candidates.some(
    (candidate) => String(candidate || '').trim().toLowerCase() === 'a2a',
  );
}

function buildA2aBrokerMessage(message, options = {}) {
  if (message && typeof message === 'object' && !Array.isArray(message)) {
    return message;
  }

  const text = String(message || '').trim();
  if (!text) {
    throw new Error('message is required');
  }

  const metadata =
    options && options.messageMetadata && typeof options.messageMetadata === 'object'
      ? { ...options.messageMetadata }
      : {};

  if (options.walletAddress) {
    metadata.walletAddress = options.walletAddress;
  }

  return {
    jsonrpc: '2.0',
    id: String(options.requestId || randomUUID()),
    method: 'message/send',
    params: {
      message: {
        messageId: String(options.messageId || `msg-${randomUUID()}`),
        role: 'user',
        parts: [{ text }],
        ...(Object.keys(metadata).length ? { metadata } : {}),
      },
    },
  };
}

function extractTextFromParts(parts) {
  if (!Array.isArray(parts)) return '';

  return parts
    .map((part) => {
      if (!part || typeof part !== 'object') return '';
      if (typeof part.text === 'string') return part.text.trim();
      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

function extractA2aResponseText(rawResponse) {
  if (!rawResponse || typeof rawResponse !== 'object') {
    return '';
  }

  const resultText = extractTextFromParts(
    rawResponse &&
      rawResponse.result &&
      rawResponse.result.status &&
      rawResponse.result.status.message &&
      rawResponse.result.status.message.parts,
  );
  if (resultText) {
    return resultText;
  }

  const artifactTexts = (
    (rawResponse &&
      rawResponse.result &&
      Array.isArray(rawResponse.result.artifacts) &&
      rawResponse.result.artifacts) ||
    []
  )
    .map((artifact) => extractTextFromParts(artifact && artifact.parts))
    .filter(Boolean)
    .join('\n')
    .trim();
  if (artifactTexts) {
    return artifactTexts;
  }

  const errorMessage =
    rawResponse &&
    rawResponse.error &&
    typeof rawResponse.error.message === 'string'
      ? rawResponse.error.message.trim()
      : '';
  if (errorMessage) {
    return errorMessage;
  }

  return '';
}

function extractResponseText(response) {
  const a2aText = extractA2aResponseText(response && response.rawResponse);
  if (a2aText) {
    return a2aText;
  }

  const direct = [
    response && response.content,
    response && response.message,
    response &&
      response.rawResponse &&
      typeof response.rawResponse === 'object' &&
      response.rawResponse.content,
    response &&
      response.rawResponse &&
      typeof response.rawResponse === 'object' &&
      response.rawResponse.message,
  ].find((value) => String(value || '').trim());

  if (direct) {
    return String(direct).trim();
  }

  const raw = response && response.rawResponse;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim();
  }

  if (raw !== undefined) {
    return JSON.stringify(raw, null, 2);
  }

  return '';
}

async function resolveAgent(agentKey, options = {}) {
  const client = options.client || createBrokerClient();
  const agent = getAgentDescriptor(agentKey);
  const resolved = await client.resolveUaid(agent.uaid);

  return {
    agentKey: agent.agentKey,
    label: agent.label,
    uaid: agent.uaid,
    resolved: formatResolvedAgent(resolved),
  };
}

async function callAgent(agentKey, message, options = {}) {
  const structuredMessage =
    message && typeof message === 'object' && !Array.isArray(message)
      ? message
      : null;
  const trimmedMessage =
    structuredMessage === null ? String(message || '').trim() : '';

  if (!structuredMessage && !trimmedMessage) {
    throw new Error('message is required');
  }

  const client = options.client || createBrokerClient();
  const agent = getAgentDescriptor(agentKey);
  const resolved = await client.resolveUaid(agent.uaid);
  const resolvedAgent = formatResolvedAgent(resolved);
  const encryptionPreference = normalizeEncryptionPreference(
    options.encryptionPreference,
  );
  let sessionId = null;
  let response;
  let requestMessage = structuredMessage || trimmedMessage;

  if (isA2aResolvedAgent(resolvedAgent)) {
    if (encryptionPreference !== 'disabled') {
      throw new Error(
        'A2A broker workflow currently requires encryptionPreference "disabled".',
      );
    }

    const session = await client.chat.createSession({
      uaid: agent.uaid,
      senderUaid: options.senderUaid,
      historyTtlSeconds: toFiniteInteger(options.historyTtlSeconds),
      auth: options.auth,
    });

    sessionId = session.sessionId;
    requestMessage = buildA2aBrokerMessage(requestMessage, options);
    response = await client.chat.sendMessage({
      sessionId,
      uaid: agent.uaid,
      message: requestMessage,
      streaming: Boolean(options.streaming),
      auth: options.auth,
    });
  } else {
    const conversation = await client.chat.start({
      uaid: agent.uaid,
      senderUaid: options.senderUaid,
      historyTtlSeconds: toFiniteInteger(options.historyTtlSeconds),
      auth: options.auth,
      encryption: {
        preference: encryptionPreference,
      },
      onSessionCreated: options.onSessionCreated,
    });

    sessionId = conversation.sessionId;
    response = await conversation.send({
      plaintext: trimmedMessage,
      message: trimmedMessage,
      streaming: Boolean(options.streaming),
      auth: options.auth,
    });
  }

  return {
    agentKey: agent.agentKey,
    label: agent.label,
    uaid: agent.uaid,
    sessionId,
    resolved: resolvedAgent,
    request: {
      message: requestMessage,
    },
    response,
    reply: extractResponseText(response),
  };
}

async function callPlanner(message, options = {}) {
  return callAgent('planner', message, options);
}

async function callFroggyChat(message, options = {}) {
  return callAgent('froggychat', message, options);
}

async function callGuardian(message, options = {}) {
  return callAgent('guardian', message, options);
}

async function callFoundry(message, options = {}) {
  return callAgent('foundry', message, options);
}

async function runWorkflow(steps, options = {}) {
  const client = options.client || createBrokerClient();
  const orderedSteps = [
    ['froggychat', steps && steps.froggychat],
    ['planner', steps && steps.planner],
    ['foundry', steps && steps.foundry],
    ['guardian', steps && steps.guardian],
  ].filter(([, message]) => String(message || '').trim());

  if (!orderedSteps.length) {
    throw new Error(
      'workflow requires at least one of: froggychat, planner, foundry, guardian',
    );
  }

  const results = [];
  for (const [agentKey, message] of orderedSteps) {
    results.push(
      await callAgent(agentKey, message, {
        ...options,
        client,
      }),
    );
  }

  return results;
}

function printUsage() {
  console.log(`Usage:
  node apps/froggy-planner/hol/workflow.js froggychat "which stations require my attention?"
  node apps/froggy-planner/hol/workflow.js planner "find a station near Madison Square Garden"
  node apps/froggy-planner/hol/workflow.js foundry "which stations require my attention?"
  node apps/froggy-planner/hol/workflow.js guardian "what stations have been fully-invested?"
  node apps/froggy-planner/hol/workflow.js workflow --froggychat "..." [--planner "..."] [--foundry "..."] [--guardian "..."]
  node apps/froggy-planner/hol/workflow.js resolve froggychat

Options:
  --json                      Print full JSON output.
  --resolve-only              Resolve the UAID without starting a chat.
  --history-ttl <seconds>     Pass chat history TTL seconds to the broker.
  --sender-uaid <uaid>        Optional sender UAID for broker-side session context.
  --encryption <mode>         disabled | preferred | required. Default: disabled.
  --streaming                 Request streaming mode from the broker.
  --auth-json <json>          Optional auth object forwarded to the broker.
  --froggychat <message>      FroggyChat step message when using workflow.
  --planner <message>         Planner step message when using workflow.
  --foundry <message>         Foundry step message when using workflow.
  --guardian <message>        Guardian step message when using workflow.

Environment:
  HOL_FROGGYCHAT_UAID
  HOL_PLANNER_UAID
  HOL_GUARDIAN_UAID
  HOL_FOUNDRY_UAID
  HOL_REGISTRY_API_KEY
  HOL_REGISTRY_BROKER_BASE_URL`);
}

function parseArgs(argv) {
  const flags = {
    json: false,
    resolveOnly: false,
    streaming: false,
    encryptionPreference: DEFAULT_ENCRYPTION_PREFERENCE,
  };
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }

    const nextValue = argv[index + 1];
    switch (arg) {
      case '--json':
        flags.json = true;
        break;
      case '--resolve-only':
        flags.resolveOnly = true;
        break;
      case '--streaming':
        flags.streaming = true;
        break;
      case '--history-ttl':
        flags.historyTtlSeconds = nextValue;
        index += 1;
        break;
      case '--sender-uaid':
        flags.senderUaid = nextValue;
        index += 1;
        break;
      case '--encryption':
        flags.encryptionPreference = nextValue;
        index += 1;
        break;
      case '--auth-json':
        flags.auth = coerceJsonValue(nextValue);
        index += 1;
        break;
      case '--froggychat':
        flags.froggychatMessage = nextValue;
        index += 1;
        break;
      case '--planner':
        flags.plannerMessage = nextValue;
        index += 1;
        break;
      case '--foundry':
        flags.foundryMessage = nextValue;
        index += 1;
        break;
      case '--guardian':
        flags.guardianMessage = nextValue;
        index += 1;
        break;
      case '--help':
      case '-h':
        flags.help = true;
        break;
      default:
        throw new Error(`Unknown flag "${arg}"`);
    }
  }

  return {
    flags,
    command: positionals[0],
    subcommand: positionals[1],
    message: positionals.slice(1).join(' ').trim(),
  };
}

function formatResultForConsole(result) {
  return [
    `[${result.agentKey}] ${result.label}`,
    `uaid: ${result.uaid}`,
    `sessionId: ${result.sessionId}`,
    `resolvedAgent: ${result.resolved.name || 'unknown'} (${result.resolved.registry || 'unknown registry'})`,
    'reply:',
    result.reply || '[empty reply]',
  ].join('\n');
}

async function main() {
  const { flags, command, subcommand, message } = parseArgs(process.argv.slice(2));

  if (flags.help || !command) {
    printUsage();
    return;
  }

  const commonOptions = {
    auth: flags.auth,
    senderUaid: flags.senderUaid,
    historyTtlSeconds: toFiniteInteger(flags.historyTtlSeconds),
    encryptionPreference: flags.encryptionPreference,
    streaming: flags.streaming,
  };

  if (command === 'resolve') {
    if (!subcommand) {
      throw new Error(
        'resolve requires an agent key: froggychat, planner, foundry, or guardian',
      );
    }
    const result = await resolveAgent(subcommand);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'workflow') {
    const results = await runWorkflow(
      {
        froggychat: flags.froggychatMessage,
        planner: flags.plannerMessage,
        foundry: flags.foundryMessage,
        guardian: flags.guardianMessage,
      },
      commonOptions,
    );

    if (flags.json) {
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    for (const [index, result] of results.entries()) {
      if (index > 0) {
        console.log('\n---\n');
      }
      console.log(formatResultForConsole(result));
    }
    return;
  }

  const normalizedAgentKey = normalizeAgentKey(command);
  if (flags.resolveOnly) {
    const resolved = await resolveAgent(normalizedAgentKey);
    console.log(JSON.stringify(resolved, null, 2));
    return;
  }

  const result = await callAgent(normalizedAgentKey, message, commonOptions);
  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(formatResultForConsole(result));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify(serializeError(error), null, 2));
    process.exitCode = 1;
  });
}

module.exports = {
  AGENTS,
  serializeError,
  createBrokerClient,
  resolveAgent,
  callAgent,
  callFroggyChat,
  callPlanner,
  callGuardian,
  callFoundry,
  runWorkflow,
};
