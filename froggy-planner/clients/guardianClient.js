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

async function createPolicyWithGuardian(input = {}) {
  const payload =
    input.payload && typeof input.payload === 'object'
      ? input.payload
      : derivePayloadFromInput(input, []);

  const refreshToken = await loginGuardianByRole('admin');
  const accessToken = await exchangeAccessToken(refreshToken);
  const result = await postGuardianWithAccessToken(
    '/policies/push',
    payload,
    accessToken,
  );

  return {
    mode: 'guardian_api',
    action: 'create_policy',
    result,
  };
}

async function getPolicyByIdWithGuardian(input = {}) {
  const policyId = String(input.policyId || '').trim();
  if (!policyId) {
    throw new Error('policyId is required');
  }

  const refreshToken = await loginGuardianByRole('admin');
  const accessToken = await exchangeAccessToken(refreshToken);
  const result = await getGuardianWithAccessToken(
    `/policies/${encodeURIComponent(policyId)}`,
    accessToken,
  );

  return {
    mode: 'guardian_api',
    action: 'get_policy',
    policyId,
    result,
  };
}

async function listPoliciesWithGuardian(input = {}) {
  const pageSize = Math.min(toPositiveInteger(input.pageSize, 100), 200);
  const maxPages = Math.min(toPositiveInteger(input.maxPages, 50), 200);

  const refreshToken = await loginGuardianByRole('admin');
  const accessToken = await exchangeAccessToken(refreshToken);

  const policies = [];
  let fetchedPages = 0;

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const query = new URLSearchParams({
      pageIndex: String(pageIndex),
      pageSize: String(pageSize),
    });
    const pageResult = await getGuardianWithAccessToken(
      `/policies?${query.toString()}`,
      accessToken,
    );

    const pageItems = Array.isArray(pageResult)
      ? pageResult
      : Array.isArray(pageResult?.policies)
        ? pageResult.policies
        : Array.isArray(pageResult?.data)
          ? pageResult.data
          : [];

    fetchedPages += 1;
    if (pageItems.length === 0) {
      break;
    }

    policies.push(...pageItems);
    if (pageItems.length < pageSize) {
      break;
    }
  }

  return {
    mode: 'guardian_api',
    action: 'list_policies',
    count: policies.length,
    pageSize,
    fetchedPages,
    policies,
  };
}

function getSchemaTopicId(schema) {
  const topicKeys = ['topicId', 'topicID', 'topic_id', 'policyTopicId'];

  function findNestedTopicId(value, depth = 6) {
    if (depth < 0 || value === null || value === undefined) return null;

    if (Array.isArray(value)) {
      for (const item of value) {
        const nested = findNestedTopicId(item, depth - 1);
        if (nested) return nested;
      }
      return null;
    }

    if (typeof value !== 'object') return null;

    for (const key of topicKeys) {
      const direct = value[key];
      if (direct === undefined || direct === null) continue;
      const normalized = String(direct).trim();
      if (normalized) return normalized;
    }

    for (const nestedValue of Object.values(value)) {
      const nested = findNestedTopicId(nestedValue, depth - 1);
      if (nested) return nested;
    }

    return null;
  }

  return findNestedTopicId(schema);
}

async function listSchemasByTopicIdWithGuardian(input = {}) {
  const topicId = String(input.topicId || '').trim();
  if (!topicId) {
    throw new Error('topicId is required');
  }

  const pageSize = Math.min(toPositiveInteger(input.pageSize, 100), 200);
  const maxPages = Math.min(toPositiveInteger(input.maxPages, 50), 200);

  const refreshToken = await loginGuardianByRole('admin');
  const accessToken = await exchangeAccessToken(refreshToken);

  const schemas = [];
  let fetchedPages = 0;
  let scanned = 0;

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const query = new URLSearchParams({
      pageIndex: String(pageIndex),
      pageSize: String(pageSize),
    });
    const pageResult = await getGuardianWithAccessToken(
      `/schemas?${query.toString()}`,
      accessToken,
    );

    const pageItems = Array.isArray(pageResult)
      ? pageResult
      : Array.isArray(pageResult?.schemas)
        ? pageResult.schemas
        : Array.isArray(pageResult?.data)
          ? pageResult.data
          : [];

    fetchedPages += 1;
    if (pageItems.length === 0) {
      break;
    }

    scanned += pageItems.length;
    for (const item of pageItems) {
      if (getSchemaTopicId(item) === topicId) {
        schemas.push(item);
      }
    }

    if (pageItems.length < pageSize) {
      break;
    }
  }

  return {
    mode: 'guardian_api',
    action: 'list_schemas_by_topic',
    topicId,
    count: schemas.length,
    scanned,
    pageSize,
    fetchedPages,
    schemas,
  };
}

async function updatePolicyByIdWithGuardian(input = {}) {
  const policyId = String(input.policyId || '').trim();
  if (!policyId) {
    throw new Error('policyId is required');
  }

  const payload =
    input.payload && typeof input.payload === 'object'
      ? input.payload
      : derivePayloadFromInput(input, ['policyId']);
  if (
    !payload ||
    typeof payload !== 'object' ||
    Object.keys(payload).length === 0
  ) {
    throw new Error('Policy update payload is required');
  }

  const refreshToken = await loginGuardianByRole('admin');
  const accessToken = await exchangeAccessToken(refreshToken);
  const result = await putGuardianWithAccessToken(
    `/policies/${encodeURIComponent(policyId)}`,
    payload,
    accessToken,
  );

  return {
    mode: 'guardian_api',
    action: 'update_policy',
    policyId,
    result,
  };
}

async function publishPolicyByIdWithGuardian(input = {}) {
  const policyId = String(input.policyId || '').trim();
  if (!policyId) {
    throw new Error('policyId is required');
  }
  const policyVersion = String(input.policyVersion || '1.0.0').trim();
  if (!policyVersion) {
    throw new Error('policyVersion is required');
  }

  const refreshToken = await loginGuardianByRole('admin');
  const accessToken = await exchangeAccessToken(refreshToken);
  const result = await putGuardianWithAccessToken(
    `/policies/${encodeURIComponent(policyId)}/publish`,
    { policyVersion },
    accessToken,
  );

  return {
    mode: 'guardian_api',
    action: 'publish_policy',
    policyId,
    policyVersion,
    result,
  };
}

async function publishPolicyByIdWithGuardianTreasury(input = {}) {
  const policyId = String(input.policyId || '').trim();
  if (!policyId) {
    throw new Error('policyId is required');
  }
  const policyVersion = String(input.policyVersion || '1.0.0').trim();
  if (!policyVersion) {
    throw new Error('policyVersion is required');
  }

  const refreshToken = await loginGuardianByRole('treasury');
  const accessToken = await exchangeAccessToken(refreshToken);
  const result = await putGuardianWithAccessToken(
    `/policies/${encodeURIComponent(policyId)}/publish`,
    { policyVersion },
    accessToken,
  );

  return {
    mode: 'guardian_api',
    action: 'publish_policy_treasury',
    policyId,
    policyVersion,
    result,
  };
}

async function createSchemaWithGuardian(input = {}) {
  const topicId = String(input.topicId || '').trim();
  if (!topicId) {
    throw new Error('topicId is required');
  }

  const sourcePayload =
    input.payload && typeof input.payload === 'object'
      ? input.payload
      : derivePayloadFromInput(input, ['topicId']);
  if (
    !sourcePayload ||
    typeof sourcePayload !== 'object' ||
    Object.keys(sourcePayload).length === 0
  ) {
    throw new Error('Schema payload is required');
  }

  const payload = normalizeSchemaPushPayload(sourcePayload);
  const refreshToken = await loginGuardianByRole('admin');
  const accessToken = await exchangeAccessToken(refreshToken);
  const result = await postGuardianWithAccessToken(
    `/schemas/push/${encodeURIComponent(topicId)}`,
    payload,
    accessToken,
  );

  return {
    mode: 'guardian_api',
    action: 'create_schema',
    topicId,
    uuid: payload.uuid || null,
    result,
  };
}