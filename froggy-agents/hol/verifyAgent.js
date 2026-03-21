#!/usr/bin/env node

require('dotenv').config({
  path: require('path').resolve(__dirname, '../../../.env'),
});

const { RegistryBrokerClient } = require('@hashgraphonline/standards-sdk');
const { PUBLIC_A2A_AGENT_METADATA } = require('../http/publicAgentMetadata');

const DEFAULT_BROKER_BASE_URL = 'https://hol.org/registry/api/v1';
const DEFAULT_PUBLIC_BASE_URL = 'https://froggyplanner.onrender.com';

const AGENT_CONFIG = PUBLIC_A2A_AGENT_METADATA;
const AGENT_KEYS = Object.freeze(Object.keys(AGENT_CONFIG));

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
  const flags = {
    json: false,
    skipBroker: false,
    skipPublic: false,
    verifyDns: false,
    requireVerified: true,
  };
  const positionals = [];

  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }

    switch (arg) {
      case '--json':
        flags.json = true;
        break;
      case '--skip-broker':
        flags.skipBroker = true;
        break;
      case '--skip-public':
        flags.skipPublic = true;
        break;
      case '--verify-dns':
        flags.verifyDns = true;
        break;
      case '--allow-unverified':
        flags.requireVerified = false;
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
    agentKey: positionals[0] || '',
  };
}

function printUsage() {
  console.log(`Usage:
  node apps/froggy-planner/hol/verifyAgent.js <froggychat|planner|foundry|guardian|all>

Options:
  --json             Print full JSON output.
  --skip-broker      Skip HOL broker checks.
  --skip-public      Skip public HTTP checks.
  --verify-dns       Trigger HOL DNS verification and refresh DNS status.
  --allow-unverified Exit 0 even when HOL verification is not complete.
`);
}

function getAgentConfig(agentKey) {
  const config = AGENT_CONFIG[agentKey];

  if (!config) {
    throw new Error(
      `Unknown agent "${agentKey}". Use one of: ${AGENT_KEYS.join(', ')}, all`,
    );
  }

  return config;
}

function normalizePublicBaseUrl() {
  return String(
    process.env.FROGGY_PLANNER_PUBLIC_BASE_URL || DEFAULT_PUBLIC_BASE_URL,
  )
    .trim()
    .replace(/\/+$/, '');
}

function getBrokerBaseUrl() {
  return (
    process.env.HOL_REGISTRY_BROKER_BASE_URL ||
    process.env.REGISTRY_BROKER_BASE_URL ||
    process.env.REGISTRY_BROKER_API_URL ||
    DEFAULT_BROKER_BASE_URL
  );
}

function resolveBrokerClientOptions() {
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
    options.accountId = String(accountId).trim();
  }

  return options;
}

function resolveUaid(agentKey) {
  const envKey = `HOL_${agentKey.toUpperCase()}_UAID`;
  const uaid = process.env[envKey] || '';

  return {
    envKey,
    uaid: String(uaid).trim() || null,
  };
}

function parseUaid(uaid) {
  const value = String(uaid || '').trim();
  if (!value.startsWith('uaid:')) {
    return null;
  }

  const firstSemicolonIndex = value.indexOf(';');
  const head =
    firstSemicolonIndex === -1 ? value : value.slice(0, firstSemicolonIndex);
  const paramsRaw =
    firstSemicolonIndex === -1 ? '' : value.slice(firstSemicolonIndex + 1);
  const headParts = head.split(':');

  if (headParts.length < 3) {
    return null;
  }

  const target = String(headParts[1] || '').trim();
  const id = headParts.slice(2).join(':').trim();

  if (!target || !id) {
    return null;
  }

  const params = {};
  for (const segment of paramsRaw.split(';')) {
    const trimmedSegment = String(segment || '').trim();
    if (!trimmedSegment) continue;

    const [rawKey, ...rawValueParts] = trimmedSegment.split('=');
    const key = String(rawKey || '').trim();
    const valuePart = rawValueParts.join('=').trim();

    if (!key || !valuePart) continue;
    params[key] = valuePart;
  }

  return {
    target,
    id,
    params,
  };
}

function buildDnsRecordHint(uaid, status = null) {
  const parsed = parseUaid(uaid);
  if (!parsed) {
    return null;
  }

  const nativeId = String(parsed.params.nativeId || '').trim();
  const uid = String(parsed.params.uid || '').trim();
  const proto = String(parsed.params.proto || '').trim();

  if (!nativeId || !uid || !proto) {
    return null;
  }

  const dnsName =
    firstNonEmptyString(status && status.dnsName, `_uaid.${nativeId}`) || null;
  if (!dnsName) {
    return null;
  }

  const suffix = `.${nativeId}`;
  const relativeHost = dnsName.endsWith(suffix)
    ? dnsName.slice(0, -suffix.length)
    : dnsName;
  const orderedFields = [
    ['target', parsed.target],
    ['id', parsed.id],
    ['uid', uid],
    ['proto', proto],
    ['nativeId', nativeId],
    ['registry', parsed.params.registry],
    ['domain', parsed.params.domain],
    ['src', parsed.params.src],
    ['did', parsed.params.did],
    ['m', parsed.params.m],
  ];
  const txtValue = orderedFields
    .filter(([, value]) => String(value || '').trim())
    .map(([key, value]) => `${key}=${String(value).trim()}`)
    .join(';');

  return {
    dnsName,
    relativeHost: relativeHost || null,
    zone: nativeId,
    txtValue,
  };
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function buildPublicUrls(agentKey) {
  const publicBaseUrl = normalizePublicBaseUrl();
  const config = getAgentConfig(agentKey);

  return {
    publicBaseUrl,
    discoveryUrl: `${publicBaseUrl}${config.discoveryPath}`,
    agentCardUrl: `${publicBaseUrl}${config.agentCardPath}`,
    serviceEndpoint: `${publicBaseUrl}${config.endpointPath}`,
  };
}

async function fetchUrl(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = String(response.headers.get('content-type') || '');
  const text = await response.text();

  let json = null;
  if (contentType.toLowerCase().includes('application/json')) {
    try {
      json = JSON.parse(text);
    } catch (_error) {
      json = null;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    contentType,
    text,
    json,
  };
}

function extractResolvedEndpoint(resolved) {
  if (!isRecord(resolved) || !isRecord(resolved.agent)) {
    return null;
  }

  const agent = resolved.agent;
  const endpoints = isRecord(agent.endpoints) ? agent.endpoints : null;

  return (
    firstNonEmptyString(
      endpoints && endpoints.a2a,
      endpoints && endpoints.primary,
      agent.endpoint,
      agent.url,
      isRecord(agent.metadata) ? agent.metadata.endpointUrl : null,
      isRecord(agent.metadata) ? agent.metadata.serviceEndpoint : null,
      isRecord(agent.metadata) ? agent.metadata.discoveryUrl : null,
    ) || null
  );
}

function summarizeResolve(resolved) {
  if (!isRecord(resolved) || !isRecord(resolved.agent)) {
    return null;
  }

  const agent = resolved.agent;

  return {
    name: agent.name || null,
    registry: agent.registry || null,
    protocol:
      agent.communicationProtocol ||
      agent.protocol ||
      (Array.isArray(agent.protocols) && agent.protocols.length
        ? agent.protocols[0]
        : null),
    endpoint: extractResolvedEndpoint(resolved),
  };
}

function summarizeDnsStatus(status) {
  if (!isRecord(status)) {
    return null;
  }

  const error = isRecord(status.error)
    ? {
        code: status.error.code || null,
        message: status.error.message || null,
      }
    : null;

  return {
    verified: Boolean(status.verified),
    profileId: status.profileId || null,
    checkedAt: status.checkedAt || null,
    nativeId: status.nativeId || null,
    dnsName: status.dnsName || null,
    verificationLevel: status.verificationLevel || null,
    resolutionMode: status.resolutionMode || null,
    reconstructedUaid: status.reconstructedUaid || null,
    selectedFollowupProfile: status.selectedFollowupProfile || null,
    source: status.source || null,
    persisted:
      typeof status.persisted === 'boolean' ? status.persisted : null,
    error,
  };
}

async function runPublicChecks(agentKey) {
  const urls = buildPublicUrls(agentKey);
  const discovery = await fetchUrl(urls.discoveryUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });
  const agentCard = await fetchUrl(urls.agentCardUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });
  const endpointProbe = await fetchUrl(urls.serviceEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: '{',
  });

  const discoveryEndpoint =
    discovery.json && isRecord(discovery.json)
      ? firstNonEmptyString(
          discovery.json.serviceEndpoint,
          isRecord(discovery.json.endpoints) ? discovery.json.endpoints.a2a : null,
          discovery.json.url,
        )
      : null;
  const agentCardEndpoint =
    agentCard.json && isRecord(agentCard.json)
      ? firstNonEmptyString(
          agentCard.json.serviceEndpoint,
          isRecord(agentCard.json.endpoints) ? agentCard.json.endpoints.a2a : null,
          agentCard.json.url,
        )
      : null;
  const endpointProbeJsonRpcError =
    endpointProbe.json &&
    isRecord(endpointProbe.json) &&
    endpointProbe.json.jsonrpc === '2.0' &&
    isRecord(endpointProbe.json.error)
      ? endpointProbe.json.error.message || null
      : null;

  const discoveryHealthy =
    discovery.ok &&
    isRecord(discovery.json) &&
    discoveryEndpoint === urls.serviceEndpoint;
  const agentCardHealthy =
    agentCard.ok &&
    isRecord(agentCard.json) &&
    agentCardEndpoint === urls.serviceEndpoint;
  const endpointHealthy =
    endpointProbe.status === 400 && Boolean(endpointProbeJsonRpcError);

  return {
    urls,
    discovery: {
      ok: discovery.ok,
      status: discovery.status,
      contentType: discovery.contentType,
      endpoint: discoveryEndpoint,
      expectedEndpoint: urls.serviceEndpoint,
      healthy: discoveryHealthy,
      bodyPreview: discovery.ok ? null : discovery.text.slice(0, 200),
    },
    agentCard: {
      ok: agentCard.ok,
      status: agentCard.status,
      contentType: agentCard.contentType,
      endpoint: agentCardEndpoint,
      expectedEndpoint: urls.serviceEndpoint,
      healthy: agentCardHealthy,
      bodyPreview: agentCard.ok ? null : agentCard.text.slice(0, 200),
    },
    endpointProbe: {
      ok: endpointProbe.ok,
      status: endpointProbe.status,
      contentType: endpointProbe.contentType,
      healthy: endpointHealthy,
      errorMessage: endpointProbeJsonRpcError,
      bodyPreview:
        endpointProbe.ok || endpointProbeJsonRpcError
          ? null
          : endpointProbe.text.slice(0, 200),
    },
    healthy: discoveryHealthy && agentCardHealthy && endpointHealthy,
  };
}

async function runBrokerChecks(agentKey, options = {}) {
  const { envKey, uaid } = resolveUaid(agentKey);
  if (!uaid) {
    return {
      skipped: true,
      reason: `Missing ${envKey}.`,
      uaid: null,
    };
  }

  const client = new RegistryBrokerClient(resolveBrokerClientOptions());
  const registerStatus = await client.getRegisterStatus(uaid);
  let verificationStatus = await client.getVerificationStatus(uaid);
  let dnsVerification = null;
  let dnsStatus = null;

  if (options.verifyDns) {
    dnsVerification = summarizeDnsStatus(
      await client.verifyUaidDnsTxt({
        uaid,
        persist: true,
      }),
    );
    dnsStatus = summarizeDnsStatus(
      await client.getVerificationDnsStatus(uaid, {
        refresh: true,
        persist: false,
      }),
    );
    verificationStatus = await client.getVerificationStatus(uaid);
  }

  const resolved = await client.resolveUaid(uaid);
  const dnsRecordHint = buildDnsRecordHint(uaid, dnsStatus || dnsVerification);

  let ownership = null;
  if (verificationStatus && verificationStatus.verified) {
    try {
      ownership = await client.getVerificationOwnership(uaid);
    } catch (_error) {
      ownership = null;
    }
  }

  return {
    skipped: false,
    uaid,
    registerStatus: {
      registered: Boolean(registerStatus && registerStatus.registered),
    },
    verificationStatus: {
      verified: Boolean(verificationStatus && verificationStatus.verified),
      chain:
        verificationStatus && verificationStatus.chain
          ? verificationStatus.chain
          : null,
    },
    dnsVerification,
    dnsStatus,
    dnsRecordHint,
    ownership:
      ownership && isRecord(ownership)
        ? {
            ownerType: ownership.ownerType || null,
            ownerId: ownership.ownerId || null,
            ownerHandle: ownership.ownerHandle || null,
            method: ownership.method || null,
            chain: ownership.chain || null,
            verifiedAt: ownership.verifiedAt || null,
          }
        : null,
    resolved: summarizeResolve(resolved),
    healthy: Boolean(
      registerStatus &&
        registerStatus.registered &&
        verificationStatus &&
        verificationStatus.verified,
    ),
  };
}

async function verifyAgent(agentKey, options = {}) {
  const result = {
    agent: agentKey,
    name: getAgentConfig(agentKey).name,
    checkedAt: new Date().toISOString(),
    brokerBaseUrl: getBrokerBaseUrl(),
    publicBaseUrl: normalizePublicBaseUrl(),
    public: null,
    broker: null,
    healthy: false,
    verified: false,
  };

  if (!options.skipPublic) {
    result.public = await runPublicChecks(agentKey);
  }

  if (!options.skipBroker) {
    result.broker = await runBrokerChecks(agentKey, {
      verifyDns: options.verifyDns,
    });
  }

  const publicHealthy =
    result.public === null ? true : Boolean(result.public.healthy);
  const brokerVerified =
    result.broker && !result.broker.skipped
      ? Boolean(
          result.broker.verificationStatus &&
            result.broker.verificationStatus.verified,
        )
      : false;
  const brokerRegistered =
    result.broker && !result.broker.skipped
      ? Boolean(
          result.broker.registerStatus && result.broker.registerStatus.registered,
        )
      : false;

  result.verified = brokerVerified;
  result.healthy = publicHealthy && brokerRegistered && brokerVerified;

  return result;
}

function formatSummaryLine(result) {
  const brokerLabel =
    result.broker === null || result.broker.skipped
      ? 'broker=skipped'
      : `broker=${result.verified ? 'verified' : 'unverified'}`;
  const publicLabel =
    result.public === null ? 'public=skipped' : `public=${result.public.healthy ? 'ok' : 'fail'}`;

  return `[${result.agent}] ${brokerLabel} ${publicLabel}`;
}

function collectFailures(result, options = {}) {
  const failures = [];

  if (result.public && !result.public.healthy) {
    if (!result.public.discovery.healthy) {
      failures.push(
        `${result.agent}: discovery doc is unhealthy (${result.public.discovery.status})`,
      );
    }
    if (!result.public.agentCard.healthy) {
      failures.push(
        `${result.agent}: agent card is unhealthy (${result.public.agentCard.status})`,
      );
    }
    if (!result.public.endpointProbe.healthy) {
      failures.push(
        `${result.agent}: A2A endpoint probe failed (${result.public.endpointProbe.status})`,
      );
    }
  }

  if (result.broker && result.broker.skipped) {
    failures.push(`${result.agent}: broker check skipped (${result.broker.reason})`);
  } else if (result.broker) {
    if (
      !(
        result.broker.registerStatus && result.broker.registerStatus.registered
      )
    ) {
      failures.push(`${result.agent}: not registered in HOL`);
    }

    if (
      options.requireVerified &&
      !(
        result.broker.verificationStatus &&
        result.broker.verificationStatus.verified
      )
    ) {
      failures.push(`${result.agent}: HOL verification badge is not yet verified`);
    }

    if (
      options.verifyDns &&
      !(
        result.broker.dnsStatus &&
        result.broker.dnsStatus.verified
      )
    ) {
      failures.push(`${result.agent}: HOL DNS verification is not yet verified`);
    }
  }

  return failures;
}

async function main() {
  const { flags, agentKey } = parseArgs(process.argv.slice(2));

  if (flags.help || !agentKey) {
    printUsage();
    return;
  }

  if (flags.verifyDns && flags.skipBroker) {
    throw new Error('--verify-dns cannot be used with --skip-broker');
  }

  const selectedKeys =
    agentKey === 'all' ? AGENT_KEYS : [String(agentKey).trim().toLowerCase()];

  for (const key of selectedKeys) {
    getAgentConfig(key);
  }

  const results = [];
  for (const key of selectedKeys) {
    results.push(
      await verifyAgent(key, {
        skipBroker: flags.skipBroker,
        skipPublic: flags.skipPublic,
        verifyDns: flags.verifyDns,
      }),
    );
  }

  const failures = results.flatMap((result) =>
    collectFailures(result, {
      requireVerified: flags.requireVerified,
      verifyDns: flags.verifyDns,
    }),
  );

  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          ok: failures.length === 0,
          requireVerified: flags.requireVerified,
          verifyDns: flags.verifyDns,
          results,
          failures,
        },
        null,
        2,
      ),
    );
  } else {
    for (const result of results) {
      console.log(formatSummaryLine(result));
      if (result.broker && result.broker.uaid) {
        console.log(`  uaid: ${result.broker.uaid}`);
      }
      if (result.broker && result.broker.verificationStatus) {
        console.log(
          `  verification: ${result.broker.verificationStatus.verified ? 'verified' : 'not verified'}${
            result.broker.verificationStatus.chain
              ? ` (${result.broker.verificationStatus.chain})`
              : ''
          }`,
        );
      }
      if (result.broker && result.broker.dnsStatus) {
        console.log(
          `  dns verification: ${result.broker.dnsStatus.verified ? 'verified' : 'not verified'}${
            result.broker.dnsStatus.dnsName
              ? ` (${result.broker.dnsStatus.dnsName})`
              : ''
          }`,
        );
        if (result.broker.dnsStatus.error && result.broker.dnsStatus.error.message) {
          console.log(`  dns error: ${result.broker.dnsStatus.error.message}`);
        }
      }
      if (
        result.broker &&
        result.broker.dnsRecordHint &&
        !(
          result.broker.dnsStatus &&
          result.broker.dnsStatus.verified
        )
      ) {
        console.log(`  dns host: ${result.broker.dnsRecordHint.relativeHost}`);
        console.log(`  dns zone: ${result.broker.dnsRecordHint.zone}`);
        console.log(`  dns txt: ${result.broker.dnsRecordHint.txtValue}`);
      }
      if (result.public && result.public.urls) {
        console.log(`  discovery: ${result.public.urls.discoveryUrl}`);
        console.log(`  endpoint: ${result.public.urls.serviceEndpoint}`);
      }
    }

    if (failures.length) {
      console.log('\nFailures:');
      for (const failure of failures) {
        console.log(`- ${failure}`);
      }
    }
  }

  if (failures.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(JSON.stringify(serializeError(error), null, 2));
  process.exitCode = 1;
});
