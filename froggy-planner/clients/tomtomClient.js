const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const TOMTOM_BASE_URL = 'https://api.tomtom.com';
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

function loadEnvFiles() {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../.env'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate, override: false });
    }
  }
}

loadEnvFiles();

function envValue(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return undefined;
}

function getTomTomApiKey() {
  const key = envValue('tomtom_private_key', 'TOMTOM_PRIVATE_KEY');
  if (!key) {
    throw new Error(
      'Missing tomtom_private_key (or TOMTOM_PRIVATE_KEY) in .env',
    );
  }
  return key;
}

function toFiniteNumber(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeLimit(value) {
  const parsed = toFiniteNumber(value);
  if (!parsed) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(parsed), 1), MAX_LIMIT);
}

function normalizeRadius(value) {
  const parsed = toFiniteNumber(value);
  if (parsed === undefined) return undefined;
  if (parsed <= 0) {
    throw new Error('radius must be greater than 0');
  }
  return Math.trunc(parsed);
}

function toStringOrUndefined(value) {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  return normalized === '' ? undefined : normalized;
}

async function tomtomGetJson(pathname, params = {}) {
  const url = new URL(pathname, `${TOMTOM_BASE_URL}/`);
  url.searchParams.set('key', getTomTomApiKey());

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TomTom API error (${response.status}): ${errorText}`);
  }
  return response.json();
}

function mapGeocodeResult(result) {
  return {
    id: result?.id || null,
    score: result?.score ?? null,
    type: result?.type || null,
    entityType: result?.entityType || null,
    address: result?.address?.freeformAddress || null,
    position: result?.position
      ? {
          lat: result.position.lat,
          lon: result.position.lon,
        }
      : null,
  };
}

function mapSearchResolutionResult(result) {
  return {
    id: result?.id || null,
    score: result?.score ?? null,
    type: result?.type || null,
    entityType: result?.entityType || null,
    address: result?.address?.freeformAddress || null,
    name: result?.poi?.name || null,
    position: result?.position
      ? {
          lat: result.position.lat,
          lon: result.position.lon,
        }
      : null,
  };
}

function mapPoiResult(result) {
  return {
    id: result?.id || null,
    name: result?.poi?.name || null,
    categories: Array.isArray(result?.poi?.categories)
      ? result.poi.categories
      : [],
    categorySet: Array.isArray(result?.poi?.categorySet)
      ? result.poi.categorySet
      : [],
    address: result?.address?.freeformAddress || null,
    position: result?.position
      ? { lat: result.position.lat, lon: result.position.lon }
      : null,
    distanceMeters: result?.dist ?? null,
    chargingAvailabilityId:
      result?.dataSources?.chargingAvailability?.id || null,
    parkingAvailabilityId: result?.dataSources?.parkingAvailability?.id || null,
    connectors: Array.isArray(result?.chargingPark?.connectors)
      ? result.chargingPark.connectors.map((connector) => ({
          connectorType: connector?.connectorType || null,
          ratedPowerKW: connector?.ratedPowerKW ?? null,
          currentType: connector?.currentType || null,
          currentA: connector?.currentA ?? null,
          voltageV: connector?.voltageV ?? null,
        }))
      : [],
  };
}

function mapReverseGeocodeAddress(address = {}) {
  return {
    freeformAddress: address?.freeformAddress || null,
    municipality: address?.municipality || null,
    municipalitySubdivision: address?.municipalitySubdivision || null,
    localName: address?.localName || null,
    neighborhood: address?.neighbourhood || null,
    countrySubdivision: address?.countrySubdivision || null,
    country: address?.country || null,
    countryCode: address?.countryCode || null,
  };
}

function tokenizeArea(area) {
  return area
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 3);
}

function scoreSearchMatch(result, area) {
  const loweredArea = area.toLowerCase();
  const tokens = tokenizeArea(area);
  const haystack = [
    result?.poi?.name,
    result?.address?.freeformAddress,
    result?.address?.municipality,
    result?.address?.countrySubdivision,
    result?.address?.country,
  ]
    .filter((value) => typeof value === 'string' && value.trim() !== '')
    .join(' ')
    .toLowerCase();

  let score = Number(result?.score || 0);
  if (result?.type === 'POI') score += 50;
  if (result?.poi?.name) score += 10;
  if (haystack.includes(loweredArea)) score += 30;

  if (tokens.length > 0) {
    const matched = tokens.filter((token) => haystack.includes(token)).length;
    score += matched * 5;
  }

  return score;
}

async function searchArea(input = {}) {
  const area = toStringOrUndefined(input.area);
  const language = toStringOrUndefined(input.language);

  const response = await tomtomGetJson(
    `search/2/search/${encodeURIComponent(area)}.json`,
    {
      limit: 5,
      language,
      typeahead: false,
    },
  );

  const results = Array.isArray(response?.results) ? response.results : [];
  const withPosition = results.filter((result) => Boolean(result?.position));
  if (withPosition.length === 0) {
    return null;
  }

  const best = withPosition
    .map((result) => ({
      result,
      score: scoreSearchMatch(result, area),
    }))
    .sort((a, b) => b.score - a.score)[0]?.result;

  if (!best?.position) {
    return null;
  }

  return {
    area,
    center: {
      lat: best.position.lat,
      lon: best.position.lon,
    },
    geocode: mapSearchResolutionResult(best),
    resolutionSource: 'search',
  };
}

async function geocodeArea(input = {}) {
  const area = toStringOrUndefined(input.area);
  if (!area) {
    throw new Error('area is required when lat/lon are not provided');
  }

  const language = toStringOrUndefined(input.language);
  const geocodeResponse = await tomtomGetJson(
    `search/2/geocode/${encodeURIComponent(area)}.json`,
    {
      limit: 1,
      language,
    },
  );

  const first = geocodeResponse?.results?.[0];
  if (!first?.position) {
    throw new Error(`Unable to geocode area "${area}"`);
  }

  return {
    area,
    center: {
      lat: first.position.lat,
      lon: first.position.lon,
    },
    geocode: mapGeocodeResult(first),
    resolutionSource: 'geocode',
  };
}

async function resolveAreaCenter(input = {}) {
  const lat = toFiniteNumber(input.lat);
  const lon = toFiniteNumber(input.lon);
  if (lat !== undefined && lon !== undefined) {
    return {
      area: toStringOrUndefined(input.area) || null,
      center: { lat, lon },
      geocode: null,
      resolutionSource: 'input',
    };
  }

  // Resolve landmark/place text with POI-aware search first, then fallback to geocode.
  const searched = await searchArea(input);
  if (searched) {
    return searched;
  }
  return geocodeArea(input);
}

async function runPoiSearch({
  center,
  radius,
  limit,
  query,
  categorySet,
  connectorSet,
  minPowerKW,
  maxPowerKW,
  openingHours,
  language,
}) {
  const response = await tomtomGetJson(
    `search/2/poiSearch/${encodeURIComponent(query)}.json`,
    {
      lat: center.lat,
      lon: center.lon,
      radius,
      limit,
      categorySet,
      connectorSet,
      minPowerKW,
      maxPowerKW,
      openingHours,
      language,
    },
  );

  const results = Array.isArray(response?.results)
    ? response.results.map(mapPoiResult)
    : [];

  return {
    summary: response?.summary || {},
    results,
  };
}

async function findPoiByArea(input = {}) {
  const resolved = await resolveAreaCenter(input);
  const radius = normalizeRadius(input.radius);
  const limit = normalizeLimit(input.limit);
  const query =
    toStringOrUndefined(input.query || input.poiQuery) || 'ev charging station';
  const openingHours =
    toStringOrUndefined(input.openingHours) || 'nextSevenDays';

  const poi = await runPoiSearch({
    center: resolved.center,
    radius,
    limit,
    query,
    categorySet: toStringOrUndefined(input.categorySet),
    connectorSet: toStringOrUndefined(input.connectorSet),
    minPowerKW: toFiniteNumber(input.minPowerKW),
    maxPowerKW: toFiniteNumber(input.maxPowerKW),
    openingHours,
    language: toStringOrUndefined(input.language),
  });

  const totalResults = Number(
    poi.summary.numResults || poi.results.length || 0,
  );
  const warnings = [];
  if (radius !== undefined && radius < 1000) {
    warnings.push(
      'radius is in meters; radius=500 only searches within 500m of the center point.',
    );
  }
  if (totalResults === 0 && radius !== undefined) {
    warnings.push(
      'No POIs found in the current radius. Try a larger radius (e.g. 5000-20000) or omit radius for bias-only city search.',
    );
  }

  return {
    area: resolved.area,
    center: resolved.center,
    geocode: resolved.geocode,
    resolutionSource: resolved.resolutionSource || 'unknown',
    query,
    searchMode: radius === undefined ? 'bias' : 'radius',
    radius: radius ?? null,
    limit,
    totalResults,
    pointsOfInterest: poi.results,
    warnings,
  };
}

async function reverseGeocodeByPosition(input = {}) {
  const lat = toFiniteNumber(input.lat);
  const lon = toFiniteNumber(input.lon);
  if (lat === undefined || lon === undefined) {
    throw new Error('lat and lon are required for reverse geocode');
  }

  const language = toStringOrUndefined(input.language);
  const response = await tomtomGetJson(
    `search/2/reverseGeocode/${encodeURIComponent(`${lat},${lon}`)}.json`,
    {
      limit: 1,
      language,
    },
  );

  const first = response?.results?.[0];
  if (!first) {
    throw new Error(`Unable to reverse geocode coordinates "${lat},${lon}"`);
  }

  return {
    query: { lat, lon },
    position: first?.position
      ? { lat: first.position.lat, lon: first.position.lon }
      : { lat, lon },
    address: mapReverseGeocodeAddress(first?.address || {}),
    geocode: mapGeocodeResult(first),
  };
}

function normalizeChargingAvailabilityIds(input = {}) {
  const single = toStringOrUndefined(input.chargingAvailabilityId);
  const fromArray = Array.isArray(input.chargingAvailabilityIds)
    ? input.chargingAvailabilityIds
        .map((value) => toStringOrUndefined(value))
        .filter((value) => Boolean(value))
    : [];

  const ids = [
    ...new Set([single, ...fromArray].filter((value) => Boolean(value))),
  ];
  if (ids.length === 0) {
    throw new Error(
      'chargingAvailabilityId or chargingAvailabilityIds is required',
    );
  }
  return ids;
}

function mapChargingAvailabilityConnector(connector) {
  return {
    connectorType: connector?.type || connector?.connectorType || null,
    total: connector?.total ?? null,
    current: connector?.availability?.current || null,
    perPowerLevel: Array.isArray(connector?.availability?.perPowerLevel)
      ? connector.availability.perPowerLevel.map((item) => ({
          powerKW: item?.powerKW ?? null,
          available: item?.available ?? null,
          occupied: item?.occupied ?? null,
          reserved: item?.reserved ?? null,
          unknown: item?.unknown ?? null,
          outOfService: item?.outOfService ?? null,
        }))
      : [],
  };
}

async function findChargingStationsByAvailability(input = {}) {
  const chargingAvailabilityIds = normalizeChargingAvailabilityIds(input);
  const connectorSet = toStringOrUndefined(input.connectorSet);
  const minPowerKW = toFiniteNumber(input.minPowerKW);
  const maxPowerKW = toFiniteNumber(input.maxPowerKW);

  const settled = await Promise.allSettled(
    chargingAvailabilityIds.map(async (chargingAvailabilityId) => {
      const payload = await tomtomGetJson(
        'search/2/chargingAvailability.json',
        {
          chargingAvailability: chargingAvailabilityId,
          connectorSet,
          minPowerKW,
          maxPowerKW,
        },
      );

      return {
        chargingAvailabilityId:
          payload?.chargingAvailability || chargingAvailabilityId,
        connectors: Array.isArray(payload?.connectors)
          ? payload.connectors.map(mapChargingAvailabilityConnector)
          : [],
      };
    }),
  );

  const results = [];
  const errors = [];
  settled.forEach((item, index) => {
    if (item.status === 'fulfilled') {
      results.push(item.value);
    } else {
      errors.push({
        chargingAvailabilityId: chargingAvailabilityIds[index],
        error:
          item.reason instanceof Error
            ? item.reason.message
            : String(item.reason),
      });
    }
  });

  return {
    requestedCount: chargingAvailabilityIds.length,
    successfulCount: results.length,
    failedCount: errors.length,
    chargingStations: results,
    errors,
  };
}

module.exports = {
  findPoiByArea,
  findChargingStationsByAvailability,
  resolveAreaCenter,
  reverseGeocodeByPosition,
};
