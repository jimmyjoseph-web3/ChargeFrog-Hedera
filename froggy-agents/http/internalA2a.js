const { randomUUID } = require('crypto');

const INTERNAL_A2A_HEADER = 'x-chargefrog-internal-a2a';
const INTERNAL_A2A_TOKEN = randomUUID();

function getInternalA2aBaseUrl() {
  const port = Number(process.env.PORT || 8787);
  return `http://localhost:${port}`;
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

async function callInternalA2aAgent({ endpointPath, data, text, metadata }) {
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

  const response = await fetch(`${getInternalA2aBaseUrl()}${endpointPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [INTERNAL_A2A_HEADER]: INTERNAL_A2A_TOKEN,
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMessage =
      body && body.error && body.error.message
        ? body.error.message
        : `Internal A2A request failed (${response.status})`;
    throw new Error(errorMessage);
  }

  if (body && body.error) {
    throw new Error(body.error.message || 'Internal A2A request failed');
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

module.exports = {
  INTERNAL_A2A_HEADER,
  INTERNAL_A2A_TOKEN,
  getInternalA2aBaseUrl,
  isInternalA2aAuthorized,
  callInternalA2aAgent,
};
