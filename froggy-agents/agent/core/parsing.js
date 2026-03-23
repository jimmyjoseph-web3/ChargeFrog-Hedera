const {
  STATE,
  DECISION_POLICIES,
  DOMAIN_SCOPED_INTENTS,
  DOMAIN_KEYWORDS,
} = require('../config/constants');
const { OUT_OF_SCOPE_REPLY_PROMPT } = require('../config/prompts');
const { toFiniteNumber } = require('./shared');

function parseLocation(message) {
  const text = String(message || '');

  let candidate = '';
  const directionalPattern = /\b(?:near|around|at)\s+([^,.!?;]+)/gi;
  let directionalMatch;
  while ((directionalMatch = directionalPattern.exec(text)) !== null) {
    candidate = String(directionalMatch[1] || '').trim();
  }
  if (candidate) return normalizeAreaForTomTom(candidate);

  const inPattern = /\bin\s+([^,.!?;]+)/gi;
  let inMatch;
  while ((inMatch = inPattern.exec(text)) !== null) {
    candidate = String(inMatch[1] || '').trim();
  }
  if (candidate) return normalizeAreaForTomTom(candidate);

  return undefined;
}

function parseLatLonFromMessage(message) {
  const text = String(message || '');
  if (!text.trim()) return null;

  const latMatch = text.match(
    /\blat(?:itude)?\s*[:=]?\s*(-?\d{1,2}(?:\.\d+)?)/i,
  );
  const lonMatch = text.match(
    /\b(?:lon|lng|long|longitude)\s*[:=]?\s*(-?\d{1,3}(?:\.\d+)?)/i,
  );
  if (latMatch && lonMatch) {
    const lat = toFiniteNumber(latMatch[1]);
    const lon = toFiniteNumber(lonMatch[1]);
    if (
      lat !== undefined &&
      lon !== undefined &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180
    ) {
      return { lat, lon, source: 'named_fields' };
    }
  }

  const pairMatch = text.match(
    /(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/,
  );
  if (!pairMatch) return null;

  const first = toFiniteNumber(pairMatch[1]);
  const second = toFiniteNumber(pairMatch[2]);
  if (first === undefined || second === undefined) return null;
  if (first < -90 || first > 90 || second < -180 || second > 180) {
    return null;
  }
  return { lat: first, lon: second, source: 'coordinate_pair' };
}

function normalizeAreaForTomTom(value) {
  let area = String(value || '').trim();
  if (!area) return '';

  area = area.replace(/^[`"'“”]+|[`"'“”]+$/g, '');
  area = area.replace(/\s+/g, ' ');

  area = area.replace(
    /^(?:i\s+(?:want|wanna|would\s+like|am|m)\s+to\s+)?(?:find|discover|invest(?:\s+in)?|propose|look\s+for)\s+/i,
    '',
  );
  area = area.replace(
    /^(?:a|an|the)?\s*(?:station|charging\s+station|location|spot|place|area)\s+(?:somewhere\s+)?(?:in|near|around|at)\s+/i,
    '',
  );
  area = area.replace(
    /^(?:somewhere|probably|maybe|roughly|approximately)\s+/i,
    '',
  );
  area = area.replace(/^(?:in|near|around|at)\s+/i, '');
  area = area.replace(/\b(?:please|thanks|thank\s+you)\b.*$/i, '');
  area = area.trim().replace(/\s+/g, ' ');

  return area;
}

function parseStationId(message) {
  const match = String(message || '').match(/\bstation\s*#?\s*(\d+)\b/i);
  if (!match) return undefined;
  const stationId = Number(match[1]);
  return Number.isFinite(stationId) ? Math.trunc(stationId) : undefined;
}

function parseStationNameHint(message) {
  const text = String(message || '');
  const patterns = [
    /\b(chargefrog\s+station\s*[-:]\s*[^,.!?;]+)/i,
    /\b(chargefrog\s*[-:]\s*[^,.!?;]+)/i,
    /\b(chargefrog\s+station\s+[^,.!?;]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match || !match[1]) continue;
    const normalized = String(match[1]).replace(/\s+/g, ' ').trim();
    if (normalized) return normalized;
  }

  return null;
}

function isBalanceQueryMessage(message) {
  const text = String(message || '').toLowerCase();
  const asksBalance = /\b(balance|holdings?|owned|own)\b/.test(text);
  const mentionsAssetOrStation = /\b(equity|bond|token|tokens|station)\b/.test(
    text,
  );
  return asksBalance && mentionsAssetOrStation;
}

function inferStationSpecificIntent(message) {
  const stationNameHint = parseStationNameHint(message);
  if (!stationNameHint) return null;

  if (isBalanceQueryMessage(message)) return STATE.GET_TOKEN_BALANCE;

  const text = String(message || '').toLowerCase();
  const hasInvestSignal =
    /\b(buy|get|mint|invest|purchase|take|give|issue|equity|bond|token|tokens)\b/i.test(
      text,
    );
  if (hasInvestSignal) return STATE.INVEST_STATION;
  return STATE.SHOW_INVESTMENT_CHOICES;
}

function normalizeStationNameForMatch(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

  if (best && best.score >= 35) {
    return best.station;
  }
  return null;
}

function parseProposalId(message) {
  const patterns = [
    /\bproposal(?:\s+id)?\s*[:#]?\s*([a-zA-Z0-9_-]+)/i,
    /\bproposalId\s*[:=]\s*([a-zA-Z0-9_-]+)/i,
  ];
  for (const pattern of patterns) {
    const match = String(message || '').match(pattern);
    if (match && match[1]) {
      return String(match[1]);
    }
  }
  return undefined;
}

function parseAmount(message) {
  const investMatch = String(message || '').match(
    /\b(?:buy|get|mint|invest)\s+(\d+(?:\.\d+)?)\b/i,
  );
  if (investMatch) return String(investMatch[1]);

  const numberMatch = String(message || '').match(/\b(\d+(?:\.\d+)?)\b/);
  if (numberMatch) return String(numberMatch[1]);

  return '1';
}

function parseRequestedAssetType(message) {
  const text = String(message || '').toLowerCase();
  if (/\bequity\b/.test(text)) return 'equity';
  if (/\bbond\b/.test(text)) return 'bond';
  return null;
}

function isInvestmentExecutionMessage(message) {
  const text = String(message || '').toLowerCase();
  const hasActionVerb =
    /\b(buy|get|mint|invest|purchase|take|give|issue)\b/.test(text);
  const hasInvestmentNoun = /\b(token|tokens|equity|bond)\b/.test(text);
  return hasActionVerb && hasInvestmentNoun;
}

function toPositiveWholeNumber(value) {
  const parsed = toFiniteNumber(value);
  if (parsed === undefined || parsed <= 0) return undefined;
  return Math.trunc(parsed);
}

function normalizeStationName(value, fallback = 'Station') {
  const cleaned = String(value || '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned) return cleaned;
  return String(fallback).replace(/\s+/g, ' ').trim() || 'Station';
}

function buildTokenSymbol(stationName, stationId, suffix) {
  const namePart = String(stationName || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4);
  const idPart =
    String(stationId || '')
      .replace(/\D/g, '')
      .slice(-2) || '00';
  const raw =
    `CF${namePart}${idPart}${String(suffix || '').toUpperCase()}`.replace(
      /[^A-Z0-9]/g,
      '',
    );
  const sliced = raw.slice(0, 10);
  return (
    sliced || `CF${idPart}${String(suffix || '').toUpperCase()}`.slice(0, 10)
  );
}

function parseIntentRuleBased(message) {
  const text = String(message || '').toLowerCase();
  const stationSpecificIntent = inferStationSpecificIntent(message);
  if (stationSpecificIntent) {
    return stationSpecificIntent;
  }

  const mentionsStations = /\bstations?\b/.test(text);
  const asksListing =
    /\b(list|show|what|which|any|available)\b/.test(text) && mentionsStations;
  const asksAvailability =
    /\b(available|investable|currently|right now|open for investment|in investment stage)\b/.test(
      text,
    );
  const asksWhichStationsToInvestIn =
    asksListing &&
    mentionsStations &&
    /\binvest\b/.test(text) &&
    !/\bnear\b|\baround\b|\bin\s+[a-z]/.test(text);

  if (text.includes('issue assets') || text.includes('issue station assets')) {
    return STATE.ISSUE_ASSETS_AFTER_APPROVAL;
  }
  if (
    text.includes('what stations are available') ||
    text.includes('stations available') ||
    text.includes('available right now') ||
    (asksListing && asksAvailability) ||
    asksWhichStationsToInvestIn
  ) {
    return STATE.LIST_AVAILABLE_STATIONS;
  }
  if (
    text.includes('investment choices') ||
    (text.includes('equity') &&
      text.includes('bond') &&
      text.includes('choice'))
  ) {
    return STATE.SHOW_INVESTMENT_CHOICES;
  }
  if (isBalanceQueryMessage(text)) {
    return STATE.GET_TOKEN_BALANCE;
  }
  if (
    (text.includes('equity') &&
      (text.includes('buy') ||
        text.includes('mint') ||
        text.includes('get'))) ||
    /(\d+)\s+equity\b/i.test(text)
  ) {
    return STATE.INVEST_STATION;
  }
  if (
    (text.includes('bond') &&
      (text.includes('buy') ||
        text.includes('mint') ||
        text.includes('get'))) ||
    /(\d+)\s+bond\b/i.test(text)
  ) {
    return STATE.INVEST_STATION;
  }
  if (
    /\b(buy|get|mint|invest|purchase|take|give|issue)\b/i.test(text) &&
    /\b(token|tokens)\b/i.test(text)
  ) {
    return STATE.INVEST_STATION;
  }
  if (
    text.includes('find a station') ||
    text.includes('find station') ||
    text.includes('discover station') ||
    text.includes('station to invest') ||
    text.includes('near ') ||
    text.includes('around ') ||
    text.includes('propose station')
  ) {
    return STATE.FIND_STATION_FOR_PROPOSAL;
  }
  return STATE.GENERAL;
}

function normalizeWorkflowIntent(rawIntent) {
  const value = String(rawIntent || '').trim();
  if (value === STATE.BUY_EQUITY || value === STATE.BUY_BOND) {
    return STATE.INVEST_STATION;
  }
  if (Object.values(STATE).includes(value)) {
    return value;
  }
  return STATE.GENERAL;
}

function isDomainScopedMessage(message) {
  const text = String(message || '').trim();
  if (!text) return false;
  return DOMAIN_KEYWORDS.some((pattern) => pattern.test(text));
}

function evaluateChatDomainScope({ message, intent }) {
  if (!DECISION_POLICIES.strictDomainGuardrails) {
    return { allowed: true, reason: 'guardrail_disabled' };
  }
  if (DOMAIN_SCOPED_INTENTS.has(intent)) {
    return { allowed: true, reason: 'allowed_intent' };
  }
  if (isDomainScopedMessage(message)) {
    return { allowed: true, reason: 'keyword_match' };
  }
  return {
    allowed: false,
    reason: 'out_of_scope',
    reply: OUT_OF_SCOPE_REPLY_PROMPT,
  };
}

module.exports = {
  parseLocation,
  parseLatLonFromMessage,
  normalizeAreaForTomTom,
  parseStationId,
  parseStationNameHint,
  inferStationSpecificIntent,
  normalizeStationNameForMatch,
  findBestStationByNameHint,
  parseProposalId,
  parseAmount,
  parseRequestedAssetType,
  isBalanceQueryMessage,
  isInvestmentExecutionMessage,
  toPositiveWholeNumber,
  normalizeStationName,
  buildTokenSymbol,
  parseIntentRuleBased,
  normalizeWorkflowIntent,
  isDomainScopedMessage,
  evaluateChatDomainScope,
};
