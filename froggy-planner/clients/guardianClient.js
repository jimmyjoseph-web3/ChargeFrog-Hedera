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

