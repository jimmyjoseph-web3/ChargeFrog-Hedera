const {
  callPublicA2aAgent,
  shouldUseExternalA2aHttp,
} = require('../http/internalA2a');
const { classifyPublicError } = require('../lib/workflowTrail');
const { parseFoundryIntent } = require('../agent/core/orchestrator');
const { isGuardianAdminIntent } = require('../guardian/adminWorkflow');

const ROUTER_TARGETS = Object.freeze({
  planner: {
    key: 'planner',
    label: 'FroggyPlanner',
    endpointPath: '/a2a/froggy-planner',
  },
  foundry: {
    key: 'foundry',
    label: 'FroggyFoundry',
    endpointPath: '/a2a/froggy-foundry',
  },
  guardian: {
    key: 'guardian',
    label: 'FroggyGuardian',
    endpointPath: '/a2a/froggy-guardian',
  },
});

function looksLikeGuardianPolicyIntent(message) {
  const text = String(message || '').trim().toLowerCase();
  if (!text) return false;

  return (
    /\bguardian\b/.test(text) ||
    /\bpolic(?:y|ies)\b/.test(text) ||
    /\bschemas?\b/.test(text) ||
    /\bfully[-\s]?invested\b/.test(text) ||
    /\bwhat\s+does\b/.test(text)
  );
}

function resolveRouterTarget(message) {
  if (parseFoundryIntent({ message }) !== 'general') {
    return {
      ...ROUTER_TARGETS.foundry,
      reason: 'foundry_intent',
    };
  }

  if (isGuardianAdminIntent(message) || looksLikeGuardianPolicyIntent(message)) {
    return {
      ...ROUTER_TARGETS.guardian,
      reason: 'guardian_intent',
    };
  }

  return {
    ...ROUTER_TARGETS.planner,
    reason: 'planner_default',
  };
}

function normalizeDelegatedResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return {
      reply: String(result || '').trim() || 'No reply was produced.',
    };
  }

  return { ...result };
}

function omitRouterManagedFields(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return {};
  }

  const {
    trail: _ignoredTrail,
    __trailReady: _ignoredTrailReady,
    ...rest
  } = result;
  return rest;
}

function buildTrailEntry({
  stage,
  agentKey,
  agentName,
  endpointPath,
  transport,
  callerAgentKey,
  callerAgentName,
  callerEndpointPath,
  calleeAgentKey,
  calleeAgentName,
  calleeEndpointPath,
  reason,
  message,
  thought,
  status,
  intent,
  success,
  error,
  at,
  durationMs,
}) {
  return {
    stage,
    agentKey,
    agentName,
    endpointPath,
    ...(transport ? { transport } : {}),
    ...(callerAgentKey ? { callerAgentKey } : {}),
    ...(callerAgentName ? { callerAgentName } : {}),
    ...(callerEndpointPath ? { callerEndpointPath } : {}),
    ...(calleeAgentKey ? { calleeAgentKey } : {}),
    ...(calleeAgentName ? { calleeAgentName } : {}),
    ...(calleeEndpointPath ? { calleeEndpointPath } : {}),
    ...(reason ? { reason } : {}),
    ...(message ? { message } : {}),
    ...(thought ? { thought } : {}),
    ...(status ? { status } : {}),
    ...(intent ? { intent } : {}),
    ...(success !== undefined ? { success } : {}),
    ...(error ? { error } : {}),
    ...(at ? { at } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
  };
}

function resolveRouterTransport() {
  return shouldUseExternalA2aHttp({ routeVisibility: 'public' })
    ? 'a2a_http_external'
    : 'a2a_http_internal';
}

async function runRouterAgent(input = {}) {
  const allowedKeys = new Set(['message', 'walletAddress']);
  const extraKeys = Object.keys(input || {}).filter(
    (key) => !allowedKeys.has(key),
  );
  if (extraKeys.length > 0) {
    throw new Error(
      `Unsupported fields for /a2a/froggy-chat: ${extraKeys.join(', ')}. Allowed fields: message, walletAddress`,
    );
  }

  const message = String(input.message || '').trim();
  if (!message) {
    throw new Error('message is required');
  }

  const walletAddress = String(input.walletAddress || '').trim() || undefined;
  const target = resolveRouterTarget(message);
  const callStartedAt = Date.now();
  const transport = resolveRouterTransport();
  const trail = [
    buildTrailEntry({
      stage: 'received',
      agentKey: 'froggychat',
      agentName: 'FroggyChat',
      endpointPath: '/a2a/froggy-chat',
      message,
      thought:
        "I see this request in FroggyChat, and I'm starting the public routing workflow.",
      success: true,
      at: new Date().toISOString(),
    }),
    buildTrailEntry({
      stage: 'routed',
      agentKey: target.key,
      agentName: target.label,
      endpointPath: target.endpointPath,
      reason: target.reason,
      thought: `I see the intent clearly, and I'm routing this request to ${target.label}.`,
      success: true,
      at: new Date().toISOString(),
    }),
  ];

  try {
    trail.push(
      buildTrailEntry({
        stage: 'a2a_call_started',
        transport,
        callerAgentKey: 'froggychat',
        callerAgentName: 'FroggyChat',
        callerEndpointPath: '/a2a/froggy-chat',
        calleeAgentKey: target.key,
        calleeAgentName: target.label,
        calleeEndpointPath: target.endpointPath,
        message,
        thought: `I'm going to call ${target.label} through A2A now.`,
        success: true,
        at: new Date(callStartedAt).toISOString(),
      }),
    );
    const delegated = await callPublicA2aAgent({
      endpointPath: target.endpointPath,
      text: message,
      metadata: {
        source: 'froggychat',
        routedBy: 'froggychat',
        routedAgentKey: target.key,
        routeReason: target.reason,
        ...(walletAddress ? { walletAddress } : {}),
      },
    });
    const normalizedDelegated = normalizeDelegatedResult(delegated);
    const downstreamTrail = Array.isArray(normalizedDelegated.trail)
      ? normalizedDelegated.trail
      : [];
    const normalizedDelegatedPayload =
      omitRouterManagedFields(normalizedDelegated);
    const completedEntry = buildTrailEntry({
      stage: 'a2a_call_completed',
      agentKey: target.key,
      agentName: target.label,
      endpointPath: target.endpointPath,
      transport,
      callerAgentKey: 'froggychat',
      callerAgentName: 'FroggyChat',
      callerEndpointPath: '/a2a/froggy-chat',
      calleeAgentKey: target.key,
      calleeAgentName: target.label,
      calleeEndpointPath: target.endpointPath,
      status: normalizedDelegated.status,
      intent: normalizedDelegated.intent,
      thought: `I now have the downstream result back from ${target.label}, and I'm returning it through FroggyChat.`,
      success: true,
      at: new Date().toISOString(),
      durationMs: Date.now() - callStartedAt,
    });
    const combinedTrail = [...trail, ...downstreamTrail, completedEntry];

    return {
      ...normalizedDelegatedPayload,
      routedAgentKey: target.key,
      routedAgentName: target.label,
      routedAgentEndpoint: target.endpointPath,
      routeReason: target.reason,
      trail: combinedTrail,
    };
  } catch (error) {
    const finishedAt = Date.now();
    const safeError = classifyPublicError(error, 'froggychat');
    trail.push(
      buildTrailEntry({
        stage: 'a2a_call_failed',
        agentKey: target.key,
        agentName: target.label,
        endpointPath: target.endpointPath,
        transport,
        callerAgentKey: 'froggychat',
        callerAgentName: 'FroggyChat',
        callerEndpointPath: '/a2a/froggy-chat',
        calleeAgentKey: target.key,
        calleeAgentName: target.label,
        calleeEndpointPath: target.endpointPath,
        success: false,
        error: safeError.errorCode,
        thought: `I hit a downstream A2A failure while calling ${target.label}.`,
        at: new Date(finishedAt).toISOString(),
        durationMs: finishedAt - callStartedAt,
      }),
    );
    return {
      degraded: true,
      routedAgentKey: target.key,
      routedAgentName: target.label,
      routedAgentEndpoint: target.endpointPath,
      routeReason: target.reason,
      errorCode: safeError.errorCode,
      trail,
      reply: safeError.reply,
    };
  }
}

module.exports = {
  ROUTER_TARGETS,
  resolveRouterTarget,
  runRouterAgent,
};
