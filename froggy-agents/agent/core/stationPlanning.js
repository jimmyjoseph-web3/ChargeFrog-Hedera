const { toFiniteNumber } = require('./shared');

function summarizeAvailability(connectors) {
  const summary = {
    connectorTypes: 0,
    totalConnectors: 0,
    available: 0,
    occupied: 0,
    reserved: 0,
    outOfService: 0,
    unknown: 0,
    maxPowerKW: 0,
  };

  for (const connector of Array.isArray(connectors) ? connectors : []) {
    summary.connectorTypes += 1;
    if (Number.isFinite(connector?.total)) {
      summary.totalConnectors += Number(connector.total);
    }

    const perPower = Array.isArray(connector?.perPowerLevel)
      ? connector.perPowerLevel
      : [];
    for (const item of perPower) {
      if (Number.isFinite(item?.powerKW) && item.powerKW > summary.maxPowerKW) {
        summary.maxPowerKW = Number(item.powerKW);
      }
      if (Number.isFinite(item?.available))
        summary.available += Number(item.available);
      if (Number.isFinite(item?.occupied))
        summary.occupied += Number(item.occupied);
      if (Number.isFinite(item?.reserved))
        summary.reserved += Number(item.reserved);
      if (Number.isFinite(item?.outOfService)) {
        summary.outOfService += Number(item.outOfService);
      }
      if (Number.isFinite(item?.unknown))
        summary.unknown += Number(item.unknown);
    }
  }
  return summary;
}

function computeStationScore({ connectorCount, availabilitySummary }) {
  const available = Number(availabilitySummary?.available || 0);
  const total = Number(availabilitySummary?.totalConnectors || 0);
  const maxPower = Number(availabilitySummary?.maxPowerKW || 0);
  const availabilityRatio = total > 0 ? available / total : 0;
  return (
    connectorCount * 2 +
    available * 3 +
    availabilityRatio * 10 +
    Math.min(maxPower / 25, 10)
  );
}

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function haversineDistanceMeters(from, to) {
  const earthRadiusMeters = 6371000;
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLat = lat2 - lat1;
  const deltaLon = toRadians(to.lon - from.lon);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.min(1, Math.sqrt(a)));
}

function deriveProposedAreaFromChargingEvidence({
  centroid,
  rankedStations,
  maxShiftMeters,
}) {
  const center = {
    lat: Number(centroid?.lat),
    lon: Number(centroid?.lon),
  };
  if (!Number.isFinite(center.lat) || !Number.isFinite(center.lon)) {
    return null;
  }

  const evidence = (Array.isArray(rankedStations) ? rankedStations : [])
    .filter((station) => {
      const lat = toFiniteNumber(station?.position?.lat);
      const lon = toFiniteNumber(station?.position?.lon);
      return (
        lat !== undefined &&
        lon !== undefined &&
        Boolean(station?.chargingAvailabilityId)
      );
    })
    .slice(0, 5);

  if (evidence.length === 0) {
    return {
      lat: Number(center.lat.toFixed(6)),
      lon: Number(center.lon.toFixed(6)),
      source: 'centroid_only',
      usedEvidenceCount: 0,
    };
  }

  const weighted = evidence.reduce(
    (acc, station) => {
      const weight = Math.max(toFiniteNumber(station.score) || 1, 1);
      return {
        weight: acc.weight + weight,
        lat: acc.lat + Number(station.position.lat) * weight,
        lon: acc.lon + Number(station.position.lon) * weight,
      };
    },
    { weight: 0, lat: 0, lon: 0 },
  );
  const weightedLat =
    weighted.weight > 0 ? weighted.lat / weighted.weight : center.lat;
  const weightedLon =
    weighted.weight > 0 ? weighted.lon / weighted.weight : center.lon;

  const blended = {
    lat: center.lat * 0.7 + weightedLat * 0.3,
    lon: center.lon * 0.7 + weightedLon * 0.3,
  };

  const shiftMeters = haversineDistanceMeters(center, blended);
  const shiftLimit =
    Number.isFinite(maxShiftMeters) && maxShiftMeters > 0
      ? maxShiftMeters
      : 3000;
  if (shiftMeters > shiftLimit) {
    return {
      lat: Number(center.lat.toFixed(6)),
      lon: Number(center.lon.toFixed(6)),
      source: 'centroid_only_shift_limited',
      usedEvidenceCount: evidence.length,
    };
  }

  return {
    lat: Number(blended.lat.toFixed(6)),
    lon: Number(blended.lon.toFixed(6)),
    source: 'centroid_charging_evidence_blend',
    usedEvidenceCount: evidence.length,
  };
}

function normalizeProposedPlaceName(value) {
  const cleaned = String(value || '')
    .replace(/^chargefrog\s+station\s*-\s*/i, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[`"'“”]+|[`"'“”]+$/g, '');
  if (!cleaned) return null;

  const primary = cleaned.split(/\s[|:-]\s/)[0];
  const normalized = String(primary || cleaned)
    .replace(/[^\w\s,&/-]/g, ' ')
    .replace(
      /\b(?:wikipedia|wikidata|tripadvisor|yelp|official\s+site|official|glossary|tabulation|neighborhood\s+tabulation\s+area|nyc\s*dcp|pdf|program\s+documents?|resources?)\b/gi,
      ' ',
    )
    .replace(/\b\d{4}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[,\s-]+|[,\s-]+$/g, '')
    .trim();
  if (!normalized) return null;
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const truncated = words.slice(0, 5).join(' ');
  return truncated.slice(0, 64);
}

function isUsableStationLabel(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (text.length < 3) return false;
  if (!/[A-Za-z]/.test(text)) return false;
  if (
    /\b(?:wikipedia|wikidata|tripadvisor|yelp|glossary|tabulation|nyc\s*dcp|official\s+site|official|pdf)\b/i.test(
      text,
    )
  ) {
    return false;
  }
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 6) return false;
  return true;
}

function extractAreaLabel(area) {
  const raw = String(area || '').trim();
  if (!raw) return null;
  const firstSegment = raw.split(',')[0];
  return normalizeProposedPlaceName(firstSegment);
}

function extractAddressLabel(address) {
  const raw = String(address || '').trim();
  if (!raw) return null;
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  for (const part of parts) {
    if (/\d/.test(part)) continue;
    const normalized = normalizeProposedPlaceName(part);
    if (normalized) return normalized;
  }
  return null;
}

function extractReverseGeocodeLabel(reverseGeocode) {
  const address =
    reverseGeocode?.address && typeof reverseGeocode.address === 'object'
      ? reverseGeocode.address
      : {};

  const candidates = [
    address.neighborhood,
    address.municipalitySubdivision,
    address.localName,
    address.municipality,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeProposedPlaceName(candidate);
    if (isUsableStationLabel(normalized)) {
      return normalized;
    }
  }

  const fromFreeform = extractAddressLabel(address.freeformAddress);
  if (isUsableStationLabel(fromFreeform)) {
    return fromFreeform;
  }

  return null;
}

function deriveProposedStationName({
  centroid,
  reverseGeocode,
  preferredArea,
  bestStation,
  rankedStations,
}) {
  const reverseGeocodeLabel = extractReverseGeocodeLabel(reverseGeocode);
  if (isUsableStationLabel(reverseGeocodeLabel)) {
    return reverseGeocodeLabel;
  }

  const areaCandidate = extractAreaLabel(preferredArea);
  if (isUsableStationLabel(areaCandidate)) {
    return areaCandidate;
  }

  const evidenceCandidates = [];
  if (bestStation) {
    evidenceCandidates.push(bestStation.name, bestStation.address);
  }
  for (const station of (Array.isArray(rankedStations)
    ? rankedStations
    : []
  ).slice(0, 5)) {
    evidenceCandidates.push(station?.name, station?.address);
  }

  for (const candidate of evidenceCandidates) {
    const fromName = normalizeProposedPlaceName(candidate);
    if (isUsableStationLabel(fromName)) {
      return fromName;
    }
    const fromAddress = extractAddressLabel(candidate);
    if (isUsableStationLabel(fromAddress)) {
      return fromAddress;
    }
  }

  if (
    centroid &&
    Number.isFinite(centroid.lat) &&
    Number.isFinite(centroid.lon)
  ) {
    return `Proposed Site ${centroid.lat.toFixed(4)}, ${centroid.lon.toFixed(4)}`;
  }
  return 'Proposed Site';
}

function buildProposalDescription({
  area,
  proposedArea,
  bestStation,
  neighborhood,
  proposedStationName,
}) {
  const components = [
    `Proposed new station: ${proposedStationName || area}.`,
    `Proposed region: ${area}.`,
    `Proposed area coordinates: (${proposedArea.lat.toFixed(6)}, ${proposedArea.lon.toFixed(6)}).`,
    `Interest count: ${neighborhood.count}, threshold: ${neighborhood.triggerThreshold}.`,
  ];
  if (bestStation) {
    components.push(
      'Nearby charging evidence was reviewed for viability scoring.',
    );
  }
  return components.join(' ');
}

module.exports = {
  summarizeAvailability,
  computeStationScore,
  haversineDistanceMeters,
  deriveProposedAreaFromChargingEvidence,
  normalizeProposedPlaceName,
  isUsableStationLabel,
  extractAreaLabel,
  extractAddressLabel,
  extractReverseGeocodeLabel,
  deriveProposedStationName,
  buildProposalDescription,
};
