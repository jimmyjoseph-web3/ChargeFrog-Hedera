const {
  Client,
  PrivateKey,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TopicId,
} = require('@hashgraph/sdk');
const {
  createBond,
  createToken,
  ensureConnected,
  getBalance,
  issue,
  mint,
} = require('../../clients/atsClient');
const {
  deployStationBundle: deployStationBundleClient,
} = require('../../clients/stationContractsClient');
const {
  normalizePrivateKey,
} = require('../../clients/privateKeyEthereumProvider');
const {
  findPoiByArea,
  findChargingStationsByAvailability,
  resolveAreaCenter: resolveAreaCenterTomTom,
  reverseGeocodeByPosition,
} = require('../../clients/tomtomClient');
const { uploadJsonToIpfsWithPinata } = require('../../clients/pinataClient');
const {
  createMiniNode,
  countMiniNodesInNeighborhood,
} = require('../../store/miniNodeStore');
const {
  appendAuditLog,
  createInvestmentProposalRecord,
  findStationByLocation: findStationByLocationRecord,
  getProposalRecord,
  getStationById,
  getStationByProposalId: getStationByProposalIdRecord,
  listAllStations: listAllStationsRecord,
  listAvailableStations,
  listStationsByStage: listStationsByStageRecord,
  readMetadataByUri,
  saveStationDeployment: saveStationDeploymentRecord,
  saveIssuedAssets,
  updateProposalOnChainRecord,
} = require('../../store/stationStore');
const path = require('path');
const {
  buildIpfsProposalPayload,
  sha256Hex,
} = require('../services/proposalFormatter');
const { loadMarkdownPrompt } = require('../../lib/promptLoader');

const WEB_SEARCH_SYSTEM_PROMPT = loadMarkdownPrompt(
  path.resolve(__dirname, '../prompts/web-search-system.md'),
);

const MILES_TO_METERS = 1609.344;
const COUNTRY_CODE = 'MY';
const ISIN_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const HCS_MESSAGE_MAX_BYTES = 6000;
const DEFAULT_CONFIG_ID =
  '0x0000000000000000000000000000000000000000000000000000000000000001';
const DEFAULT_MIRROR_NODE_URLS = {
  mainnet: 'https://mainnet.mirrornode.hedera.com/api/v1/',
  previewnet: 'https://previewnet.mirrornode.hedera.com/api/v1/',
  testnet: 'https://testnet.mirrornode.hedera.com/api/v1/',
};
let cachedHcsTopicId;

// Handles nowIsoString.
function nowIsoString() {
  return new Date().toISOString();
}

// Handles toFiniteNumber.
function toFiniteNumber(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

// Handles toPositiveInt.
function toPositiveInt(value, fallback, label) {
  const parsed = toFiniteNumber(value);
  if (parsed === undefined) return fallback;
  const normalized = Math.trunc(parsed);
  if (normalized <= 0) {
    throw new Error(`${label} must be greater than 0`);
  }
  return normalized;
}

// Handles toUnixTimestampSeconds.
function toUnixTimestampSeconds(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error('startingDate and maturityDate must be valid timestamps');
  }
  const normalized = Math.trunc(timestamp);
  if (normalized > 1_000_000_000_000) {
    return Math.trunc(normalized / 1000);
  }
  return normalized;
}

// Handles milesToMeters.
function milesToMeters(value, fallbackMiles) {
  const miles = toFiniteNumber(value);
  const resolved = miles !== undefined ? miles : fallbackMiles;
  if (!Number.isFinite(resolved) || resolved <= 0) {
    throw new Error('radiusMiles must be a positive number');
  }
  return Math.trunc(resolved * MILES_TO_METERS);
}

// Handles normalizeLocation.
function normalizeLocation(value) {
  if (!value || typeof value !== 'object') {
    throw new Error('location is required');
  }
  const lat = toFiniteNumber(value.lat);
  const lon = toFiniteNumber(value.lon);
  if (lat === undefined || lon === undefined) {
    throw new Error('location must include lat and lon');
  }
  return { lat, lon };
}

// Handles withRetry.
async function withRetry(task, { retries = 2, baseDelayMs = 400 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await task(attempt + 1);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt >= retries) break;
      const delayMs = baseDelayMs * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

// Handles extractFirstTransactionId.
function extractFirstTransactionId(payload) {
  const queue = [payload];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;

    for (const [key, value] of Object.entries(current)) {
      if (
        typeof value === 'string' &&
        (key === 'transactionId' || key === 'txHash' || key === 'hash')
      ) {
        return value;
      }
      if (value && typeof value === 'object') {
        queue.push(value);
      }
    }
  }
  return null;
}

// Handles randomId9.
function randomId9() {
  let out = '';
  for (let i = 0; i < 9; i += 1) {
    out += ISIN_CHARS[Math.floor(Math.random() * ISIN_CHARS.length)];
  }
  return out;
}

// Handles toDigitsForCheck.
function toDigitsForCheck(identifier) {
  const base = `${COUNTRY_CODE}${identifier}`;
  return base
    .split('')
    .map((char) => {
      if (/\d/.test(char)) {
        return char;
      }
      if (/[A-Z]/.test(char)) {
        return String(char.charCodeAt(0) - 55);
      }
      return '';
    })
    .join('');
}

// Handles computeCheckDigit.
function computeCheckDigit(digitStr) {
  let sum = 0;
  const reversed = String(digitStr).split('').reverse();
  for (let i = 0; i < reversed.length; i += 1) {
    let n = Number.parseInt(reversed[i], 10);
    if (i % 2 === 0) {
      n *= 2;
    }
    if (n > 9) {
      n = Math.floor(n / 10) + (n % 10);
    }
    sum += n;
  }
  return (10 - (sum % 10)) % 10;
}

// Handles buildIsin.
function buildIsin() {
  const id9 = randomId9();
  const digits = toDigitsForCheck(id9);
  const check = computeCheckDigit(digits);
  return `${COUNTRY_CODE}${id9}${check}`;
}

// Handles envValue.
function envValue(...keys) {
  for (const key of keys) {
    const raw = process.env[key];
    if (raw !== undefined && String(raw).trim() !== '') {
      return String(raw).trim();
    }
  }
  return undefined;
}

// Handles extractJsonObject.
function extractJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (_error) {
    // Continue to bracket extraction.
  }

  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    return null;
  }

  try {
    return JSON.parse(raw.slice(first, last + 1));
  } catch (_error) {
    return null;
  }
}

// Handles extractResponsesOutputText.
function extractResponsesOutputText(payload) {
  if (
    typeof payload?.output_text === 'string' &&
    payload.output_text.trim() !== ''
  ) {
    return payload.output_text;
  }

  const outputItems = Array.isArray(payload?.output) ? payload.output : [];
  const chunks = [];
  for (const item of outputItems) {
    if (!item || item.type !== 'message') continue;
    const contents = Array.isArray(item.content) ? item.content : [];
    for (const contentItem of contents) {
      if (
        contentItem &&
        contentItem.type === 'output_text' &&
        typeof contentItem.text === 'string' &&
        contentItem.text.trim() !== ''
      ) {
        chunks.push(contentItem.text.trim());
      }
    }
  }
  return chunks.join('\n').trim();
}

// Handles getOpenAiWebSearchConfig.
function getOpenAiWebSearchConfig() {
  const openAiKeyAlias = String(process.env.OPENAI_KEY || '').trim();
  const openAiApiKey = String(process.env.OPENAI_API_KEY || '').trim();
  const apiKey = openAiKeyAlias || openAiApiKey;
  if (!apiKey) {
    throw new Error('OPENAI_KEY (or OPENAI_API_KEY) is required for webSearch');
  }

  const model = String(
    process.env.AGENT_WEB_SEARCH_MODEL || process.env.AGENT_MODEL || 'gpt-5',
  ).trim();
  const baseUrl = String(
    process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  )
    .trim()
    .replace(/\/$/, '');

  return {
    apiKey,
    model,
    baseUrl,
  };
}

// Handles normalizeCurrencyHex.
function normalizeCurrencyHex(value) {
  const raw = String(value || 'USD').trim();
  if (/^0x[0-9a-fA-F]+$/.test(raw)) {
    return raw.toLowerCase();
  }
  const normalized = raw.toUpperCase();
  return `0x${Buffer.from(normalized, 'ascii').toString('hex')}`;
}

// Handles sanitizeStationName.
function sanitizeStationName(value, fallback) {
  const normalized = String(value || '')
    .replace(/[^\w\s-]/g, ' ')
    .trim();
  if (normalized) {
    return normalized.replace(/\s+/g, ' ');
  }
  const fb = String(fallback || 'station')
    .replace(/[^\w\s-]/g, ' ')
    .trim();
  return fb ? fb.replace(/\s+/g, ' ') : 'station';
}

// Handles normalizeTokenSymbol.
function normalizeTokenSymbol(value, fallback) {
  const cleaned = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const resolved =
    cleaned ||
    String(fallback || 'CF')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
  const sliced = resolved.slice(0, 10);
  return sliced || 'CF';
}

// Handles deepCloneJson.
function deepCloneJson(value) {
  if (!value || typeof value !== 'object') return {};
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_error) {
    return {};
  }
}

// Handles resolveHederaNetwork.
function resolveHederaNetwork() {
  const raw = String(envValue('HEDERA_NETWORK') || 'testnet')
    .trim()
    .toLowerCase();
  if (raw === 'mainnet') return 'mainnet';
  if (raw === 'previewnet') return 'previewnet';
  return 'testnet';
}

// Handles ensureMirrorApiBaseUrl.
function ensureMirrorApiBaseUrl(baseUrl) {
  const raw = String(baseUrl || '').trim();
  if (!raw) return '';

  const trimmed = raw.endsWith('/') ? raw.slice(0, -1) : raw;
  if (/\/api\/v1$/i.test(trimmed)) {
    return `${trimmed}/`;
  }
  return `${trimmed}/api/v1/`;
}

// Handles resolveMirrorApiBaseUrl.
function resolveMirrorApiBaseUrl(network) {
  const configured = envValue('MIRROR_NODE_URL', 'VITE_MIRROR_NODE_URL');
  if (configured) {
    return ensureMirrorApiBaseUrl(configured);
  }
  return DEFAULT_MIRROR_NODE_URLS[network] || DEFAULT_MIRROR_NODE_URLS.testnet;
}

// Handles fetchMirrorTransactionStatus.
async function fetchMirrorTransactionStatus(transactionId) {
  const txId = String(transactionId || '').trim();
  if (!txId) {
    return {
      found: false,
      reason: 'missing_transaction_id',
    };
  }

  const network = resolveHederaNetwork();
  const baseUrl = resolveMirrorApiBaseUrl(network);
  const url = `${baseUrl}transactions/${encodeURIComponent(txId)}`;
  const response = await fetch(url);

  if (response.status === 404) {
    return {
      found: false,
      network,
      transactionId: txId,
      reason: 'not_found',
    };
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Mirror transaction lookup failed (${response.status}): ${body}`,
    );
  }

  const payload = await response.json();
  const transaction = Array.isArray(payload?.transactions)
    ? payload.transactions[0]
    : null;
  if (!transaction) {
    return {
      found: false,
      network,
      transactionId: txId,
      reason: 'empty_result',
    };
  }

  const result = String(transaction.result || '').toUpperCase();
  return {
    found: true,
    network,
    transactionId: txId,
    result: result || null,
    success: result === 'SUCCESS',
    consensusTimestamp: transaction.consensus_timestamp || null,
    validStartTimestamp: transaction.valid_start_timestamp || null,
    chargedTxFee: transaction.charged_tx_fee ?? null,
    node: transaction.node || null,
  };
}

// Handles fetchMirrorTopicMessage.
async function fetchMirrorTopicMessage(topicId, sequenceNumber) {
  const normalizedTopicId = String(topicId || '').trim();
  const normalizedSequence = Number(sequenceNumber);
  if (
    !normalizedTopicId ||
    !Number.isFinite(normalizedSequence) ||
    normalizedSequence <= 0
  ) {
    return {
      found: false,
      reason: 'missing_topic_or_sequence',
    };
  }

  const network = resolveHederaNetwork();
  const baseUrl = resolveMirrorApiBaseUrl(network);
  const url =
    `${baseUrl}topics/${encodeURIComponent(normalizedTopicId)}/` +
    `messages/${Math.trunc(normalizedSequence)}`;
  const response = await fetch(url);

  if (response.status === 404) {
    return {
      found: false,
      network,
      topicId: normalizedTopicId,
      sequenceNumber: Math.trunc(normalizedSequence),
      reason: 'not_found',
    };
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Mirror topic lookup failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  return {
    found: true,
    network,
    topicId: normalizedTopicId,
    sequenceNumber: Math.trunc(normalizedSequence),
    consensusTimestamp: payload.consensus_timestamp || null,
    runningHash: payload.running_hash || null,
  };
}

// Handles createHederaClient.
function createHederaClient(network) {
  if (network === 'mainnet') return Client.forMainnet();
  if (network === 'previewnet') return Client.forPreviewnet();
  return Client.forTestnet();
}

// Handles parseHederaPrivateKey.
function parseHederaPrivateKey(raw) {
  const normalized = normalizePrivateKey(raw);
  if (!normalized) {
    throw new Error(
      'ADMIN_PRIVATE_KEY is required for HCS proposal publishing',
    );
  }

  const hex = normalized.startsWith('0x') ? normalized.slice(2) : normalized;
  if (/^[a-fA-F0-9]{64}$/.test(hex)) {
    try {
      return PrivateKey.fromStringECDSA(hex);
    } catch (_error) {
      // Continue to generic parser.
    }
  }
  return PrivateKey.fromString(normalized);
}

// Handles resolveHcsOperatorAccountId.
async function resolveHcsOperatorAccountId() {
  const explicitAccountId = envValue('ADMIN_ACCOUNT_ID');
  if (explicitAccountId) {
    return explicitAccountId;
  }

  const connected = await ensureConnected();
  if (connected?.accountId) {
    return String(connected.accountId);
  }

  throw new Error('ADMIN_ACCOUNT_ID is required to submit HCS messages');
}

// Handles toLimitedText.
function toLimitedText(value, maxLength) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.length <= maxLength) return raw;
  return `${raw.slice(0, Math.max(maxLength - 3, 0))}...`;
}

// Handles buildHcsProposalMessage.
function buildHcsProposalMessage(input = {}, metadataHash) {
  const stationTerms =
    input.proposalPayload?.tokenizationInvestmentTerms &&
    typeof input.proposalPayload.tokenizationInvestmentTerms === 'object'
      ? input.proposalPayload.tokenizationInvestmentTerms
      : {};
  const anchor = {
    proposalId: input.proposalId || null,
    stationId: stationTerms.stationId ?? null,
    stationName: stationTerms.stationName || null,
    metadataUri: input.metadataUri || null,
    metadataCid: String(input.metadataUri || '').startsWith('ipfs://')
      ? String(input.metadataUri).slice('ipfs://'.length)
      : null,
    metadataHash,
    locationHash:
      input.proposalPayload?.locationInfrastructure?.locationHash || null,
    geohash: input.proposalPayload?.locationInfrastructure?.geohash || null,
    coordinates:
      input.proposalPayload?.locationInfrastructure?.exactCoordinates || null,
    timestamp: new Date().toISOString(),
  };

  let serialized = JSON.stringify(anchor);
  if (Buffer.byteLength(serialized, 'utf8') > HCS_MESSAGE_MAX_BYTES) {
    throw new Error(
      'Proposal content is too large for HCS message. Reduce metadata size.',
    );
  }
  return serialized;
}

// Handles buildHcsTransactionMemo.
function buildHcsTransactionMemo(input = {}) {
  const proposalId = String(input.proposalId || '').trim();
  const metadataUri = String(input.metadataUri || '').trim();
  const cid = metadataUri.startsWith('ipfs://')
    ? metadataUri.slice('ipfs://'.length)
    : '';
  const cidShort = cid ? cid.slice(0, 16) : '';
  const memoParts = [
    'cf-proposal',
    proposalId || 'unknown',
    cidShort || null,
  ].filter(Boolean);
  return toLimitedText(memoParts.join(':'), 100);
}

// Handles resolveOrCreateHcsTopic.
async function resolveOrCreateHcsTopic(client) {
  if (cachedHcsTopicId) {
    return { topicId: cachedHcsTopicId, created: false };
  }

  const configuredTopic = envValue(
    'INVESTMENT_PROPOSAL_HCS_TOPIC_ID',
    'DAO_PROPOSAL_HCS_TOPIC_ID',
    'HCS_TOPIC_ID',
  );
  if (configuredTopic) {
    cachedHcsTopicId = TopicId.fromString(configuredTopic);
    return { topicId: cachedHcsTopicId, created: false };
  }

  const topicMemo = toLimitedText(
    envValue(
      'INVESTMENT_PROPOSAL_HCS_TOPIC_MEMO',
      'DAO_PROPOSAL_HCS_TOPIC_MEMO',
    ) ||
      'ChargeFrog investment proposals',
    100,
  );
  const topicCreate = await new TopicCreateTransaction()
    .setTopicMemo(topicMemo)
    .execute(client);
  const receipt = await topicCreate.getReceipt(client);
  const topicId = receipt.topicId;
  if (!topicId) {
    throw new Error('Unable to create HCS topic for investment proposals');
  }
  cachedHcsTopicId = topicId;
  return { topicId, created: true };
}

// Handles finalizeProposalPayload.
function finalizeProposalPayload(payload, patch = {}) {
  const model = deepCloneJson(payload);
  const next = patch && typeof patch === 'object' ? patch : {};

  if (
    !model.tokenizationInvestmentTerms ||
    typeof model.tokenizationInvestmentTerms !== 'object'
  ) {
    model.tokenizationInvestmentTerms = {};
  }
  if (
    !model.metadataProofAnchors ||
    typeof model.metadataProofAnchors !== 'object'
  ) {
    model.metadataProofAnchors = {};
  }
  if (
    !model.locationInfrastructure ||
    typeof model.locationInfrastructure !== 'object'
  ) {
    model.locationInfrastructure = {};
  }

  if (next.stationId !== undefined) {
    model.tokenizationInvestmentTerms.stationId = next.stationId;
  }
  if (next.proposalId !== undefined) {
    model.tokenizationInvestmentTerms.proposalId = next.proposalId;
  }
  if (next.metadataUri !== undefined) {
    model.metadataProofAnchors.offChainMetadataUri = next.metadataUri;
  }
  if (next.txHash !== undefined) {
    model.metadataProofAnchors.anchorTxHash = next.txHash;
  }

  const lat = toFiniteNumber(
    model?.locationInfrastructure?.exactCoordinates?.lat,
  );
  const lon = toFiniteNumber(
    model?.locationInfrastructure?.exactCoordinates?.lon,
  );
  if (
    lat !== undefined &&
    lon !== undefined &&
    !model.locationInfrastructure.locationHash
  ) {
    model.locationInfrastructure.locationHash = `0x${sha256Hex(`${lat},${lon}`)}`;
  }

  model.metadataProofAnchors.lastUpdatedTimestamp = new Date().toISOString();

  return model;
}

// Handles publishInvestmentProposalOnChain.
async function publishInvestmentProposalOnChain(input = {}) {
  const metadataHash = `0x${sha256Hex(JSON.stringify(input.proposalPayload || {}))}`;
  return publishViaHcsTopic({ input, metadataHash });
}

// Handles publishViaHcsTopic.
async function publishViaHcsTopic({ input, metadataHash }) {
  const network = resolveHederaNetwork();
  const client = createHederaClient(network);
  const operatorAccountId = await resolveHcsOperatorAccountId();
  const operatorPrivateKey = parseHederaPrivateKey(
    envValue('ADMIN_PRIVATE_KEY', 'VITE_ADMIN_PRIVATE_KEY'),
  );

  client.setOperator(operatorAccountId, operatorPrivateKey);

  try {
    const { topicId, created } = await resolveOrCreateHcsTopic(client);
    const message = buildHcsProposalMessage(input, metadataHash);
    const txMemo = buildHcsTransactionMemo(input);
    const submission = await new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(message)
      .setTransactionMemo(txMemo)
      .execute(client);
    const receipt = await submission.getReceipt(client);
    const sequenceNumber = receipt.topicSequenceNumber
      ? Number(receipt.topicSequenceNumber.toString())
      : null;
    const transactionId = submission.transactionId
      ? submission.transactionId.toString()
      : null;
    if (!transactionId) {
      throw new Error('HCS submission did not return a transaction ID');
    }
    const onChainProposalId =
      sequenceNumber !== null
        ? `${topicId.toString()}:${sequenceNumber}`
        : topicId.toString();

    return {
      mode: 'hcs_topic',
      published: true,
      status: 'submitted',
      txHash: transactionId,
      onChainProposalId,
      raw: {
        topicId: topicId.toString(),
        topicSequenceNumber: sequenceNumber,
        transactionId,
        topicCreated: created,
        network,
        operatorAccountId,
        metadataHash,
        txMemo,
      },
    };
  } finally {
    if (typeof client.close === 'function') {
      client.close();
    }
  }
}

// Handles parsePricing.
function parsePricing(pricing) {
  const source = pricing && typeof pricing === 'object' ? pricing : {};
  const equityPriceHbar = toFiniteNumber(source.equityPriceHbar);
  const bondPriceHbar = toFiniteNumber(source.bondPriceHbar);
  return {
    equityPriceHbar:
      equityPriceHbar !== undefined && equityPriceHbar > 0
        ? equityPriceHbar
        : 1,
    bondPriceHbar:
      bondPriceHbar !== undefined && bondPriceHbar > 0 ? bondPriceHbar : 1,
  };
}

// Handles resolveHederaTargetAccountId.
function resolveHederaTargetAccountId(buyerWallet) {
  const raw = String(buyerWallet || '').trim();
  if (!raw) {
    throw new Error('buyerWallet is required');
  }

  if (/^\d+\.\d+\.\d+$/.test(raw)) {
    return {
      targetId: raw,
      targetSource: 'buyerWallet',
    };
  }

  throw new Error('buyerWallet must be a valid Hedera account ID (0.0.x)');
}

// Handles isSecurityIdFormat.
function isSecurityIdFormat(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  return /^\d+\.\d+\.\d+$/.test(raw) || /^0x[a-fA-F0-9]{40}$/.test(raw);
}

// Handles extractSecurityIdCandidate.
function extractSecurityIdCandidate(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' || typeof value === 'number') {
    const raw = String(value).trim();
    return isSecurityIdFormat(raw) ? raw : null;
  }
  if (typeof value !== 'object') return null;

  const keys = [
    'value',
    'securityId',
    'tokenAddress',
    'diamondAddress',
    'evmDiamondAddress',
    'id',
    'address',
  ];
  for (const key of keys) {
    if (!(key in value)) continue;
    const nested = extractSecurityIdCandidate(value[key]);
    if (nested) return nested;
  }
  return null;
}

// Handles resolveStationTokenAddress.
function resolveStationTokenAddress(station, assetType) {
  const issuedAssets = station?.metadata?.issuedAssets;
  const proposalAssets = station?.metadata?.proposal?.assets || station?.assets;

  const candidates =
    assetType === 'equity'
      ? [
          station?.equityTokenAddress,
          issuedAssets?.equity?.tokenAddress,
          issuedAssets?.equity?.securityId,
          issuedAssets?.equity?.diamondAddress,
          proposalAssets?.equity?.tokenAddress,
          proposalAssets?.equity?.securityId,
          station?.metadata?.equityTokenAddress,
        ]
      : [
          station?.bondTokenAddress,
          issuedAssets?.bond?.tokenAddress,
          issuedAssets?.bond?.securityId,
          issuedAssets?.bond?.diamondAddress,
          proposalAssets?.bond?.tokenAddress,
          proposalAssets?.bond?.securityId,
          station?.metadata?.bondTokenAddress,
        ];

  for (const candidate of candidates) {
    const resolved = extractSecurityIdCandidate(candidate);
    if (resolved) return resolved;
  }
  return null;
}

// Handles normalizeBalanceValue.
function normalizeBalanceValue(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (typeof value !== 'object') return null;

  const keys = ['value', 'amount', 'balance'];
  for (const key of keys) {
    if (!(key in value)) continue;
    const nested = normalizeBalanceValue(value[key]);
    if (nested !== null) return nested;
  }
  return null;
}

// Handles resolveSecurityIdForAssetOperation.
async function resolveSecurityIdForAssetOperation({
  stationId,
  assetType,
  explicitSecurityId,
}) {
  const direct = extractSecurityIdCandidate(explicitSecurityId);
  if (direct) {
    return {
      securityId: direct,
      source: 'request_payload',
    };
  }

  const station = await getStationById(stationId);
  const fromStation = resolveStationTokenAddress(station, assetType);
  if (!fromStation) {
    throw new Error(
      `${assetType} token address is missing for station ${stationId}. Expected ${assetType}TokenAddress in Mongo station record.`,
    );
  }
  return {
    securityId: fromStation,
    source: 'mongodb_station_record',
    station,
  };
}

const agentTools = {
  // Handles webSearch.
  async webSearch(input = {}) {
    const query = String(input.query || '').trim();
    if (!query) {
      throw new Error('query is required');
    }
    const limit = toPositiveInt(input.limit, 5, 'limit');
    const config = getOpenAiWebSearchConfig();
    const response = await fetch(`${config.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        tools: [{ type: 'web_search' }],
        tool_choice: 'required',
        input: [
          {
            role: 'system',
            content:
              WEB_SEARCH_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content:
              `Find ${limit} concise, high-quality sources for this query: ${query}. ` +
              'Each result must include title, snippet, and absolute https URL.',
          },
        ],
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`webSearch failed (${response.status}): ${body}`);
    }

    const payload = await response.json();
    const webSearchCalls = Array.isArray(payload?.output)
      ? payload.output.filter((item) => item && item.type === 'web_search_call')
      : [];
    if (webSearchCalls.length === 0) {
      throw new Error(
        'webSearch failed: OpenAI response did not execute web_search tool',
      );
    }

    const parsed = extractJsonObject(extractResponsesOutputText(payload));
    const rawResults = Array.isArray(parsed?.results) ? parsed.results : [];
    const results = rawResults
      .map((item) => {
        const title = String(item?.title || '').trim();
        const snippet = String(item?.snippet || '').trim();
        const url = String(item?.url || '').trim();
        if (!title || !snippet || !/^https?:\/\//i.test(url)) {
          return null;
        }
        return {
          title,
          snippet,
          url,
          source: 'openai_web_search',
        };
      })
      .filter((item) => Boolean(item))
      .slice(0, limit);
    if (results.length === 0) {
      throw new Error(
        'webSearch failed: OpenAI web search returned no parseable source results',
      );
    }

    return {
      query,
      results,
      model: payload?.model || config.model,
    };
  },

  // Handles getPoi.
  async getPoi(input = {}) {
    return withRetry(() => findPoiByArea(input), {
      retries: 2,
      baseDelayMs: 350,
    });
  },

  // Handles resolveAreaCenter.
  async resolveAreaCenter(input = {}) {
    return withRetry(() => resolveAreaCenterTomTom(input), {
      retries: 2,
      baseDelayMs: 350,
    });
  },

  // Handles reverseGeocode.
  async reverseGeocode(input = {}) {
    return withRetry(() => reverseGeocodeByPosition(input), {
      retries: 2,
      baseDelayMs: 350,
    });
  },

  // Handles getChargingAvailability.
  async getChargingAvailability(input = {}) {
    return withRetry(() => findChargingStationsByAvailability(input), {
      retries: 2,
      baseDelayMs: 350,
    });
  },

  // Handles registerMiniNode.
  async registerMiniNode(input = {}) {
    const payload = {
      ...input,
      timestamp: String(input.timestamp || nowIsoString()),
    };
    return withRetry(() => createMiniNode(payload), {
      retries: 2,
      baseDelayMs: 350,
    });
  },

  // Handles getNeighborhoodSummary.
  async getNeighborhoodSummary(input = {}) {
    const radiusMiles = toFiniteNumber(input.radiusMiles);
    const radiusMeters = input.radiusMeters
      ? toPositiveInt(input.radiusMeters, undefined, 'radiusMeters')
      : milesToMeters(radiusMiles, 50);
    const triggerThreshold = toPositiveInt(
      input.threshold ?? input.triggerThreshold,
      5,
      'threshold',
    );
    return withRetry(
      () =>
        countMiniNodesInNeighborhood({
          lat: input.lat,
          lon: input.lon,
          radiusMeters,
          triggerThreshold,
          lookbackMinutes: input.lookbackMinutes,
          since: input.since,
          until: input.until,
        }),
      { retries: 2, baseDelayMs: 350 },
    );
  },

  // Handles createInvestmentProposal.
  async createInvestmentProposal(input = {}) {
    const location = normalizeLocation(input.location);
    const metadataInput =
      input.metadata && typeof input.metadata === 'object'
        ? input.metadata
        : {};
    const parametersInput =
      input.parameters && typeof input.parameters === 'object'
        ? input.parameters
        : {};

    const proposal = await withRetry(
      () =>
        createInvestmentProposalRecord({
          title: input.title,
          description: input.description,
          location,
          metadata: metadataInput,
          parameters: parametersInput,
          status: 'pending-admin-approval',
          cap: input.cap,
          shares: input.shares,
        }),
      { retries: 1, baseDelayMs: 250 },
    );

    const proposalPayloadDraft = finalizeProposalPayload(
      input.proposalPayload,
      {
        proposalId: proposal.proposalId,
        stationId: proposal.stationId,
        metadataUri: proposal.metadataUri,
      },
    );
    const ipfsProposalPayload = buildIpfsProposalPayload(proposalPayloadDraft);

    const offChainMetadataDocument = {
      schema: 'chargefrog.station-proposal.v1',
      generatedAt: new Date().toISOString(),
      proposalPayload: ipfsProposalPayload,
    };

    const ipfs = await withRetry(
      () =>
        uploadJsonToIpfsWithPinata({
          content: offChainMetadataDocument,
          name: `chargefrog-proposal-${proposal.proposalId}`,
          keyvalues: {
            proposalId: proposal.proposalId,
            stationId: String(proposal.stationId),
            app: 'froggy-planner',
          },
        }),
      { retries: 1, baseDelayMs: 300 },
    );
    const metadataUri = ipfs.ipfsUri || proposal.metadataUri;

    const proposalPayload = finalizeProposalPayload(proposalPayloadDraft, {
      metadataUri,
    });

    const onChain = await withRetry(
      () =>
        publishInvestmentProposalOnChain({
          proposalId: proposal.proposalId,
          metadataUri,
          proposalPayload,
          parameters: parametersInput,
          cap: input.cap,
          shares: input.shares,
          title: input.title,
          description: input.description,
          correlationId: input.correlationId,
        }),
      { retries: 1, baseDelayMs: 300 },
    );

    const finalizedPayload = finalizeProposalPayload(proposalPayload, {
      txHash: onChain.txHash || null,
    });

    const updatedProposal = await withRetry(
      () =>
        updateProposalOnChainRecord({
          proposalId: proposal.proposalId,
          metadataUri,
          txHash: onChain.txHash || proposal.txHash || null,
          onChain,
          metadata: {
            ...metadataInput,
            ipfs,
            offChainMetadata: offChainMetadataDocument,
            proposalPayload: finalizedPayload,
          },
        }),
      { retries: 1, baseDelayMs: 250 },
    );

    await appendAuditLog({
      correlationId: input.correlationId || null,
      action: 'createInvestmentProposal',
      status: onChain.published ? 'ok' : 'pending_onchain',
      proposalId: updatedProposal.proposalId,
      stationId: updatedProposal.stationId,
      txHash: updatedProposal.txHash,
      details: {
        title: input.title,
        onChain,
      },
    });

    return {
      proposalId: updatedProposal.proposalId,
      txHash: updatedProposal.txHash,
      status: updatedProposal.status,
      metadataUri: updatedProposal.metadataUri,
      stationId: updatedProposal.stationId,
      stationName:
        updatedProposal.stationName ||
        metadataInput.stationName ||
        metadataInput.proposedStationName ||
        null,
      onChain: updatedProposal.onChain || onChain,
      proposalPayload: finalizedPayload,
    };
  },

  // Handles readOnChainProposal.
  async readOnChainProposal(input = {}) {
    const proposal = await withRetry(
      () => getProposalRecord(input.proposalId),
      { retries: 1, baseDelayMs: 250 },
    );
    let chainStatus;
    try {
      chainStatus = await withRetry(
        () =>
          fetchMirrorTransactionStatus(
            proposal.txHash || proposal?.onChain?.raw?.transactionId || null,
          ),
        { retries: 1, baseDelayMs: 250 },
      );
    } catch (error) {
      chainStatus = {
        found: false,
        reason: 'lookup_error',
        error: error instanceof Error ? error.message : String(error),
      };
    }

    let topicMessageStatus;
    try {
      topicMessageStatus = await withRetry(
        () =>
          fetchMirrorTopicMessage(
            proposal?.onChain?.raw?.topicId || null,
            proposal?.onChain?.raw?.topicSequenceNumber || null,
          ),
        { retries: 1, baseDelayMs: 250 },
      );
    } catch (error) {
      topicMessageStatus = {
        found: false,
        reason: 'lookup_error',
        error: error instanceof Error ? error.message : String(error),
      };
    }

    const status =
      proposal.status === 'pending' && chainStatus.found && chainStatus.success
        ? 'submitted'
        : proposal.status;

    return {
      status,
      metadataUri: proposal.metadataUri,
      title: proposal.title || null,
      description: proposal.description || null,
      parameters: proposal.parameters,
      stationId: proposal.stationId,
      stationName: proposal.stationName || null,
      cap: proposal.cap,
      shares: proposal.shares,
      pricing: proposal.pricing,
      proposalId: proposal.proposalId,
      txHash: proposal.txHash || null,
      onChain: proposal.onChain || null,
      chainStatus,
      topicMessageStatus,
      proposalPayload: proposal.metadata?.proposalPayload || null,
    };
  },

  // Handles readOffChainMetadata.
  async readOffChainMetadata(input = {}) {
    return withRetry(() => readMetadataByUri(input.metadataUri), {
      retries: 1,
      baseDelayMs: 250,
    });
  },

  // Handles generateISIN.
  async generateISIN(input = {}) {
    void input;
    const isin = buildIsin();
    return {
      isin,
      isin_number: isin,
    };
  },

  // Handles deployStationBundle.
  async deployStationBundle(input = {}) {
    return deployStationBundleClient(input);
  },

  // Handles createEquityToken.
  async createEquityToken(input = {}) {
    const stationId = toPositiveInt(input.stationId, undefined, 'stationId');
    const isinNumber = String(input.isin_number || input.isin || '').trim();
    if (!isinNumber) {
      throw new Error(
        'isin_number (or isin) is required for createEquityToken',
      );
    }
    const totalShares = String(
      input.totalShares || input.numberOfShares || input.shares || '1000',
    );
    const cap = input.cap ?? null;
    const pricePerShare = String(input.pricePerShare || '1');
    const stationName = sanitizeStationName(
      input.stationName || input.metadata?.stationName || input.name,
      `station-${stationId}`,
    );
    const networkLabel = envValue('HEDERA_NETWORK') || 'testnet';
    const adminAccountId = String(
      input.adminAccountId || envValue('ADMIN_ACCOUNT_ID') || '',
    );
    const currencyHex = normalizeCurrencyHex(
      input.currencyHex || input.currency || 'USD',
    );
    const requestPayload = {
      name: String(input.name || `ChargeFrog-${stationName}`),
      symbol: normalizeTokenSymbol(input.symbol, `CF${stationId}EQ`),
      isin: isinNumber,
      decimals: Number(input.decimals ?? 6),

      isWhiteList: Boolean(input.isWhiteList ?? false),
      isControllable: Boolean(input.isControllable ?? true),
      arePartitionsProtected: Boolean(input.arePartitionsProtected ?? false),
      isMultiPartition: Boolean(input.isMultiPartition ?? false),
      clearingActive: Boolean(input.clearingActive ?? false),
      internalKycActivated: Boolean(input.internalKycActivated ?? false),

      externalPausesIds: Array.isArray(input.externalPausesIds)
        ? input.externalPausesIds
        : [],
      externalControlListsIds: Array.isArray(input.externalControlListsIds)
        ? input.externalControlListsIds
        : [],
      externalKycListsIds: Array.isArray(input.externalKycListsIds)
        ? input.externalKycListsIds
        : [],

      diamondOwnerAccount: String(input.diamondOwnerAccount || adminAccountId),

      votingRight: Boolean(input.votingRight ?? false),
      informationRight: Boolean(input.informationRight ?? true),
      liquidationRight: Boolean(input.liquidationRight ?? false),
      subscriptionRight: Boolean(input.subscriptionRight ?? false),
      conversionRight: Boolean(input.conversionRight ?? false),
      redemptionRight: Boolean(input.redemptionRight ?? false),
      putRight: Boolean(input.putRight ?? false),
      dividendRight: Number(input.dividendRight ?? 0),

      currency: String(input.currency || 'USD'),
      currencyHex,
      numberOfShares: totalShares,
      nominalValue: pricePerShare,

      regulationType: Number(input.regulationType ?? 1),
      regulationSubType: Number(input.regulationSubType ?? 0),
      isCountryControlListWhiteList: Boolean(
        input.isCountryControlListWhiteList ?? false,
      ),
      countries: String(input.countries ?? ''),

      info: String(
        input.info ||
          `ChargeFrog-${stationName} equity token for The ChargeFrog project - ${networkLabel}`,
      ),

      configId: String(input.configId || DEFAULT_CONFIG_ID),
      configVersion: Number(input.configVersion ?? 0),
      erc20VotesActivated: Boolean(input.erc20VotesActivated ?? false),
      adminAccountId,
      maxSupply: String(cap || totalShares),
      metadata: input.metadata,
    };

    const response = await createToken(requestPayload);

    const tokenAddress =
      extractSecurityIdCandidate(response?.security?.diamondAddress) ||
      extractSecurityIdCandidate(response?.security?.evmDiamondAddress) ||
      extractSecurityIdCandidate(response?.security) ||
      null;
    const txHash = extractFirstTransactionId(response);

    await appendAuditLog({
      correlationId: input.correlationId || null,
      action: 'createEquityToken',
      status: tokenAddress ? 'ok' : 'error',
      stationId,
      txHash,
      details: {
        stationId,
        tokenAddress,
        isin_number: isinNumber,
        totalShares,
        symbol: requestPayload.symbol,
        name: requestPayload.name,
      },
    });

    return {
      tokenAddress,
      txHash,
      isin: isinNumber,
      isin_number: isinNumber,
      name: requestPayload.name,
      symbol: requestPayload.symbol,
      totalShares,
      cap: cap ?? totalShares,
      pricePerShare,
      requestPayload,
    };
  },

  // Handles createBondToken.
  async createBondToken(input = {}) {
    const stationId = toPositiveInt(input.stationId, undefined, 'stationId');
    const isinNumber = String(input.isin_number || input.isin || '').trim();
    if (!isinNumber) {
      throw new Error('isin_number (or isin) is required for createBondToken');
    }
    const totalBonds = String(input.totalBonds || input.shares || '1000');
    const cap = input.cap ?? null;
    const pricePerBond = String(input.pricePerBond || '1');
    const nowSeconds = Math.floor(Date.now() / 1000);
    let startingDate = toUnixTimestampSeconds(
      input.startingDate,
      nowSeconds + 3600,
    );
    const minSafeStartingDate = nowSeconds + 300;
    if (startingDate <= minSafeStartingDate) {
      startingDate = nowSeconds + 3600;
    }
    let maturityDate = toUnixTimestampSeconds(
      input.maturityDate,
      startingDate + 365 * 24 * 60 * 60,
    );
    if (maturityDate <= startingDate) {
      maturityDate = startingDate + 365 * 24 * 60 * 60;
    }
    const stationName = sanitizeStationName(
      input.stationName || input.metadata?.stationName || input.name,
      `station-${stationId}`,
    );
    const networkLabel = envValue('HEDERA_NETWORK') || 'testnet';
    const defaultAdminAccountId = String(
      envValue('ADMIN_ACCOUNT_ID') || '0.0.7106098',
    );
    const adminAccountId = String(
      input.adminAccountId || defaultAdminAccountId,
    );
    const nominalValue = String(input.nominalValue || '1');
    const currency = String(input.currency || 'USD');
    const currencyHex = normalizeCurrencyHex(input.currencyHex || currency);
    const requestPayload = {
      name: String(input.name || `ChargeFrog-${stationName}-Bond`),
      symbol: normalizeTokenSymbol(input.symbol, `CF${stationId}BD`),
      isin: isinNumber,
      decimals: Number(input.decimals ?? 6),
      currency,
      currencyHex,
      numberOfUnits: totalBonds,
      nominalValue,
      startingDate,
      maturityDate,
      adminAccountId,
      diamondOwnerAccount: String(input.diamondOwnerAccount || adminAccountId),
      isWhiteList: Boolean(input.isWhiteList ?? false),
      isControllable: Boolean(input.isControllable ?? true),
      arePartitionsProtected: Boolean(input.arePartitionsProtected ?? false),
      isMultiPartition: Boolean(input.isMultiPartition ?? false),
      clearingActive: Boolean(input.clearingActive ?? false),
      internalKycActivated: Boolean(input.internalKycActivated ?? false),
      regulationType: Number(input.regulationType ?? 1),
      regulationSubType: Number(input.regulationSubType ?? 0),
      isCountryControlListWhiteList: Boolean(
        input.isCountryControlListWhiteList ?? true,
      ),
      countries: String(input.countries ?? 'US'),
      erc20VotesActivated: Boolean(input.erc20VotesActivated ?? false),

      info: String(
        input.info ||
          `ChargeFrog-${stationName} bond token for The ChargeFrog project - ${networkLabel}`,
      ),
      configId: String(
        input.configId ||
          '0x0000000000000000000000000000000000000000000000000000000000000002',
      ),
      configVersion: Number(input.configVersion ?? 1),
      maxSupply: String(cap || totalBonds),
      metadata: input.metadata,
    };

    const response = await createBond(requestPayload);

    const tokenAddress =
      extractSecurityIdCandidate(response?.security?.diamondAddress) ||
      extractSecurityIdCandidate(response?.security?.evmDiamondAddress) ||
      extractSecurityIdCandidate(response?.security) ||
      null;
    const txHash = extractFirstTransactionId(response);

    await appendAuditLog({
      correlationId: input.correlationId || null,
      action: 'createBondToken',
      status: tokenAddress ? 'ok' : 'error',
      stationId,
      txHash,
      details: {
        stationId,
        tokenAddress,
        isin_number: isinNumber,
        totalBonds,
        symbol: requestPayload.symbol,
        name: requestPayload.name,
      },
    });

    return {
      tokenAddress,
      txHash,
      isin: isinNumber,
      isin_number: isinNumber,
      name: requestPayload.name,
      symbol: requestPayload.symbol,
      totalBonds,
      cap: cap ?? totalBonds,
      pricePerBond,
      requestPayload,
    };
  },

  // Handles mintEquity.
  async mintEquity(input = {}) {
    const stationId = toPositiveInt(input.stationId, undefined, 'stationId');
    const amount = String(input.amount || '');
    if (!amount) {
      throw new Error('amount is required');
    }

    const target = resolveHederaTargetAccountId(input.buyerWallet);
    const securityResolution = await resolveSecurityIdForAssetOperation({
      stationId,
      assetType: 'equity',
      explicitSecurityId: input.tokenAddress || input.securityId,
    });
    const securityId = securityResolution.securityId;

    const response = await mint({
      securityId,
      targetId: target.targetId,
      amount,
    });

    await appendAuditLog({
      correlationId: input.correlationId || null,
      action: 'mintEquity',
      status: 'ok',
      stationId,
      txHash: response.transactionId || null,
      details: {
        securityId,
        amount,
        buyerWallet: input.buyerWallet,
        targetId: target.targetId,
        targetSource: target.targetSource,
        securityIdSource: securityResolution.source,
      },
    });

    return {
      txHash: response.transactionId || null,
      securityId,
      amount,
      buyerWallet: input.buyerWallet,
      targetId: target.targetId,
      targetSource: target.targetSource,
      securityIdSource: securityResolution.source,
    };
  },

  // Handles mintBond.
  async mintBond(input = {}) {
    const stationId = toPositiveInt(input.stationId, undefined, 'stationId');
    const amount = String(input.amount || '');
    if (!amount) {
      throw new Error('amount is required');
    }

    const target = resolveHederaTargetAccountId(input.buyerWallet);
    const securityResolution = await resolveSecurityIdForAssetOperation({
      stationId,
      assetType: 'bond',
      explicitSecurityId: input.tokenAddress || input.securityId,
    });
    const securityId = securityResolution.securityId;

    const response = await mint({
      securityId,
      targetId: target.targetId,
      amount,
    });

    await appendAuditLog({
      correlationId: input.correlationId || null,
      action: 'mintBond',
      status: 'ok',
      stationId,
      txHash: response.transactionId || null,
      details: {
        securityId,
        amount,
        buyerWallet: input.buyerWallet,
        targetId: target.targetId,
        targetSource: target.targetSource,
        securityIdSource: securityResolution.source,
      },
    });

    return {
      txHash: response.transactionId || null,
      securityId,
      amount,
      buyerWallet: input.buyerWallet,
      targetId: target.targetId,
      targetSource: target.targetSource,
      securityIdSource: securityResolution.source,
    };
  },

  // Handles issueEquity.
  async issueEquity(input = {}) {
    const stationId = toPositiveInt(input.stationId, undefined, 'stationId');
    const amount = String(input.amount || '');
    if (!amount) {
      throw new Error('amount is required');
    }

    const target = resolveHederaTargetAccountId(input.buyerWallet);
    const securityResolution = await resolveSecurityIdForAssetOperation({
      stationId,
      assetType: 'equity',
      explicitSecurityId: input.tokenAddress || input.securityId,
    });
    const securityId = securityResolution.securityId;

    const response = await issue({
      securityId,
      targetId: target.targetId,
      amount,
    });

    await appendAuditLog({
      correlationId: input.correlationId || null,
      action: 'issueEquity',
      status: 'ok',
      stationId,
      txHash: response.transactionId || null,
      details: {
        securityId,
        amount,
        buyerWallet: input.buyerWallet,
        targetId: target.targetId,
        targetSource: target.targetSource,
        securityIdSource: securityResolution.source,
      },
    });

    return {
      txHash: response.transactionId || null,
      securityId,
      amount,
      buyerWallet: input.buyerWallet,
      targetId: target.targetId,
      targetSource: target.targetSource,
      securityIdSource: securityResolution.source,
    };
  },

  // Handles issueBond.
  async issueBond(input = {}) {
    const stationId = toPositiveInt(input.stationId, undefined, 'stationId');
    const amount = String(input.amount || '');
    if (!amount) {
      throw new Error('amount is required');
    }

    const target = resolveHederaTargetAccountId(input.buyerWallet);
    const securityResolution = await resolveSecurityIdForAssetOperation({
      stationId,
      assetType: 'bond',
      explicitSecurityId: input.tokenAddress || input.securityId,
    });
    const securityId = securityResolution.securityId;

    const response = await issue({
      securityId,
      targetId: target.targetId,
      amount,
    });

    await appendAuditLog({
      correlationId: input.correlationId || null,
      action: 'issueBond',
      status: 'ok',
      stationId,
      txHash: response.transactionId || null,
      details: {
        securityId,
        amount,
        buyerWallet: input.buyerWallet,
        targetId: target.targetId,
        targetSource: target.targetSource,
        securityIdSource: securityResolution.source,
      },
    });

    return {
      txHash: response.transactionId || null,
      securityId,
      amount,
      buyerWallet: input.buyerWallet,
      targetId: target.targetId,
      targetSource: target.targetSource,
      securityIdSource: securityResolution.source,
    };
  },

  // Handles getTokenBalance.
  async getTokenBalance(input = {}) {
    const stationId = toPositiveInt(input.stationId, undefined, 'stationId');
    const rawAssetType = String(input.assetType || '')
      .trim()
      .toLowerCase();
    if (rawAssetType !== 'equity' && rawAssetType !== 'bond') {
      throw new Error('assetType must be either "equity" or "bond"');
    }

    const target = resolveHederaTargetAccountId(
      input.walletAddress || input.buyerWallet || input.targetId,
    );
    const securityResolution = await resolveSecurityIdForAssetOperation({
      stationId,
      assetType: rawAssetType,
      explicitSecurityId: input.tokenAddress || input.securityId,
    });

    const response = await getBalance({
      securityId: securityResolution.securityId,
      targetId: target.targetId,
    });
    const normalizedBalance = normalizeBalanceValue(response.balance);

    await appendAuditLog({
      correlationId: input.correlationId || null,
      action: 'getTokenBalance',
      status: 'ok',
      stationId,
      txHash: null,
      details: {
        stationId,
        assetType: rawAssetType,
        securityId: securityResolution.securityId,
        securityIdSource: securityResolution.source,
        walletAddress: input.walletAddress || input.buyerWallet || null,
        targetId: target.targetId,
        targetSource: target.targetSource,
      },
    });

    return {
      stationId,
      assetType: rawAssetType,
      securityId: securityResolution.securityId,
      securityIdSource: securityResolution.source,
      walletAddress: input.walletAddress || input.buyerWallet || null,
      targetId: target.targetId,
      targetSource: target.targetSource,
      balance: normalizedBalance,
      balanceRaw: response.balance ?? null,
    };
  },

  // Handles listStationsAvailable.
  async listStationsAvailable() {
    return withRetry(() => listAvailableStations(), {
      retries: 1,
      baseDelayMs: 250,
    });
  },

  // Handles listAllStations.
  async listAllStations() {
    return withRetry(() => listAllStationsRecord(), {
      retries: 1,
      baseDelayMs: 250,
    });
  },

  // Handles listStationsByStage.
  async listStationsByStage(input = {}) {
    const stage = String(input.stage || '').trim();
    if (!stage) {
      throw new Error('stage is required');
    }
    return withRetry(() => listStationsByStageRecord(stage), {
      retries: 1,
      baseDelayMs: 250,
    });
  },

  // Handles findStationByLocation.
  async findStationByLocation(input = {}) {
    const location = normalizeLocation(input.location || input);
    const radiusMeters = toPositiveInt(
      input.radiusMeters,
      toPositiveInt(
        process.env.STATION_DUPLICATE_RADIUS_METERS,
        1000,
        'radiusMeters',
      ),
      'radiusMeters',
    );
    return withRetry(
      () =>
        findStationByLocationRecord({
          location,
          radiusMeters,
        }),
      { retries: 1, baseDelayMs: 250 },
    );
  },

  // Handles getStation.
  async getStation(input = {}) {
    return withRetry(() => getStationById(input.stationId), {
      retries: 1,
      baseDelayMs: 250,
    });
  },

  // Handles getStationByProposalId.
  async getStationByProposalId(input = {}) {
    return withRetry(() => getStationByProposalIdRecord(input.proposalId), {
      retries: 1,
      baseDelayMs: 250,
    });
  },

  // Handles saveStationDeployment.
  async saveStationDeployment(input = {}) {
    const stationId = toPositiveInt(input.stationId, undefined, 'stationId');
    return withRetry(
      () =>
        saveStationDeploymentRecord({
          proposalId: input.proposalId,
          stationId,
          metadataUri: input.metadataUri,
          deployment: input.deployment,
        }),
      { retries: 1, baseDelayMs: 250 },
    );
  },

  // Handles saveIssuedAssets.
  async saveIssuedAssets(input = {}) {
    const stationId = toPositiveInt(input.stationId, undefined, 'stationId');
    return withRetry(
      () =>
        saveIssuedAssets({
          proposalId: input.proposalId,
          stationId,
          cap: input.cap,
          shares: input.shares,
          pricing: parsePricing(input.pricing),
          metadataUri: input.metadataUri,
          equity: input.equity,
          bond: input.bond,
          metadata: input.metadata,
        }),
      { retries: 1, baseDelayMs: 250 },
    );
  },
};

module.exports = {
  agentTools,
  withRetry,
};
