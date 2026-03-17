const { guardianAdminTools } = require('./adminTools');
const { renderGuardianReply } = require('./replies');

const FIXED_CARBON_TEMPLATE_POLICY_ID = '6917fef5e88fa758ecc72e1b';
const FIXED_WIPE_TEMPLATE_POLICY_ID = '69186a11e88fa758ecc73127';
const FIXED_POLICY_VERSION = '1.0.0';

function parseStationId(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.trunc(parsed);
  return normalized > 0 ? normalized : null;
}

function normalizeStationNameForMatch(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/^chargefrog\s+station\s*-\s*/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractStationIdFromMessage(message) {
  const match = String(message || '').match(/\bstation\s*id\s*[:#]?\s*(\d+)\b/i);
  if (match && match[1]) {
    return parseStationId(match[1]);
  }
  const fallback = String(message || '').match(/\b(\d+)\b/);
  return fallback && fallback[1] ? parseStationId(fallback[1]) : null;
}