function toFiniteNumber(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeWalletAddress(inputWalletAddress) {
  if (inputWalletAddress === undefined || inputWalletAddress === null)
    return null;
  const candidate = String(inputWalletAddress).trim();
  if (candidate === '') return null;
  if (/^\d+\.\d+\.\d+$/.test(candidate)) {
    return candidate;
  }
  throw new Error('walletAddress must be a valid Hedera account ID (0.0.x)');
}

function sanitizeObjectForLogs(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeObjectForLogs(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const redacted = {};
  for (const [key, raw] of Object.entries(value)) {
    const lowered = key.toLowerCase();
    if (
      lowered.includes('key') ||
      lowered.includes('secret') ||
      lowered.includes('token') ||
      lowered.includes('password') ||
      lowered.includes('authorization')
    ) {
      redacted[key] = '[REDACTED]';
      continue;
    }
    redacted[key] = sanitizeObjectForLogs(raw);
  }
  return redacted;
}

function logStructured({
  correlationId,
  level = 'info',
  agent,
  action,
  input,
  outputSummary,
  success = true,
  durationMs,
  error,
}) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    correlationId,
    agent,
    action,
    input: sanitizeObjectForLogs(input || {}),
    outputSummary: sanitizeObjectForLogs(outputSummary || {}),
    success,
    durationMs: toFiniteNumber(durationMs) || 0,
  };
  if (error) {
    payload.error = String(error);
  }
  console.log(JSON.stringify(payload));
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

function normalizeReasoningEffort(value, fallback = 'medium') {
  const raw = String(value || fallback || '')
    .trim()
    .toLowerCase();
  if (raw === 'high' || raw === 'medium' || raw === 'low') {
    return raw;
  }
  return fallback;
}

module.exports = {
  toFiniteNumber,
  normalizeWalletAddress,
  sanitizeObjectForLogs,
  logStructured,
  extractJsonObject,
  normalizeReasoningEffort,
};
