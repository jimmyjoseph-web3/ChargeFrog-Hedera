const { randomUUID } = require('crypto');

const INTERNAL_A2A_HEADER = 'x-chargefrog-internal-a2a';
const INTERNAL_A2A_TOKEN = randomUUID();
const DEFAULT_PUBLIC_BASE_URL = 'https://froggyplanner.onrender.com';

function resolveRuntimeEnvironment() {
  const candidates = [
    process.env.NODE_ENV,
    process.env.ENV,
    process.env.APP_ENV,
    process.env.ENVIRONMENT,
  ];

  for (const candidate of candidates) {
    const normalized = String(candidate || '')
      .trim()
      .toLowerCase();
    if (!normalized) continue;
    if (normalized === 'prod') return 'production';
    if (normalized === 'dev') return 'development';
    return normalized;
  }

  return '';
}

function getInternalA2aBaseUrl() {
  const port = Number(process.env.PORT || 8787);
  return `http://localhost:${port}`;
}

function getPublicA2aBaseUrl() {
  return String(
    process.env.FROGGY_PLANNER_PUBLIC_BASE_URL || DEFAULT_PUBLIC_BASE_URL,
  )
    .trim()
    .replace(/\/+$/, '');
}

function shouldUseExternalA2aHttp({
  routeVisibility = 'internal',
  forceExternal = false,
  forceInternal = false,
} = {}) {
  if (forceInternal) return false;
  if (forceExternal) return true;
  return (
    routeVisibility === 'public' &&
    resolveRuntimeEnvironment() === 'production'
  );
}

function isInternalA2aAuthorized(headers = {}) {
  const candidate =
    headers[INTERNAL_A2A_HEADER] ||
    headers[INTERNAL_A2A_HEADER.toLowerCase()] ||
    headers[INTERNAL_A2A_HEADER.toUpperCase()];
  return String(candidate || '').trim() === INTERNAL_A2A_TOKEN;
}

function extractTaskDataArtifact(task) {
  const artifacts = Array.isArray(task?.artifacts) ? task.artifacts : [];
  for (const artifact of artifacts) {
    const parts = Array.isArray(artifact?.parts) ? artifact.parts : [];
    for (const part of parts) {
      if (!part || typeof part !== 'object') continue;
      if (part.kind === 'data' && part.data !== undefined) {
        return part.data;
      }
    }
  }
  return undefined;
}

function extractTaskText(task) {
  const parts = Array.isArray(task?.status?.message?.parts)
    ? task.status.message.parts
    : [];
  return parts
    .map((part) =>
      part && typeof part.text === 'string' ? part.text.trim() : '',
    )
    .filter(Boolean)
    .join('\n')
    .trim();
}

function resolveA2aHttpTarget({
  endpointPath,
  routeVisibility = 'internal',
  forceExternal = false,
  forceInternal = false,
}) {
  const useExternal = shouldUseExternalA2aHttp({
    routeVisibility,
    forceExternal,
    forceInternal,
  });
  const baseUrl = useExternal ? getPublicA2aBaseUrl() : getInternalA2aBaseUrl();
  const headers = {
    'Content-Type': 'application/json',
  };

  if (!useExternal) {
    headers[INTERNAL_A2A_HEADER] = INTERNAL_A2A_TOKEN;
  }

  return {
    url: `${baseUrl}${endpointPath}`,
    headers,
    useExternal,
  };
}

async function callA2aAgent({
  endpointPath,
  data,
  text,
  metadata,
  routeVisibility = 'internal',
  forceExternal = false,
  forceInternal = false,
}) {
  const payload = {
    jsonrpc: '2.0',
    id: randomUUID(),
    method: 'message/send',
    params: {
      message: {
        messageId: randomUUID(),
        role: 'user',
        parts: [
          ...(text ? [{ kind: 'text', text }] : []),
          ...(data === undefined ? [] : [{ kind: 'data', data }]),
        ],
        metadata: metadata && typeof metadata === 'object' ? metadata : {},
      },
    },
  };

  const target = resolveA2aHttpTarget({
    endpointPath,
    routeVisibility,
    forceExternal,
    forceInternal,
  });
  const response = await fetch(target.url, {
    method: 'POST',
    headers: target.headers,
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const requestLabel = target.useExternal
      ? 'Public A2A request failed'
      : 'Internal A2A request failed';
    const errorMessage =
      body && body.error && body.error.message
        ? body.error.message
        : `${requestLabel} (${response.status})`;
    throw new Error(errorMessage);
  }

  if (body && body.error) {
    throw new Error(
      body.error.message ||
        (target.useExternal
          ? 'Public A2A request failed'
          : 'Internal A2A request failed'),
    );
  }

  const task = body?.result;
  const dataArtifact = extractTaskDataArtifact(task);
  if (dataArtifact !== undefined) {
    return dataArtifact;
  }

  const replyText = extractTaskText(task);
  return {
    status: task?.status?.state || null,
    reply: replyText || 'No reply was produced.',
  };
}

async function callInternalA2aAgent(args) {
  return callA2aAgent({
    ...args,
    routeVisibility: 'internal',
    forceInternal: true,
  });
}

async function callPublicA2aAgent(args) {
  return callA2aAgent({
    ...args,
    routeVisibility: 'public',
  });
}

module.exports = {
  INTERNAL_A2A_HEADER,
  INTERNAL_A2A_TOKEN,
  getPublicA2aBaseUrl,
  getInternalA2aBaseUrl,
  isInternalA2aAuthorized,
  shouldUseExternalA2aHttp,
  callA2aAgent,
  callInternalA2aAgent,
  callPublicA2aAgent,
};
