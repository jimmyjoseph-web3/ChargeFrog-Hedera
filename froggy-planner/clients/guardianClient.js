const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const {
  AccountId,
  Client,
  PrivateKey,
  TokenAssociateTransaction,
  TokenId,
} = require('@hashgraph/sdk');
const { normalizePrivateKey } = require('./privateKeyEthereumProvider');

const DEFAULT_TESTNET_MIRROR_BASE =
  'https://testnet.mirrornode.hedera.com/api/v1';
const TESTNET_NETWORK = 'testnet';

function loadEnvFiles() {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../.env'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate, override: false });
    }
  }
}

loadEnvFiles();

function envValue(...keys) {
  for (const key of keys) {
    const raw = process.env[key];
    if (raw !== undefined && String(raw).trim() !== '') {
      return String(raw).trim();
    }
  }
  return undefined;
}

function toObject(value, fallback = {}) {
  return value && typeof value === 'object' ? value : fallback;
}

function derivePayloadFromInput(input, excludedKeys = []) {
  const source = toObject(input, {});
  const exclusions = new Set(excludedKeys);
  const payload = {};
  for (const [key, value] of Object.entries(source)) {
    if (exclusions.has(key)) continue;
    payload[key] = value;
  }
  return payload;
}

function generateUuid() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return [
    crypto.randomBytes(4).toString('hex'),
    crypto.randomBytes(2).toString('hex'),
    crypto.randomBytes(2).toString('hex'),
    crypto.randomBytes(2).toString('hex'),
    crypto.randomBytes(6).toString('hex'),
  ].join('-');
}

function normalizeBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/\/+$/, '');
}

function parseJsonSafe(value) {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}


function truncateText(value, maxLength = 600) {
  const text = String(value || '');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function toPositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.trunc(parsed);
}

function ensureJsonSchemaDocument(
  input = {},
  schemaUuid,
  schemaName,
  schemaDescription,
) {
  const source = toObject(input, {});
  const hasExplicitDocument =
    source.document && typeof source.document === 'object';
  if (hasExplicitDocument) {
    const doc = { ...source.document };
    if (!doc.$id) doc.$id = `#${schemaUuid}`;
    if (!doc.$comment) {
      doc.$comment = `{ "@id": "schema:${schemaUuid}#${schemaUuid}", "term": "${schemaUuid}" }`;
    }
    return doc;
  }

  return {
    $comment: `{ "@id": "schema:${schemaUuid}#${schemaUuid}", "term": "${schemaUuid}" }`,
    $defs: toObject(source.$defs, {}),
    $id: `#${schemaUuid}`,
    additionalProperties:
      source.additionalProperties === undefined
        ? false
        : Boolean(source.additionalProperties),
    description: String(source.description || schemaDescription || ''),
    properties: toObject(source.properties, {}),
    required: Array.isArray(source.required)
      ? source.required
      : ['@context', 'type', 'policyId'],
    title: String(source.title || schemaName || 'schema'),
    type: String(source.type || 'object'),
  };
}

function normalizeSchemaPushPayload(input = {}) {
  const source = toObject(input, {});
  const schemaUuid = String(source.uuid || generateUuid()).trim();
  const schemaName = String(source.name || 'schema').trim();
  const schemaDescription = String(source.description || '').trim();
  const document = ensureJsonSchemaDocument(
    source,
    schemaUuid,
    schemaName,
    schemaDescription,
  );

  return {
    uuid: schemaUuid,
    hash: String(source.hash || ''),
    name: schemaName,
    description: schemaDescription,
    entity: String(source.entity || 'VC'),
    status: String(source.status || 'DRAFT'),
    category: String(source.category || 'POLICY'),
    readonly: source.readonly === undefined ? false : Boolean(source.readonly),
    contextURL: String(source.contextURL || `schema:${schemaUuid}`),
    documentURL: String(source.documentURL || ''),
    iri: String(source.iri || ''),
    messageId: String(source.messageId || ''),
    owner: String(source.owner || ''),
    creator: String(source.creator || ''),
    codeVersion: String(source.codeVersion || ''),
    sourceVersion: String(source.sourceVersion || ''),
    version: String(source.version || ''),
    userDID: source.userDID === undefined ? null : source.userDID,
    active: source.active === undefined ? false : Boolean(source.active),
    system: source.system === undefined ? false : Boolean(source.system),
    errors: Array.isArray(source.errors) ? source.errors : [],
    fields: Array.isArray(source.fields) ? source.fields : [],
    conditions: Array.isArray(source.conditions) ? source.conditions : [],
    context: source.context === undefined ? null : source.context,
    document,
  };
}

function getGuardianBaseUrl() {
  const baseUrl = normalizeBaseUrl(envValue('URL'));
  if (!baseUrl) {
    throw new Error('Missing URL in .env');
  }
  return baseUrl;
}

async function postGuardianJson(pathname, body, headers = {}) {
  const url = `${getGuardianBaseUrl()}${pathname}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...headers,
    },
    body: JSON.stringify(toObject(body, {})),
  });

  const responseText = await response.text();
  const responseJson = parseJsonSafe(responseText);
  if (!response.ok) {
    throw new Error(
      `Guardian request failed (${response.status}) ${pathname}: ${truncateText(responseText || response.statusText)}`,
    );
  }
  return responseJson !== null ? responseJson : { raw: responseText };
}

async function getGuardianJson(pathname, headers = {}) {
  const url = `${getGuardianBaseUrl()}${pathname}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...headers,
    },
  });

  const responseText = await response.text();
  const responseJson = parseJsonSafe(responseText);
  if (!response.ok) {
    throw new Error(
      `Guardian request failed (${response.status}) ${pathname}: ${truncateText(responseText || response.statusText)}`,
    );
  }
  return responseJson !== null ? responseJson : { raw: responseText };
}

async function loginGuardianByRole(role = 'admin') {
  const lowerRole = String(role || 'admin')
    .trim()
    .toLowerCase();
  const isTreasury = lowerRole === 'treasury';

  const username = envValue(
    isTreasury ? 'TREASURY_USERNAME' : 'ADMIN_USERNAME',
  );
  const password = envValue(
    isTreasury ? 'TREASURY_PASSWORD' : 'ADMIN_PASSWORD',
  );
  if (!username || !password) {
    throw new Error(
      `Missing ${isTreasury ? 'TREASURY' : 'ADMIN'}_USERNAME or ${isTreasury ? 'TREASURY' : 'ADMIN'}_PASSWORD in .env`,
    );
  }

  const loginPayload = await postGuardianJson('/accounts/login', {
    username,
    password,
  });

  const refreshToken = loginPayload?.refreshToken;
  if (!refreshToken) {
    throw new Error('Guardian login succeeded but refreshToken was missing');
  }
  return refreshToken;
}

async function exchangeAccessToken(refreshToken) {
  const payload = await postGuardianJson('/accounts/access-token', {
    refreshToken: String(refreshToken || ''),
  });
  const accessToken = payload?.accessToken;
  if (!accessToken) {
    throw new Error(
      'Guardian access-token response did not include accessToken',
    );
  }
  return accessToken;
}

async function postGuardianWithAccessToken(pathname, payload, accessToken) {
  const token = String(accessToken || '').trim();
  if (!token) {
    throw new Error('Guardian accessToken is required');
  }

  return postGuardianJson(pathname, payload, {
    Authorization: `Bearer ${token}`,
    Accept: '*/*',
  });
}

async function getGuardianWithAccessToken(pathname, accessToken) {
  const token = String(accessToken || '').trim();
  if (!token) {
    throw new Error('Guardian accessToken is required');
  }

  return getGuardianJson(pathname, {
    Authorization: `Bearer ${token}`,
    Accept: '*/*',
  });
}

async function putGuardianWithAccessToken(pathname, payload, accessToken) {
  const token = String(accessToken || '').trim();
  if (!token) {
    throw new Error('Guardian accessToken is required');
  }

  return putGuardianJson(pathname, payload, {
    Authorization: `Bearer ${token}`,
    Accept: '*/*',
  });
}

async function postGuardianPolicyBlock(input = {}) {
  const accessToken = String(input.accessToken || '').trim();
  const policyId = String(input.policyId || '').trim();
  const blockUUID = String(input.blockUUID || '').trim();
  const payload = toObject(input.payload, {});

  if (!accessToken) throw new Error('Guardian accessToken is required');
  if (!policyId) throw new Error('Guardian policyId is required');
  if (!blockUUID) throw new Error('Guardian blockUUID is required');

  return postGuardianJson(
    `/policies/${encodeURIComponent(policyId)}/blocks/${encodeURIComponent(blockUUID)}`,
    payload,
    {
      Authorization: `Bearer ${accessToken}`,
      Accept: '*/*',
    },
  );
}