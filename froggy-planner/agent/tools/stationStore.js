const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const DEFAULT_DB_NAME = 'froggy_planner';
const DEFAULT_PROPOSALS_COLLECTION = 'station_proposals';
const DEFAULT_STATIONS_COLLECTION = 'stations';
const DEFAULT_AUDIT_COLLECTION = 'agent_audit';
const DEFAULT_MINIMUM_STATION_ID = 8;

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

function normalizeStationId(value) {
  const parsed = toFiniteNumber(value);
  if (parsed === undefined) return undefined;
  const truncated = Math.trunc(parsed);
  if (truncated <= 0) {
    throw new Error('stationId must be a positive integer');
  }
  return truncated;
}

function normalizeLatLon(value, label) {
  if (!value || typeof value !== 'object') {
    throw new Error(`${label} must include lat and lon`);
  }
  const lat = toFiniteNumber(value.lat);
  const lon = toFiniteNumber(value.lon);
  if (lat === undefined || lon === undefined) {
    throw new Error(`${label} must include valid lat and lon`);
  }
  if (lat < -90 || lat > 90) {
    throw new Error(`${label}.lat must be between -90 and 90`);
  }
  if (lon < -180 || lon > 180) {
    throw new Error(`${label}.lon must be between -180 and 180`);
  }
  return { lat, lon };
}

function normalizePricing(value) {
  const source = value && typeof value === 'object' ? value : {};
  const equityPrice = toFiniteNumber(source.equityPriceHbar);
  const bondPrice = toFiniteNumber(source.bondPriceHbar);
  return {
    equityPriceHbar:
      equityPrice !== undefined && equityPrice > 0 ? equityPrice : 1,
    bondPriceHbar: bondPrice !== undefined && bondPrice > 0 ? bondPrice : 1,
  };
}

function normalizeRadiusMeters(value, fallback, label = 'radiusMeters') {
  const parsed = toFiniteNumber(value);
  const resolved = parsed !== undefined ? parsed : fallback;
  const normalized = Math.trunc(Number(resolved));
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error(`${label} must be greater than 0`);
  }
  return normalized;
}

function resolveMinimumStationId() {
  return normalizeRadiusMeters(
    envValue('MINIMUM_STATION_ID', 'STATION_ID_START_AT'),
    DEFAULT_MINIMUM_STATION_ID,
    'MINIMUM_STATION_ID',
  );
}

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function calculateDistanceMeters(from, to) {
  const earthRadiusMeters = 6371000;
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLat = lat2 - lat1;
  const deltaLon = toRadians(to.lon - from.lon);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function buildLatLonBounds(location, radiusMeters) {
  const latDelta = radiusMeters / 111320;
  const lonDelta =
    radiusMeters /
    (111320 * Math.max(Math.cos(toRadians(location.lat)), 0.000001));
  return {
    minLat: location.lat - latDelta,
    maxLat: location.lat + latDelta,
    minLon: location.lon - lonDelta,
    maxLon: location.lon + lonDelta,
  };
}

async function findNearestStationDocument(stations, location, radiusMeters) {
  const bounds = buildLatLonBounds(location, radiusMeters);
  const candidates = await stations
    .find({
      lat: { $gte: bounds.minLat, $lte: bounds.maxLat },
      lon: { $gte: bounds.minLon, $lte: bounds.maxLon },
    })
    .limit(250)
    .toArray();

  let best = null;
  for (const candidate of candidates) {
    const candidateLat = toFiniteNumber(candidate.lat);
    const candidateLon = toFiniteNumber(candidate.lon);
    if (candidateLat === undefined || candidateLon === undefined) continue;
    const distanceMeters = calculateDistanceMeters(location, {
      lat: candidateLat,
      lon: candidateLon,
    });
    if (distanceMeters > radiusMeters) continue;
    if (!best || distanceMeters < best.distanceMeters) {
      best = { station: candidate, distanceMeters };
    }
  }
  return best;
}

function normalizeMongoError(error) {
  if (error instanceof Error) return error;
  return new Error(String(error));
}

function normalizeStationName(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const cleaned = raw
    .replace(/^chargefrog\s+station\s*-\s*/i, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\w\s,&/-]/g, ' ')
    .replace(
      /\b(?:wikipedia|wikidata|official\s+site|official|tripadvisor|yelp|glossary|tabulation|neighborhood\s+tabulation\s+area|nyc\s*dcp|pdf)\b/gi,
      ' ',
    )
    .replace(/\b\d{4}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[,\s-]+|[,\s-]+$/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join(' ');
  if (!cleaned) return null;
  return `ChargeFrog Station - ${cleaned}`;
}

function toPositiveWholeNumberOrNull(value) {
  const parsed = toFiniteNumber(value);
  if (parsed === undefined || parsed <= 0) return null;
  return Math.trunc(parsed);
}

function normalizeSecurityIdValue(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' || typeof value === 'number') {
    const raw = String(value).trim();
    if (!raw) return null;
    if (/^\d+\.\d+\.\d+$/.test(raw) || /^0x[a-fA-F0-9]{40}$/.test(raw)) {
      return raw;
    }
    return null;
  }
  if (typeof value !== 'object') return null;

  const keys = [
    'value',
    'securityId',
    'tokenAddress',
    'diamondAddress',
    'evmDiamondAddress',
    'id',
    'address',
  ];
  for (const key of keys) {
    if (!(key in value)) continue;
    const nested = normalizeSecurityIdValue(value[key]);
    if (nested) return nested;
  }
  return null;
}

function normalizeIpfsGatewayBase(baseUrl) {
  const value = String(baseUrl || '').trim();
  if (!value) return '';
  return value.endsWith('/') ? value : `${value}/`;
}

function deriveStationStageForProposalStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'issued') return 'investment';
  if (normalized === 'approved') return 'approval';
  if (
    normalized === 'pending-admin-approval' ||
    normalized === 'pending-admin-action'
  ) {
    return 'pending-admin-action';
  }
  return 'proposal';
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
    proposalsCollection:
      envValue('MONGODB_PROPOSALS_COLLECTION') || DEFAULT_PROPOSALS_COLLECTION,
    stationsCollection:
      envValue('MONGODB_STATIONS_COLLECTION') || DEFAULT_STATIONS_COLLECTION,
    auditCollection:
      envValue('MONGODB_AUDIT_COLLECTION') || DEFAULT_AUDIT_COLLECTION,
  };
}

let collectionsPromise;

async function getCollections() {
  if (collectionsPromise) {
    return collectionsPromise;
  }

  collectionsPromise = (async () => {
    const { MongoClient } = getMongoRuntime();
    const config = getMongoConfig();
    const client = new MongoClient(config.uri);
    await client.connect();

    const db = client.db(config.dbName);
    const proposals = db.collection(config.proposalsCollection);
    const stations = db.collection(config.stationsCollection);
    const audit = db.collection(config.auditCollection);

    await Promise.all([
      proposals.createIndex({ proposalId: 1 }, { unique: true }),
      proposals.createIndex({ stationId: 1 }),
      proposals.createIndex({ status: 1 }),
      proposals.createIndex({ metadataUri: 1 }),
      proposals.createIndex({ createdAt: -1 }),
      stations.createIndex({ stationId: 1 }, { unique: true }),
      stations.createIndex({ proposalId: 1 }),
      stations.createIndex({ stage: 1 }),
      stations.createIndex({ updatedAt: -1 }),
      audit.createIndex({ correlationId: 1 }),
      audit.createIndex({ createdAt: -1 }),
    ]);

    return {
      proposals,
      stations,
      audit,
    };
  })().catch((error) => {
    collectionsPromise = undefined;
    throw normalizeMongoError(error);
  });

  return collectionsPromise;
}

function randomId(prefix) {
  const raw = crypto.randomBytes(5).toString('hex');
  return `${prefix}_${Date.now()}_${raw}`;
}

async function allocateStationId(stations, requestedStationId) {
  const minimumStationId = resolveMinimumStationId();
  const explicit = normalizeStationId(requestedStationId);
  if (explicit !== undefined) {
    if (explicit < minimumStationId) {
      throw new Error(`stationId must be >= ${minimumStationId}`);
    }
    return explicit;
  }

  const latest = await stations
    .find({}, { projection: { stationId: 1 } })
    .sort({ stationId: -1 })
    .limit(1)
    .toArray();

  const current =
    Array.isArray(latest) && latest[0]
      ? normalizeStationId(latest[0].stationId)
      : undefined;
  return Math.max((current || 0) + 1, minimumStationId);
}

function mapProposal(document) {
  if (!document) return null;
  return {
    proposalId: document.proposalId || null,
    stationId: normalizeStationId(document.stationId) || null,
    stationName: document.stationName || null,
    title: document.title || null,
    description: document.description || null,
    status: document.status || null,
    metadataUri: document.metadataUri || null,
    location: document.location || null,
    cap: document.cap ?? null,
    shares: document.shares ?? null,
    pricing: document.pricing || null,
    parameters: document.parameters || {},
    metadata: document.metadata || {},
    onChain: document.onChain || null,
    txHash: document.txHash || null,
    createdAt:
      document.createdAt instanceof Date
        ? document.createdAt.toISOString()
        : document.createdAt || null,
    approvedAt:
      document.approvedAt instanceof Date
        ? document.approvedAt.toISOString()
        : document.approvedAt || null,
    issuedAt:
      document.issuedAt instanceof Date
        ? document.issuedAt.toISOString()
        : document.issuedAt || null,
    assets: document.assets || null,
  };
}

function mapStation(document) {
  if (!document) return null;
  return {
    stationId: normalizeStationId(document.stationId) || null,
    stationName: document.stationName || null,
    stage: document.stage || null,
    proposalId: document.proposalId || null,
    lat: toFiniteNumber(document.lat) ?? null,
    lon: toFiniteNumber(document.lon) ?? null,
    location: document.location || null,
    poiId: document.poiId || null,
    chargingAvailabilityId: document.chargingAvailabilityId || null,
    connectors: document.connectors ?? null,
    powerKW: document.powerKW ?? null,
    availability: document.availability || null,
    pricing: document.pricing || null,
    cap: document.cap ?? null,
    shares: document.shares ?? null,
    equityTokenAddress: normalizeSecurityIdValue(document.equityTokenAddress),
    equityIsin: document.equityIsin || null,
    bondTokenAddress: normalizeSecurityIdValue(document.bondTokenAddress),
    bondIsin: document.bondIsin || null,
    metadataUri: document.metadataUri || null,
    proposalTxHash: document.proposalTxHash || null,
    proposalOnChainId: document.proposalOnChainId || null,
    proposalTopicId: document.proposalTopicId || null,
    proposalTopicSequenceNumber: toPositiveWholeNumberOrNull(
      document.proposalTopicSequenceNumber,
    ),
    metadata: document.metadata || {},
    updatedAt:
      document.updatedAt instanceof Date
        ? document.updatedAt.toISOString()
        : document.updatedAt || null,
    createdAt:
      document.createdAt instanceof Date
        ? document.createdAt.toISOString()
        : document.createdAt || null,
  };
}

async function createInvestmentProposalRecord(input = {}) {
  const title = String(input.title || '').trim();
  const description = String(input.description || '').trim();
  if (!title) throw new Error('title is required');
  if (!description) throw new Error('description is required');

  const location = normalizeLatLon(input.location, 'location');
  const metadata =
    input.metadata && typeof input.metadata === 'object' ? input.metadata : {};
  const parameters =
    input.parameters && typeof input.parameters === 'object'
      ? input.parameters
      : {};
  const stationName = normalizeStationName(
    input.stationName ||
      metadata.stationName ||
      metadata.proposedStationName ||
      parameters.stationName,
  );

  const cap = input.cap ?? metadata.cap ?? parameters.cap ?? null;
  const shares = input.shares ?? metadata.shares ?? parameters.shares ?? null;
  const pricing = normalizePricing(metadata.pricing || parameters.pricing);

  const { proposals, stations } = await getCollections();
  const allowDuplicateAreas =
    String(
      envValue(
        'ALLOW_DUPLICATE_STATION_AREAS',
        'STATION_ALLOW_DUPLICATE_AREAS',
      ) || 'false',
    )
      .trim()
      .toLowerCase() === 'true';
  const duplicateRadiusMeters = normalizeRadiusMeters(
    envValue('STATION_DUPLICATE_RADIUS_METERS'),
    1000,
    'STATION_DUPLICATE_RADIUS_METERS',
  );

  if (!allowDuplicateAreas) {
    const existing = await findNearestStationDocument(
      stations,
      location,
      duplicateRadiusMeters,
    );
    if (existing?.station) {
      const existingStation = mapStation(existing.station);
      throw new Error(
        `A station already exists within ${duplicateRadiusMeters} meters (stationId: ${existingStation.stationId}, stage: ${existingStation.stage}).`,
      );
    }
  }

  const stationId = await allocateStationId(stations, input.stationId);
  const proposalId = String(input.proposalId || randomId('proposal'));
  const metadataUri = String(
    input.metadataUri || `db://proposals/${proposalId}`,
  );
  const status = String(input.status || 'pending-admin-approval').toLowerCase();
  const createdAt = new Date();

  const proposalDocument = {
    proposalId,
    stationId,
    stationName,
    title,
    description,
    status,
    metadataUri,
    location,
    cap,
    shares,
    pricing,
    metadata,
    parameters,
    onChain:
      input.onChain && typeof input.onChain === 'object' ? input.onChain : null,
    txHash: input.txHash ? String(input.txHash) : null,
    createdAt,
    approvedAt: null,
    issuedAt: null,
    assets: null,
  };

  await proposals.insertOne(proposalDocument);

  const stationDocument = {
    stationId,
    stationName,
    stage: deriveStationStageForProposalStatus(status),
    proposalId,
    location,
    lat: location.lat,
    lon: location.lon,
    poiId: metadata.poiId || null,
    chargingAvailabilityId: metadata.chargingAvailabilityId || null,
    connectors: metadata.connectors ?? null,
    powerKW: metadata.powerKW ?? null,
    availability: metadata.availability || null,
    pricing,
    cap,
    shares,
    equityTokenAddress: null,
    equityIsin: null,
    bondTokenAddress: null,
    bondIsin: null,
    metadataUri,
    proposalTxHash: input.txHash ? String(input.txHash) : null,
    proposalOnChainId:
      input.onChain && typeof input.onChain === 'object'
        ? input.onChain.onChainProposalId || null
        : null,
    proposalTopicId:
      input.onChain && typeof input.onChain === 'object'
        ? input.onChain?.raw?.topicId || null
        : null,
    proposalTopicSequenceNumber:
      input.onChain && typeof input.onChain === 'object'
        ? toPositiveWholeNumberOrNull(input.onChain?.raw?.topicSequenceNumber)
        : null,
    createdAt,
    updatedAt: createdAt,
  };

  await stations.updateOne(
    { stationId },
    { $setOnInsert: stationDocument },
    { upsert: true },
  );

  return mapProposal(proposalDocument);
}

async function updateProposalOnChainRecord(input = {}) {
  const proposalId = String(input.proposalId || '').trim();
  if (!proposalId) {
    throw new Error('proposalId is required');
  }

  const patch = {
    updatedAt: new Date(),
  };

  if (input.txHash !== undefined) {
    patch.txHash = input.txHash ? String(input.txHash) : null;
  }

  if (input.onChain !== undefined) {
    patch.onChain =
      input.onChain && typeof input.onChain === 'object' ? input.onChain : null;
  }

  if (input.metadataUri !== undefined) {
    patch.metadataUri = input.metadataUri ? String(input.metadataUri) : null;
  }

  if (input.metadata !== undefined) {
    patch.metadata =
      input.metadata && typeof input.metadata === 'object'
        ? input.metadata
        : {};
  }

  const { proposals, stations } = await getCollections();
  const updated = await proposals.findOneAndUpdate(
    { proposalId },
    { $set: patch },
    { returnDocument: 'after' },
  );
  const proposal = updated?.value || updated;
  if (!proposal) {
    throw new Error(`proposalId not found: ${proposalId}`);
  }

  const hasStationAnchorUpdate =
    input.metadataUri !== undefined ||
    input.txHash !== undefined ||
    input.onChain !== undefined;
  if (hasStationAnchorUpdate && proposal.stationId) {
    const onChainRaw =
      patch.onChain && typeof patch.onChain === 'object'
        ? patch.onChain.raw || {}
        : {};
    const resolvedTxHash =
      patch.txHash !== undefined
        ? patch.txHash
        : typeof onChainRaw.transactionId === 'string'
          ? onChainRaw.transactionId
          : null;

    const stationPatch = {
      updatedAt: new Date(),
    };
    if (input.metadataUri !== undefined) {
      stationPatch.metadataUri = patch.metadataUri ?? null;
    }
    if (input.txHash !== undefined || input.onChain !== undefined) {
      stationPatch.proposalTxHash = resolvedTxHash;
    }
    if (input.onChain !== undefined) {
      stationPatch.proposalOnChainId = patch.onChain?.onChainProposalId || null;
      stationPatch.proposalTopicId =
        typeof onChainRaw.topicId === 'string' ? onChainRaw.topicId : null;
      stationPatch.proposalTopicSequenceNumber = toPositiveWholeNumberOrNull(
        onChainRaw.topicSequenceNumber,
      );
    }

    await stations.updateOne(
      { stationId: proposal.stationId },
      {
        $set: stationPatch,
      },
    );
  }

  return mapProposal(proposal);
}

async function getProposalRecord(proposalId) {
  const normalizedProposalId = String(proposalId || '').trim();
  if (!normalizedProposalId) {
    throw new Error('proposalId is required');
  }

  const { proposals } = await getCollections();
  const proposal = await proposals.findOne({
    proposalId: normalizedProposalId,
  });
  if (!proposal) {
    throw new Error(`proposalId not found: ${normalizedProposalId}`);
  }
  return mapProposal(proposal);
}

async function readMetadataByUri(metadataUri) {
  const uri = String(metadataUri || '').trim();
  if (!uri) {
    throw new Error('metadataUri is required');
  }

  const match = uri.match(/^db:\/\/proposals\/(.+)$/i);
  if (match) {
    const proposal = await getProposalRecord(match[1]);
    return {
      cap: proposal.cap,
      shares: proposal.shares,
      pricing: proposal.pricing,
      proposalPayload: proposal.metadata?.proposalPayload || null,
      stationDetails: {
        stationId: proposal.stationId,
        stationName: proposal.stationName || null,
        location: proposal.location,
        metadata: proposal.metadata || {},
        parameters: proposal.parameters || {},
      },
    };
  }

  const { proposals } = await getCollections();
  const proposalByUri = await proposals.findOne({ metadataUri: uri });
  if (proposalByUri) {
    const proposal = mapProposal(proposalByUri);
    return {
      cap: proposal.cap,
      shares: proposal.shares,
      pricing: proposal.pricing,
      proposalPayload: proposal.metadata?.proposalPayload || null,
      stationDetails: {
        stationId: proposal.stationId,
        stationName: proposal.stationName || null,
        location: proposal.location,
        metadata: proposal.metadata || {},
        parameters: proposal.parameters || {},
      },
    };
  }

  const isIpfsUri = uri.startsWith('ipfs://');
  const isHttpUri = /^https?:\/\//i.test(uri);
  if (!isIpfsUri && !isHttpUri) {
    throw new Error(
      `Unsupported metadataUri: ${uri}. Expected db://proposals/{proposalId}, ipfs://CID, or https:// URL`,
    );
  }

  let fetchUrl = uri;
  if (isIpfsUri) {
    const cidAndPath = uri.slice('ipfs://'.length).replace(/^\/+/, '');
    const gatewayBase = normalizeIpfsGatewayBase(
      envValue('PINATA_GATEWAY_URL') || 'https://gateway.pinata.cloud/ipfs/',
    );
    fetchUrl = `${gatewayBase}${cidAndPath}`;
  }

  const response = await fetch(fetchUrl);
  if (!response.ok) {
    throw new Error(`Unable to fetch IPFS metadata (${response.status})`);
  }
  const payload = await response.json();

  const proposalPart =
    payload?.proposal && typeof payload.proposal === 'object'
      ? payload.proposal
      : {};
  const metadataPart =
    payload?.proposalPayload && typeof payload.proposalPayload === 'object'
      ? payload.proposalPayload
      : payload;
  const pricingFromPayload =
    proposalPart?.pricing && typeof proposalPart.pricing === 'object'
      ? proposalPart.pricing
      : metadataPart?.pricing && typeof metadataPart.pricing === 'object'
        ? metadataPart.pricing
        : {};

  const stationId =
    normalizeStationId(proposalPart.stationId) ||
    normalizeStationId(metadataPart?.tokenizationInvestmentTerms?.stationId) ||
    null;
  const location =
    proposalPart?.location && typeof proposalPart.location === 'object'
      ? proposalPart.location
      : metadataPart?.locationInfrastructure?.exactCoordinates || null;

  return {
    cap:
      proposalPart.cap ??
      metadataPart?.tokenizationInvestmentTerms?.hardCap ??
      null,
    shares:
      proposalPart.shares ??
      metadataPart?.tokenizationInvestmentTerms?.totalSupply?.equityShares ??
      null,
    pricing: normalizePricing(pricingFromPayload),
    proposalPayload: metadataPart || null,
    stationDetails: {
      stationId,
      stationName:
        proposalPart.stationName ||
        metadataPart?.tokenizationInvestmentTerms?.stationName ||
        null,
      location,
      metadata: proposalPart.metadata || payload || {},
      parameters: proposalPart.parameters || {},
    },
  };
}

async function saveIssuedAssets(input = {}) {
  const proposalId = String(input.proposalId || '').trim();
  const stationId = normalizeStationId(input.stationId);
  if (!proposalId) {
    throw new Error('proposalId is required');
  }
  if (!stationId) {
    throw new Error('stationId is required');
  }

  const issuedAt = new Date();
  const pricing = normalizePricing(input.pricing);
  const equity =
    input.equity && typeof input.equity === 'object' ? input.equity : {};
  const bond = input.bond && typeof input.bond === 'object' ? input.bond : {};
  const suppliedMetadata =
    input.metadata && typeof input.metadata === 'object' ? input.metadata : {};

  const { proposals, stations } = await getCollections();
  await proposals.updateOne(
    { proposalId },
    {
      $set: {
        status: 'issued',
        issuedAt,
        assets: {
          equity,
          bond,
        },
      },
    },
  );

  const existingStation = await stations.findOne({ stationId });
  const existingMetadata =
    existingStation?.metadata && typeof existingStation.metadata === 'object'
      ? existingStation.metadata
      : {};

  const mergedMetadata = {
    ...existingMetadata,
    ...suppliedMetadata,
    issuedAssets: {
      proposalId,
      metadataUri:
        input.metadataUri ||
        existingMetadata?.issuedAssets?.metadataUri ||
        null,
      issuedAt: issuedAt.toISOString(),
      equity: {
        tokenAddress: normalizeSecurityIdValue(equity.tokenAddress),
        txHash: equity.txHash || null,
        isin: equity.isin || equity.isin_number || null,
        symbol: equity.symbol || null,
        name: equity.name || null,
        supply: equity.supply ?? null,
        metadata:
          equity.metadata && typeof equity.metadata === 'object'
            ? equity.metadata
            : null,
      },
      bond: {
        tokenAddress: normalizeSecurityIdValue(bond.tokenAddress),
        txHash: bond.txHash || null,
        isin: bond.isin || bond.isin_number || null,
        symbol: bond.symbol || null,
        name: bond.name || null,
        supply: bond.supply ?? null,
        metadata:
          bond.metadata && typeof bond.metadata === 'object'
            ? bond.metadata
            : null,
      },
    },
  };

  await stations.updateOne(
    { stationId },
    {
      $set: {
        stage: 'investment',
        proposalId,
        pricing,
        cap: input.cap ?? null,
        shares: input.shares ?? null,
        equityTokenAddress: normalizeSecurityIdValue(equity.tokenAddress),
        equityIsin: equity.isin || equity.isin_number || null,
        bondTokenAddress: normalizeSecurityIdValue(bond.tokenAddress),
        bondIsin: bond.isin || bond.isin_number || null,
        metadataUri: input.metadataUri || null,
        metadata: mergedMetadata,
        updatedAt: issuedAt,
      },
      $setOnInsert: {
        stationId,
        createdAt: issuedAt,
      },
    },
    { upsert: true },
  );

  const station = await stations.findOne({ stationId });
  return mapStation(station);
}

async function saveStationDeployment(input = {}) {
  const proposalId = String(input.proposalId || '').trim();
  const stationId = normalizeStationId(input.stationId);
  if (!proposalId) {
    throw new Error('proposalId is required');
  }
  if (!stationId) {
    throw new Error('stationId is required');
  }

  const deployedAt = new Date();
  const deployment =
    input.deployment && typeof input.deployment === 'object'
      ? input.deployment
      : {};

  const { proposals, stations } = await getCollections();
  const existingProposal = await proposals.findOne(
    { proposalId },
    { projection: { metadata: 1 } },
  );
  const existingStation = await stations.findOne({ stationId });
  const existingMetadata =
    existingStation?.metadata && typeof existingStation.metadata === 'object'
      ? existingStation.metadata
      : {};
  const existingProposalMetadata =
    existingProposal?.metadata && typeof existingProposal.metadata === 'object'
      ? existingProposal.metadata
      : {};

  const mergedDeployment = {
    ...(existingMetadata.deployment &&
    typeof existingMetadata.deployment === 'object'
      ? existingMetadata.deployment
      : {}),
    ...deployment,
    deployedAt: deployedAt.toISOString(),
  };

  const mergedMetadata = {
    ...existingMetadata,
    deployment: mergedDeployment,
  };

  await proposals.updateOne(
    { proposalId },
    {
      $set: {
        metadata: {
          ...existingProposalMetadata,
          deployment: mergedDeployment,
        },
      },
    },
  );

  await stations.updateOne(
    { stationId },
    {
      $set: {
        proposalId,
        stage: existingStation?.stage || 'pending-admin-action',
        metadata: mergedMetadata,
        metadataUri:
          input.metadataUri !== undefined
            ? input.metadataUri || null
            : existingStation?.metadataUri || null,
        updatedAt: deployedAt,
      },
      $setOnInsert: {
        stationId,
        createdAt: deployedAt,
      },
    },
    { upsert: true },
  );

  const station = await stations.findOne({ stationId });
  return mapStation(station);
}

async function listAvailableStations() {
  const { stations } = await getCollections();
  const docs = await stations
    .find({
      $or: [
        { stage: 'investment' },
        { equityTokenAddress: { $exists: true, $ne: null } },
        { bondTokenAddress: { $exists: true, $ne: null } },
      ],
    })
    .sort({ updatedAt: -1 })
    .limit(100)
    .toArray();

  return docs.map(mapStation);
}

async function listAllStations() {
  const { stations } = await getCollections();
  const docs = await stations
    .find({})
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(200)
    .toArray();

  return docs.map(mapStation);
}

async function listStationsByStage(stage) {
  const normalizedStage = String(stage || '').trim();
  if (!normalizedStage) {
    throw new Error('stage is required');
  }

  const { stations } = await getCollections();
  const docs = await stations
    .find({ stage: normalizedStage })
    .sort({ updatedAt: -1 })
    .limit(200)
    .toArray();

  return docs.map(mapStation);
}

async function findStationByLocation(input = {}) {
  const location = normalizeLatLon(input.location, 'location');
  const radiusMeters = normalizeRadiusMeters(
    input.radiusMeters,
    normalizeRadiusMeters(envValue('STATION_DUPLICATE_RADIUS_METERS'), 1000),
    'radiusMeters',
  );

  const { stations } = await getCollections();
  const nearest = await findNearestStationDocument(
    stations,
    location,
    radiusMeters,
  );
  if (!nearest?.station) return null;

  const mapped = mapStation(nearest.station);
  return {
    ...mapped,
    distanceMeters: Math.round(nearest.distanceMeters),
    radiusMeters,
  };
}

async function getStationById(stationId) {
  const normalized = normalizeStationId(stationId);
  if (!normalized) {
    throw new Error('stationId is required');
  }

  const { stations } = await getCollections();
  const station = await stations.findOne({ stationId: normalized });
  if (!station) {
    throw new Error(`stationId not found: ${normalized}`);
  }
  return mapStation(station);
}

async function getStationByProposalId(proposalId) {
  const normalizedProposalId = String(proposalId || '').trim();
  if (!normalizedProposalId) {
    throw new Error('proposalId is required');
  }

  const { stations } = await getCollections();
  const station = await stations.findOne({ proposalId: normalizedProposalId });
  if (!station) {
    throw new Error(`proposalId not found in stations: ${normalizedProposalId}`);
  }
  return mapStation(station);
}

async function appendAuditLog(entry = {}) {
  const payload = entry && typeof entry === 'object' ? entry : {};
  const { audit } = await getCollections();
  const createdAt = new Date();
  const document = {
    correlationId: payload.correlationId || null,
    action: payload.action || 'unknown_action',
    actor: payload.actor || null,
    status: payload.status || 'ok',
    proposalId: payload.proposalId || null,
    stationId: normalizeStationId(payload.stationId) || null,
    txHash: payload.txHash || null,
    details: payload.details || {},
    createdAt,
  };
  await audit.insertOne(document);
  return {
    ...document,
    createdAt: createdAt.toISOString(),
  };
}

module.exports = {
  createInvestmentProposalRecord,
  getProposalRecord,
  readMetadataByUri,
  saveIssuedAssets,
  saveStationDeployment,
  findStationByLocation,
  listAvailableStations,
  listAllStations,
  listStationsByStage,
  getStationById,
  getStationByProposalId,
  appendAuditLog,
  updateProposalOnChainRecord,
};
