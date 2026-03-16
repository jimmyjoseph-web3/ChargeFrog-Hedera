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

