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

function extractPolicyId(policy) {
  if (!isPlainObject(policy)) return null;
  return firstNonEmpty([policy.policyId, policy.id, policy.uuid, policy._id]);
}

function extractPolicyTopicId(policy) {
  if (!isPlainObject(policy)) return null;
  return findFirstStringByKeys(policy, [
    'topicId',
    'topicID',
    'topic_id',
    'instanceTopicId',
    'synchronizationTopicId',
  ]);
}

function extractPolicyConfig(policy) {
  if (!isPlainObject(policy)) return null;
  if (isPlainObject(policy.config)) return policy.config;
  if (isPlainObject(policy.policy) && isPlainObject(policy.policy.config)) {
    return policy.policy.config;
  }
  return null;
}

function normalizeStationName(value) {
  return String(value || '')
    .replace(/^ChargeFrog Station\s*-\s*/i, '')
    .replace(/^ChargeFrog\s*-\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildStationRegex(stationName) {
  const normalized = normalizeStationName(stationName);
  if (!normalized) return null;
  const pattern = escapeRegex(normalized).replace(/\s+/g, '\\s+');
  return new RegExp(pattern, 'i');
}

function extractStationNameHeuristic(message) {
  const raw = String(message || '').trim();
  if (!raw) return null;

  const quoted = raw.match(/["“](.+?)["”]/);
  if (quoted && quoted[1]) {
    return normalizeStationName(quoted[1]);
  }

  const chargeFrogMatch = raw.match(
    /ChargeFrog(?:\s+Station)?\s*-\s*([A-Za-z0-9 .,'&()/-]+)/i,
  );
  if (chargeFrogMatch && chargeFrogMatch[1]) {
    return normalizeStationName(chargeFrogMatch[1]);
  }

  const stationMatch = raw.match(/\bstation\s+([A-Za-z0-9 .,'&()/-]{3,})$/i);
  if (stationMatch && stationMatch[1]) {
    return normalizeStationName(stationMatch[1]);
  }

  const trailingMatch = raw.match(
    /\b(?:for|of|about)\s+([A-Za-z0-9 .,'&()/-]{3,})$/i,
  );
  if (trailingMatch && trailingMatch[1]) {
    return normalizeStationName(trailingMatch[1]);
  }

  return null;
}

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

function getOpenAIConfigIfAvailable() {
  const apiKey = firstNonEmpty([
    process.env.OPENAI_KEY,
    process.env.OPENAI_API_KEY,
  ]);
  if (!apiKey) return null;

  return {
    apiKey,
    model: firstNonEmpty([
      process.env.GUARDIAN_AGENT_MODEL,
      process.env.AGENT_MODEL,
      'gpt-5.2',
    ]),
    baseUrl: String(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1')
      .trim()
      .replace(/\/$/, ''),
  };
}

function normalizeReasoningEffort(value, fallback = 'medium') {
  const raw = String(value || fallback || '')
    .trim()
    .toLowerCase();
  if (raw === 'high' || raw === 'medium' || raw === 'low') {
    return raw;
  }
  return fallback;
}

async function createOpenAiChatCompletion({
  model,
  messages,
  reasoningEffort,
}) {
  const config = getOpenAIConfigIfAvailable();
  if (!config) {
    return null;
  }

  const payload = {
    model: String(model || config.model).trim(),
    messages: Array.isArray(messages) ? messages : [],
    reasoning_effort: normalizeReasoningEffort(reasoningEffort, 'medium'),
  };

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${body}`);
  }

  return response.json();
}

function readCompletionText(completion) {
  const choice = completion?.choices?.[0];
  const content = choice?.message?.content;
  if (Array.isArray(content)) {
    return content
      .map((item) =>
        isPlainObject(item) ? item.text || '' : String(item || ''),
      )
      .join('')
      .trim();
  }
  return String(content || '').trim();
}

async function classifyGuardianIntent(message) {
  const trimmedMessage = String(message || '').trim();
  const fallbackStationName = extractStationNameHeuristic(trimmedMessage);

  const config = getOpenAIConfigIfAvailable();
  if (!config) {
    return {
      intent:
        /\bpolicy\b|\bpublish\b|\btag\b|\bstatus\b|\btrack\b|\bwhat\s+does\b/i.test(
          trimmedMessage,
        )
          ? INTENTS.POLICY_ENQUIRY
          : INTENTS.GENERAL,
      stationName: fallbackStationName,
      reason: 'heuristic_fallback',
      source: 'heuristic',
    };
  }

  const prompt = GUARDIAN_INTENT_CLASSIFIER_PROMPT;

  try {
    const completion = await createOpenAiChatCompletion({
      model: config.model,
      reasoningEffort: process.env.GUARDIAN_AGENT_REASONING_EFFORT || 'medium',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: trimmedMessage },
      ],
    });
    const parsed = extractJsonObject(readCompletionText(completion));
    if (parsed && typeof parsed === 'object') {
      const intent = firstNonEmpty([parsed.intent]) || INTENTS.GENERAL;
      const stationName = normalizeStationName(parsed.stationName);
      return {
        intent: Object.values(INTENTS).includes(intent)
          ? intent
          : INTENTS.GENERAL,
        stationName: stationName || fallbackStationName,
        reason: String(parsed.reason || 'llm_classification'),
        source: 'llm',
      };
    }
  } catch (_error) {
    // Fall back below.
  }

  return {
    intent:
      /\bpolicy\b|\bpublish\b|\btag\b|\bstatus\b|\btrack\b|\bwhat\s+does\b/i.test(
        trimmedMessage,
      )
        ? INTENTS.POLICY_ENQUIRY
        : INTENTS.GENERAL,
    stationName: fallbackStationName,
    reason: 'heuristic_after_llm_fallback',
    source: 'heuristic',
  };
}

function scorePolicyMatch(policy, regex) {
  const name = String(policy?.name || '');
  const description = String(policy?.description || '');
  let score = 0;
  if (regex.test(name)) score += 10;
  if (regex.test(description)) score += 3;
  return score;
}

function matchPoliciesByStationName(policies, stationName) {
  const regex = buildStationRegex(stationName);
  if (!regex) return [];

  return policies
    .map((policy) => ({
      policy,
      score: scorePolicyMatch(policy, regex),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.policy);
}

function summarizePolicyRecord(policy) {
  const config = extractPolicyConfig(policy);
  const searchable = JSON.stringify(config || policy || {});
  const blocks = Array.from(
    new Set(
      String(searchable).match(
        /\b(interfaceContainerBlock|requestVcDocumentBlock|retirementDocumentBlock|wipeTokenBlock|tokenActionBlock|mintBlock)\b/g,
      ) || [],
    ),
  );

  const tracks = Array.from(
    new Set(
      String(searchable).match(
        /\b(station_id|hedera_id|charging_tx_hash|carbon_offset_grams|timestamp|range)\b/g,
      ) || [],
    ),
  );

  return {
    policyId: extractPolicyId(policy),
    name: firstNonEmpty([policy?.name]),
    description: firstNonEmpty([policy?.description]),
    status: firstNonEmpty([policy?.status]),
    topicId: extractPolicyTopicId(policy),
    policyTag: firstNonEmpty([policy?.policyTag]),
    version: firstNonEmpty([policy?.version]),
    owner: firstNonEmpty([policy?.owner, policy?.creator]),
    categories: Array.isArray(policy?.categories)
      ? policy.categories.length
      : 0,
    topicDescription: firstNonEmpty([policy?.topicDescription]),
    applicabilityConditions: firstNonEmpty([policy?.applicabilityConditions]),
    tokenId: findFirstStringByKeys(policy, ['tokenId']),
    blockTypes: blocks,
    trackedFields: tracks,
    hasPresetSchema: Boolean(
      policy?.presetSchema || findFirstStringByKeys(config, ['presetSchema']),
    ),
    hasSchema: Boolean(
      policy?.schema || findFirstStringByKeys(config, ['schema']),
    ),
  };
}

async function loadDetailedPolicies(policies) {
  const detailed = [];
  for (const policy of Array.isArray(policies) ? policies : []) {
    const policyId = extractPolicyId(policy);
    if (!policyId) {
      detailed.push(policy);
      continue;
    }
    try {
      const response = await guardianTools.getPolicyById({ policyId });
      const fullPolicy = unwrapResult(response);
      detailed.push(isPlainObject(fullPolicy) ? fullPolicy : policy);
    } catch (_error) {
      detailed.push(policy);
    }
  }
  return detailed;
}

function buildDeterministicPolicyReply(stationName, policySummaries) {
  const lines = [
    `I found ${policySummaries.length} Guardian polic${policySummaries.length === 1 ? 'y' : 'ies'} for ${stationName}.`,
  ];

  for (const policy of policySummaries) {
    const purpose = /wipe/i.test(String(policy.name || ''))
      ? 'It governs station-specific wipe or retirement-style token operations.'
      : /carbon|offset/i.test(String(policy.name || ''))
        ? 'It governs station-specific carbon offset verification and reporting.'
        : 'It governs a station-specific Guardian workflow.';
    const abilities = policy.blockTypes.length
      ? ` Its configured flow uses ${policy.blockTypes.join(', ')}.`
      : '';
    const tracking = policy.trackedFields.length
      ? ` It tracks ${policy.trackedFields.join(', ')}.`
      : '';
    const bindings = `${
      policy.topicId ? ` It is linked to topic ${policy.topicId}.` : ''
    }${policy.tokenId ? ` It references token ${policy.tokenId}.` : ''}`;
    lines.push(
      `${policy.name || 'Unnamed policy'} is currently ${policy.status || 'unknown'}. It applies to ${stationName}. ${purpose}${abilities}${tracking}${bindings}`,
    );
  }

  return lines.join(' ');
}

async function summarizeGuardianReply({ stationName, policySummaries }) {
  const config = getOpenAIConfigIfAvailable();
  if (!config) {
    return buildDeterministicPolicyReply(stationName, policySummaries);
  }

  const prompt = GUARDIAN_POLICY_SUMMARY_PROMPT;

  const payload = {
    stationName,
    policies: policySummaries,
  };

  try {
    const completion = await createOpenAiChatCompletion({
      model: config.model,
      reasoningEffort: process.env.GUARDIAN_AGENT_REASONING_EFFORT || 'medium',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: JSON.stringify(payload) },
      ],
    });
    const parsed = extractJsonObject(readCompletionText(completion));
    if (parsed && typeof parsed.reply === 'string' && parsed.reply.trim()) {
      return parsed.reply.trim();
    }
  } catch (_error) {
    // Fall back below.
  }

  return buildDeterministicPolicyReply(stationName, policySummaries);
}

async function callGuardianWorkerAgent({
  endpointPath,
  payload,
  action,
  correlationId,
}) {
  const result = await callInternalA2aAgent({
    endpointPath,
    data: {
      ...(payload && typeof payload === 'object' ? payload : {}),
      ...(correlationId ? { correlationId } : {}),
    },
    metadata: {
      source: 'guardian_coordinator',
      action,
      ...(correlationId ? { correlationId } : {}),
    },
  });
  return result;
}

async function runGuardianPolicySummarizerAgent(input = {}) {
  const stationName = normalizeStationName(input.stationName);
  if (!stationName) {
    return {
      intent: INTENTS.POLICY_ENQUIRY,
      stationName: null,
      blocked: true,
      summary: renderGuardianReply('chatMissingStationSummary'),
      reply: renderGuardianReply('chatMissingStationReply'),
    };
  }

  const policiesResponse = await guardianTools.listPolicies({});
  const policies = normalizePolicyListResponse(policiesResponse);
  const matchedPolicies = matchPoliciesByStationName(policies, stationName);

  if (matchedPolicies.length === 0) {
    return {
      intent: INTENTS.POLICY_ENQUIRY,
      stationName,
      blocked: true,
      summary: renderGuardianReply('chatNoPoliciesSummary', {
        STATION_NAME: stationName,
      }),
      reply: renderGuardianReply('chatNoPoliciesReply', {
        STATION_NAME: stationName,
      }),
      matchedPolicies: [],
    };
  }

  const detailedPolicies = await loadDetailedPolicies(matchedPolicies);
  const policySummaries = detailedPolicies.map((policy) =>
    summarizePolicyRecord(policy),
  );
  const reply = await summarizeGuardianReply({
    stationName,
    policySummaries,
  });

  return {
    intent: INTENTS.POLICY_ENQUIRY,
    stationName,
    reply,
    policySummaries,
  };
}