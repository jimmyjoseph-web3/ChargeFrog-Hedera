const { guardianTools } = require('./tools');

const DEFAULT_CARBON_TEMPLATE_POLICY_ID = '6917fef5e88fa758ecc72e1b';
const DEFAULT_WIPE_TEMPLATE_POLICY_ID = '69186a11e88fa758ecc73127';
const DEFAULT_GUARDIAN_TOKEN_ID = '0.0.7264176';
const DEFAULT_POLICY_VERSION = '1.0.0';

const DEFAULT_POLICY_CATEGORIES = [
  '6917d97da17a3035b283a89e',
  '6917d97da17a3035b283a887',
  '6917d97da17a3035b283a889',
  '6917d97da17a3035b283a896',
  '6917d97da17a3035b283a89a',
];

const IDENTIFIER_KEYS_TO_REMOVE = new Set([
  'policyId',
  '_id',
  'uuid',
  'createDate',
  'updateDate',
  'hash',
  'hashMap',
  'hashMapFileId',
  'messageId',
  'configFileId',
  'instanceTopicId',
  'synchronizationTopicId',
  'commentsTopicId',
]);

const SCHEMA_REFERENCE_KEYS = new Set(['schema', 'presetSchema']);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepClone(value) {
  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item));
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = deepClone(item);
  }
  return out;
}

function unwrapResult(value) {
  if (isPlainObject(value) && isPlainObject(value.result)) {
    return value.result;
  }
  return value;
}

function firstNonEmpty(values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return null;
}

function extractPolicyId(policy) {
  if (!isPlainObject(policy)) return null;
  return firstNonEmpty([policy.policyId, policy.id, policy.uuid, policy._id]);
}

function extractPolicyStatus(policy) {
  if (!isPlainObject(policy)) return '';
  return String(policy.status || '')
    .trim()
    .toUpperCase();
}

function extractPolicyName(policy) {
  if (!isPlainObject(policy)) return '';
  return String(policy.name || '').trim();
}

function extractPolicyTopicId(policy) {
  if (!isPlainObject(policy)) return null;
  return firstNonEmpty([
    policy.topicId,
    policy.topicID,
    policy.topic_id,
    policy.instanceTopicId,
    policy.synchronizationTopicId,
  ]);
}

function extractPolicyConfig(policy) {
  if (!isPlainObject(policy)) return null;
  if (isPlainObject(policy.config)) return deepClone(policy.config);
  if (isPlainObject(policy.policy) && isPlainObject(policy.policy.config)) {
    return deepClone(policy.policy.config);
  }
  return null;
}

function normalizePolicyListResponse(response) {
  const payload = unwrapResult(response);
  if (Array.isArray(payload)) return payload;
  if (isPlainObject(payload) && Array.isArray(payload.policies))
    return payload.policies;
  if (isPlainObject(payload) && Array.isArray(payload.data))
    return payload.data;
  return [];
}

function normalizeSchemaListResponse(response) {
  const payload = unwrapResult(response);
  if (Array.isArray(payload)) return payload;
  if (isPlainObject(payload) && Array.isArray(payload.schemas))
    return payload.schemas;
  if (isPlainObject(payload) && Array.isArray(payload.data))
    return payload.data;
  return [];
}

function buildPolicyTag() {
  const randomizedTimestamp =
    Date.now() + Math.floor(Math.random() * 1_000_000);
  return `Tag_${randomizedTimestamp}`;
}

function sanitizePolicyConfig(value, state, path = []) {
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      sanitizePolicyConfig(item, state, path.concat(index)),
    );
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (IDENTIFIER_KEYS_TO_REMOVE.has(key)) {
      continue;
    }
    if (SCHEMA_REFERENCE_KEYS.has(key)) {
      state.schemaReferencePaths.push(path.concat(key));
      continue;
    }
    if (key === 'tokenId') {
      const tokenId = DEFAULT_GUARDIAN_TOKEN_ID;
      state.tokenIds.add(tokenId);
      output[key] = tokenId;
      continue;
    }
    output[key] = sanitizePolicyConfig(item, state, path.concat(key));
  }
  return output;
}