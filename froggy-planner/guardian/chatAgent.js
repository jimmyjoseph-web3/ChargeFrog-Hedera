const path = require('path');
const { loadMarkdownPrompt } = require('../lib/promptLoader');
const { callInternalA2aAgent } = require('../http/internalA2a');
const { guardianTools } = require('./tools');
const { renderGuardianReply } = require('./replies');

const GUARDIAN_PROMPTS_DIR = path.resolve(__dirname, 'prompts');
const GUARDIAN_INTENT_CLASSIFIER_PROMPT = loadMarkdownPrompt(
  path.join(GUARDIAN_PROMPTS_DIR, 'intent-classifier.md'),
);
const GUARDIAN_POLICY_SUMMARY_PROMPT = loadMarkdownPrompt(
  path.join(GUARDIAN_PROMPTS_DIR, 'policy-summary.md'),
);
const {
  isGuardianAdminIntent,
  runGuardianAdminWorkflow,
} = require('./adminWorkflow');

const INTENTS = Object.freeze({
  POLICY_ENQUIRY: 'POLICY_ENQUIRY',
  LIST_FULLY_INVESTED_STATIONS: 'LIST_FULLY_INVESTED_STATIONS',
  CREATE_GUARDIAN_POLICIES_FOR_STATION: 'CREATE_GUARDIAN_POLICIES_FOR_STATION',
  GENERAL: 'GENERAL',
});
const GUARDIAN_WORKER_ENDPOINTS = Object.freeze({
  policySummarizer: '/a2a/guardian-policy-summarizer',
  policyCreator: '/a2a/guardian-policy-creator',
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function unwrapResult(value) {
  if (isPlainObject(value) && isPlainObject(value.result)) {
    return value.result;
  }
  return value;
}

function normalizePolicyListResponse(response) {
  const payload = unwrapResult(response);
  if (Array.isArray(payload)) return payload;
  if (isPlainObject(payload) && Array.isArray(payload.policies)) {
    return payload.policies;
  }
  if (isPlainObject(payload) && Array.isArray(payload.data)) {
    return payload.data;
  }
  return [];
}

function firstNonEmpty(values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return null;
}

function findFirstStringByKeys(value, keys, maxDepth = 6) {
  if (maxDepth < 0 || value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = findFirstStringByKeys(item, keys, maxDepth - 1);
      if (nested) return nested;
    }
    return null;
  }

  if (!isPlainObject(value)) {
    return null;
  }

  for (const key of keys) {
    const direct = firstNonEmpty([value[key]]);
    if (direct) return direct;
  }

  for (const nestedValue of Object.values(value)) {
    const nested = findFirstStringByKeys(nestedValue, keys, maxDepth - 1);
    if (nested) return nested;
  }

  return null;
}