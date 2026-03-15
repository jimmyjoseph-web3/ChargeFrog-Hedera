const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const EARTH_RADIUS_METERS = 6378137;
const DEFAULT_DB_NAME = 'froggy_planner';
const DEFAULT_COLLECTION_NAME = 'mini_nodes';
const DEFAULT_RADIUS_METERS = 1000;
const DEFAULT_TRIGGER_THRESHOLD = 5;
const DEFAULT_NEIGHBOR_LIMIT = 100;
const MAX_NEIGHBOR_LIMIT = 1000;

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

function toFiniteNumber(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizePositiveInt(value, defaultValue, label) {
  const parsed = toFiniteNumber(value);
  if (parsed === undefined) return defaultValue;
  const truncated = Math.trunc(parsed);
  if (truncated <= 0) {
    throw new Error(`${label} must be greater than 0`);
  }
  return truncated;
}

function normalizeWalletAddress(value) {
  if (value === undefined || value === null) {
    throw new Error('walletAddress is required');
  }

  const normalized = String(value).trim();
  if (/^\d+\.\d+\.\d+$/.test(normalized)) {
    return normalized;
  }
  throw new Error('walletAddress must be a valid Hedera account ID (0.0.x)');
}

function normalizeLatLon(input = {}) {
  const lat = toFiniteNumber(input.lat ?? input.latitude);
  const lon = toFiniteNumber(input.lon ?? input.lng ?? input.longitude);

  if (lat === undefined || lon === undefined) {
    throw new Error('lat and lon are required');
  }
  if (lat < -90 || lat > 90) {
    throw new Error('lat must be between -90 and 90');
  }
  if (lon < -180 || lon > 180) {
    throw new Error('lon must be between -180 and 180');
  }

  return { lat, lon };
}

function normalizeTimestamp(value) {
  if (value === undefined || value === null || value === '') {
    return new Date();
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error('timestamp is invalid');
    }
    return value;
  }

  const asNumber = toFiniteNumber(value);
  if (asNumber !== undefined) {
    const millis =
      asNumber < 1e12 ? Math.trunc(asNumber * 1000) : Math.trunc(asNumber);
    const asDate = new Date(millis);
    if (Number.isNaN(asDate.getTime())) {
      throw new Error('timestamp is invalid');
    }
    return asDate;
  }

  const asDate = new Date(String(value));
  if (Number.isNaN(asDate.getTime())) {
    throw new Error('timestamp must be a valid date string or unix timestamp');
  }
  return asDate;
}

function normalizeDateOrUndefined(value) {
  if (value === undefined || value === null || value === '') return undefined;
  return normalizeTimestamp(value);
}

function getMongoRuntime() {
  try {
    const { MongoClient } = require('mongodb');
    return { MongoClient };
  } catch (_error) {
    throw new Error('Missing mongodb dependency. Run: npm install mongodb');
  }
}

function getMongoConfig() {
  const uri = envValue('MONGODB_URI', 'MONGO_URI');
  if (!uri) {
    throw new Error('Missing MONGODB_URI (or MONGO_URI) in .env');
  }

  return {
    uri,
    dbName:
      envValue('MONGODB_DB', 'MONGO_DB', 'MONGODB_DATABASE') || DEFAULT_DB_NAME,
    collectionName:
      envValue('MONGODB_MINI_NODES_COLLECTION') || DEFAULT_COLLECTION_NAME,
  };
}

let collectionPromise;

async function getMiniNodeCollection() {
  if (collectionPromise) {
    return collectionPromise;
  }

  collectionPromise = (async () => {
    const { MongoClient } = getMongoRuntime();
    const config = getMongoConfig();
    const client = new MongoClient(config.uri);
    await client.connect();

    const collection = client
      .db(config.dbName)
      .collection(config.collectionName);
    await collection.createIndex({ geo: '2dsphere' });
    await collection.createIndex({ timestamp: 1 });
    await collection.createIndex({ walletAddress: 1 });
    return collection;
  })().catch((error) => {
    collectionPromise = undefined;
    throw error;
  });

  return collectionPromise;
}

function mapMiniNode(document) {
  const coordinates = Array.isArray(document?.geo?.coordinates)
    ? document.geo.coordinates
    : [null, null];
  const lat =
    toFiniteNumber(document?.lat) ??
    toFiniteNumber(document?.geo?.lat) ??
    coordinates[1];
  const lon =
    toFiniteNumber(document?.lon) ??
    toFiniteNumber(document?.geo?.lon) ??
    coordinates[0];
  return {
    id: document?._id ? String(document._id) : null,
    walletAddress: document?.walletAddress || null,
    timestamp:
      document?.timestamp instanceof Date
        ? document.timestamp.toISOString()
        : document?.timestamp || null,
    geo: {
      type: 'Point',
      lat,
      lon,
    },
    lat,
    lon,
  };
}

function buildTimeRangeFilter(input = {}) {
  const lookbackMinutes = toFiniteNumber(input.lookbackMinutes);
  const since = normalizeDateOrUndefined(
    input.since ?? input.startTimestamp ?? input.startTime,
  );
  const until = normalizeDateOrUndefined(
    input.until ?? input.endTimestamp ?? input.endTime,
  );

  let from = since;
  let to = until;

  if (lookbackMinutes !== undefined) {
    if (lookbackMinutes <= 0) {
      throw new Error('lookbackMinutes must be greater than 0');
    }
    to = to || new Date();
    from = new Date(to.getTime() - lookbackMinutes * 60 * 1000);
  }

  if (!from && !to) return undefined;
  if (from && to && from.getTime() > to.getTime()) {
    throw new Error('since must be earlier than or equal to until');
  }

  const filter = {};
  if (from) filter.$gte = from;
  if (to) filter.$lte = to;
  return filter;
}

function buildNeighborhoodQuery({ lat, lon, radiusMeters, timestampFilter }) {
  const query = {
    geo: {
      $geoWithin: {
        $centerSphere: [[lon, lat], radiusMeters / EARTH_RADIUS_METERS],
      },
    },
  };
  if (timestampFilter) {
    query.timestamp = timestampFilter;
  }
  return query;
}

function mapTimeWindow(timestampFilter) {
  return timestampFilter
    ? {
        since: timestampFilter.$gte ? timestampFilter.$gte.toISOString() : null,
        until: timestampFilter.$lte ? timestampFilter.$lte.toISOString() : null,
      }
    : null;
}

function extractLatLonFromGeo(document) {
  const coordinates = Array.isArray(document?.geo?.coordinates)
    ? document.geo.coordinates
    : [];
  const lon = toFiniteNumber(coordinates[0]);
  const lat = toFiniteNumber(coordinates[1]);
  if (lat === undefined || lon === undefined) {
    return null;
  }
  return { lat, lon };
}

function computeCentroidFromDocuments(documents) {
  const points = documents
    .map((doc) => extractLatLonFromGeo(doc))
    .filter((point) => Boolean(point));

  if (points.length === 0) {
    return null;
  }

  const total = points.reduce(
    (acc, point) => ({
      lat: acc.lat + point.lat,
      lon: acc.lon + point.lon,
    }),
    { lat: 0, lon: 0 },
  );

  return {
    lat: total.lat / points.length,
    lon: total.lon / points.length,
    pointCount: points.length,
  };
}

async function createMiniNode(input = {}) {
  const { lat, lon } = normalizeLatLon(input);
  const walletAddress = normalizeWalletAddress(
    input.walletAddress ?? input.wallet,
  );
  const timestamp = normalizeTimestamp(input.timestamp);

  const collection = await getMiniNodeCollection();
  const document = {
    geo: {
      type: 'Point',
      lat,
      lon,
      coordinates: [lon, lat],
    },
    walletAddress,
    timestamp,
  };

  const result = await collection.insertOne(document);
  return {
    insertedId: String(result.insertedId),
    miniNode: mapMiniNode({
      ...document,
      _id: result.insertedId,
    }),
  };
}

async function countMiniNodesInNeighborhood(input = {}) {
  const { lat, lon } = normalizeLatLon(input);
  const radiusMeters = normalizePositiveInt(
    input.radiusMeters ?? input.radius,
    DEFAULT_RADIUS_METERS,
    'radiusMeters',
  );
  const triggerThreshold = normalizePositiveInt(
    input.triggerThreshold ?? input.threshold,
    DEFAULT_TRIGGER_THRESHOLD,
    'triggerThreshold',
  );
  const neighborLimit = Math.min(
    normalizePositiveInt(
      input.neighborLimit ?? input.limit,
      DEFAULT_NEIGHBOR_LIMIT,
      'neighborLimit',
    ),
    MAX_NEIGHBOR_LIMIT,
  );

  const timestampFilter = buildTimeRangeFilter(input);
  const query = buildNeighborhoodQuery({
    lat,
    lon,
    radiusMeters,
    timestampFilter,
  });

  const collection = await getMiniNodeCollection();
  const [count, docs, aggregateRows] = await Promise.all([
    collection.countDocuments(query),
    collection
      .find(query, {
        projection: {
          geo: 1,
          walletAddress: 1,
          timestamp: 1,
        },
      })
      .sort({ timestamp: -1 })
      .limit(neighborLimit)
      .toArray(),
    collection
      .aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            pointCount: { $sum: 1 },
            avgLat: {
              $avg: {
                $ifNull: [
                  '$geo.lat',
                  { $arrayElemAt: ['$geo.coordinates', 1] },
                ],
              },
            },
            avgLon: {
              $avg: {
                $ifNull: [
                  '$geo.lon',
                  { $arrayElemAt: ['$geo.coordinates', 0] },
                ],
              },
            },
            wallets: {
              $addToSet: {
                $toLower: { $ifNull: ['$walletAddress', ''] },
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            pointCount: 1,
            avgLat: 1,
            avgLon: 1,
            uniqueWalletCount: {
              $size: {
                $filter: {
                  input: '$wallets',
                  as: 'wallet',
                  cond: {
                    $and: [
                      { $ne: ['$$wallet', null] },
                      { $ne: ['$$wallet', ''] },
                    ],
                  },
                },
              },
            },
          },
        },
      ])
      .toArray(),
  ]);

  const aggregate = Array.isArray(aggregateRows) ? aggregateRows[0] : null;
  const aggregateLat = toFiniteNumber(aggregate?.avgLat);
  const aggregateLon = toFiniteNumber(aggregate?.avgLon);
  const aggregatePointCount = toFiniteNumber(aggregate?.pointCount);

  const centroid =
    aggregateLat !== undefined &&
    aggregateLon !== undefined &&
    aggregatePointCount !== undefined &&
    aggregatePointCount > 0
      ? {
          lat: aggregateLat,
          lon: aggregateLon,
          pointCount: aggregatePointCount,
        }
      : computeCentroidFromDocuments(docs);

  const uniqueWalletCount =
    toFiniteNumber(aggregate?.uniqueWalletCount) ??
    new Set(
      docs.map((doc) =>
        doc.walletAddress ? doc.walletAddress.toLowerCase() : '',
      ),
    ).size;

  return {
    center: { lat, lon },
    radiusMeters,
    triggerThreshold,
    count,
    shouldTriggerProposal: count >= triggerThreshold,
    uniqueWalletCount,
    centroid,
    poiCandidate: centroid
      ? {
          lat: centroid.lat,
          lon: centroid.lon,
          geo: {
            type: 'Point',
            lat: centroid.lat,
            lon: centroid.lon,
          },
          source: 'requestedAreaCentroid',
          supportingMiniNodeCount: centroid.pointCount,
          neighborhoodCount: count,
        }
      : null,
    returnedNeighbors: docs.length,
    neighbors: docs.map(mapMiniNode),
    timeWindow: mapTimeWindow(timestampFilter),
  };
}

module.exports = {
  createMiniNode,
  countMiniNodesInNeighborhood,
};
