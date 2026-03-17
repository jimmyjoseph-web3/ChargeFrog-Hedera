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

function stripChargeFrogStationPrefix(value) {
  return String(value || '')
    .replace(/^ChargeFrog Station\s*-\s*/i, '')
    .trim();
}

function extractStationNameFromMessage(message) {
  const raw = String(message || '').trim();
  if (!raw) return null;

  const quoted = raw.match(/["“](.+?)["”]/);
  if (quoted && quoted[1]) {
    return stripChargeFrogStationPrefix(quoted[1]);
  }

  const explicit = raw.match(
    /ChargeFrog(?:\s+Station)?\s*-\s*([A-Za-z0-9 .,'&()/-]+)/i,
  );
  if (explicit && explicit[1]) {
    return stripChargeFrogStationPrefix(explicit[1]);
  }

  const trailing = raw.match(
    /\bfor\s+([A-Za-z0-9 .,'&()/-]{3,})$/i,
  );
  if (trailing && trailing[1]) {
    return stripChargeFrogStationPrefix(trailing[1]);
  }

  return null;
}

function findBestStationByNameHint(stations, stationNameHint) {
  const hint = normalizeStationNameForMatch(stationNameHint);
  if (!hint) return null;

  const hintTokens = hint.split(' ').filter((token) => token.length > 1);
  let best = null;

  for (const station of Array.isArray(stations) ? stations : []) {
    const name = normalizeStationNameForMatch(station?.stationName || '');
    if (!name) continue;

    let score = 0;
    if (name === hint) {
      score = 100;
    } else if (name.includes(hint) || hint.includes(name)) {
      score = 80;
    } else if (hintTokens.length > 0) {
      const nameTokens = new Set(
        name.split(' ').filter((token) => token.length > 1),
      );
      let overlap = 0;
      for (const token of hintTokens) {
        if (nameTokens.has(token)) overlap += 1;
      }
      score = (overlap / hintTokens.length) * 70;
    }

    if (!best || score > best.score) {
      best = { station, score };
    }
  }

  return best && best.score >= 35 ? best.station : null;
}

function isListFullyInvestedIntent(message) {
  const text = String(message || '').toLowerCase();
  return (
    text.includes('fully-invested') ||
    text.includes('fully invested')
  ) && text.includes('station');
}

function isCreatePolicyIntent(message) {
  const text = String(message || '').toLowerCase();
  const wantsCreation =
    /\b(yes|create|proceed|go ahead|generate|make|set up|setup|replicate)\b/i.test(
      text,
    );
  const wantsGuardianArtifacts =
    /\b(policy|policies|schema|schemas|guardian)\b/i.test(text);
  const referencesPastStations =
    /\b(old|past|previous|existing|fully[-\s]?invested)\b/i.test(text);
  return (
    (wantsCreation && wantsGuardianArtifacts) ||
    (wantsGuardianArtifacts && referencesPastStations)
  );
}

function isGuardianAdminIntent(message) {
  return isListFullyInvestedIntent(message) || isCreatePolicyIntent(message);
}