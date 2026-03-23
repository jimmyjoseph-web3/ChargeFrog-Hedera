const {
  AGENTS,
} = require('../config/constants');
const {
  INTENT_CLASSIFIER_PROMPT,
  INVESTMENT_PROPOSAL_GENERATOR_PROMPT,
} = require('../config/prompts');
const {
  extractJsonObject,
  normalizeReasoningEffort,
  logStructured,
} = require('./shared');
const {
  parseLocation,
  inferStationSpecificIntent,
  parseIntentRuleBased,
  normalizeWorkflowIntent,
} = require('./parsing');

function getOpenAIConfig() {
  const openAiApiKey = String(process.env.OPENAI_API_KEY || '').trim();
  const apiKey = openAiApiKey;
  if (!apiKey) {
    return null;
  }

  const model = String('gpt-5.2').trim();
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

async function createOpenAiChatCompletion({
  model,
  messages,
  reasoningEffort,
}) {
  const config = getOpenAIConfig();
  if (!config) {
    return null;
  }

  const payload = {
    model: String(model || config.model).trim(),
    messages: Array.isArray(messages) ? messages : [],
  };
  if (reasoningEffort) {
    payload.reasoning_effort = normalizeReasoningEffort(
      reasoningEffort,
      'medium',
    );
  }

  let response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new Error(
      `OpenAI network error: ${error?.cause?.message || error?.message || String(error)}`,
    );
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${body}`);
  }

  return response.json();
}

async function createChatCompletionForIntent(message) {
  const intentModel = String('gpt-5.2').trim();
  return createOpenAiChatCompletion({
    model: intentModel,
    reasoningEffort: process.env.AGENT_INTENT_REASONING_EFFORT || 'medium',
    messages: [
      { role: 'system', content: INTENT_CLASSIFIER_PROMPT },
      { role: 'user', content: String(message || '') },
    ],
  });
}

async function createInvestmentProposalDraftWithLlm({
  finderResult,
  cap,
  shares,
  pricing,
}) {
  const investmentProposalModel = String(
    process.env.AGENT_INVESTMENT_PROPOSAL_MODEL ||
      process.env.AGENT_DAO_MODEL ||
      process.env.AGENT_MODEL ||
      'gpt-5.2',
  ).trim();
  const reasoningEffort = normalizeReasoningEffort(
    process.env.AGENT_INVESTMENT_PROPOSAL_REASONING_EFFORT ||
      process.env.AGENT_DAO_REASONING_EFFORT ||
      'high',
    'high',
  );
  const completion = await createOpenAiChatCompletion({
    model: investmentProposalModel,
    reasoningEffort,
    messages: [
      { role: 'system', content: INVESTMENT_PROPOSAL_GENERATOR_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({
          instruction:
            'Return strict JSON with keys: title, description, rationale, risks, assumptions, nextAction.',
          candidate: {
            area: finderResult?.area || null,
            proposedArea: finderResult?.proposedArea || null,
            anchor: finderResult?.anchor || null,
            neighborhood: finderResult?.neighborhood || null,
            bestStation: finderResult?.bestStation || null,
            rankedStations: finderResult?.rankedStations || null,
            cap,
            shares,
            pricing,
          },
        }),
      },
    ],
  });

  if (!completion) {
    return null;
  }

  const parsed = extractJsonObject(
    completion?.choices?.[0]?.message?.content || '',
  );
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Investment proposal LLM response was not valid JSON');
  }

  return {
    model: completion.model,
    reasoningEffort,
    title:
      typeof parsed.title === 'string' && parsed.title.trim() !== ''
        ? parsed.title.trim()
        : null,
    description:
      typeof parsed.description === 'string' && parsed.description.trim() !== ''
        ? parsed.description.trim()
        : null,
    rationale:
      typeof parsed.rationale === 'string' && parsed.rationale.trim() !== ''
        ? parsed.rationale.trim()
        : null,
    risks: Array.isArray(parsed.risks)
      ? parsed.risks.map((item) => String(item)).slice(0, 8)
      : [],
    assumptions: Array.isArray(parsed.assumptions)
      ? parsed.assumptions.map((item) => String(item)).slice(0, 8)
      : [],
    nextAction:
      typeof parsed.nextAction === 'string' && parsed.nextAction.trim() !== ''
        ? parsed.nextAction.trim()
        : null,
  };
}

async function classifyWorkflowIntent(message, correlationId) {
  const stationSpecificIntent = inferStationSpecificIntent(message);
  const fallbackIntent = stationSpecificIntent || parseIntentRuleBased(message);
  const fallbackArea = stationSpecificIntent
    ? null
    : parseLocation(message) || null;

  const startedAt = Date.now();
  try {
    const completion = await createChatCompletionForIntent(message);
    if (!completion) {
      return {
        intent: fallbackIntent,
        area: fallbackArea,
        reason: 'rule-based (no OpenAI key configured)',
        confidence: 0.4,
        source: 'rule_based',
      };
    }

    const assistant = completion.choices?.[0]?.message;
    const parsed = extractJsonObject(assistant?.content || '');
    let intent = normalizeWorkflowIntent(parsed?.intent || fallbackIntent);
    let area =
      (typeof parsed?.area === 'string' && parsed.area.trim() !== ''
        ? parsed.area.trim()
        : fallbackArea) || null;
    if (stationSpecificIntent) {
      intent = stationSpecificIntent;
      area = null;
    }
    const confidenceRaw = Number(parsed?.confidence);
    const confidence = Number.isFinite(confidenceRaw)
      ? Math.min(Math.max(confidenceRaw, 0), 1)
      : 0.5;

    const output = {
      intent,
      area,
      reason:
        (typeof parsed?.reason === 'string' && parsed.reason.trim() !== ''
          ? parsed.reason.trim()
          : 'llm-classified') || 'llm-classified',
      confidence,
      source: 'llm',
      model: completion.model,
    };

    logStructured({
      correlationId,
      agent: AGENTS.ORCHESTRATOR,
      action: 'classify_intent',
      input: { message },
      outputSummary: output,
      success: true,
      durationMs: Date.now() - startedAt,
    });
    return output;
  } catch (error) {
    const output = {
      intent: fallbackIntent,
      area: fallbackArea,
      reason: `rule-based fallback: ${error instanceof Error ? error.message : String(error)}`,
      confidence: 0.35,
      source: 'rule_based_fallback',
    };
    logStructured({
      correlationId,
      level: 'warn',
      agent: AGENTS.ORCHESTRATOR,
      action: 'classify_intent',
      input: { message },
      outputSummary: output,
      success: true,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    return output;
  }
}

module.exports = {
  createInvestmentProposalDraftWithLlm,
  classifyWorkflowIntent,
};
