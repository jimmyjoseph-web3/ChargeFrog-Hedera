const http = require('http');
const { URL } = require('url');
const {
  createToken,
  createBond,
  mint,
  issue,
  getBalance,
} = require('./clients/atsClient');
const {
  runAgent,
  runFoundryAgent,
  runFoundryWorker,
  runStationFinderAgent,
  runInvestmentProposalGeneratorAgent,
  runStationAssetIssuerWorker,
} = require('./agent/core/orchestrator');
const { PUBLIC_A2A_AGENT_METADATA } = require('./http/publicAgentMetadata');
const {
  findPoiByArea,
  findChargingStationsByAvailability,
} = require('./clients/tomtomClient');
const {
  createMiniNode,
  countMiniNodesInNeighborhood,
} = require('./store/miniNodeStore');
const {
  listAvailableStations,
  getStationById,
} = require('./store/stationStore');

const PORT = Number(process.env.PORT || 8787);
const MILES_TO_METERS = 1609.344;
const BASE_URL = `http://localhost:${PORT}`;

function isTruthyEnvFlag(value) {
  return (
    String(value || '')
      .trim()
      .toLowerCase() === 'true'
  );
}

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
    if (normalized) {
      if (normalized === 'dev') return 'development';
      if (normalized === 'prod') return 'production';
      return normalized;
    }
  }

  return '';
}

const RUNTIME_ENV = resolveRuntimeEnvironment();

const ENABLE_TEST_API_ROUTES =
  process.env.ENABLE_TEST_API_ROUTES !== undefined
    ? isTruthyEnvFlag(process.env.ENABLE_TEST_API_ROUTES)
    : RUNTIME_ENV !== 'production';
const PUBLIC_WELL_KNOWN_ROUTES = Object.freeze(
  Object.values(PUBLIC_A2A_AGENT_METADATA).reduce((routes, agent) => {
    routes[agent.discoveryPath] = agent.key;
    routes[agent.agentCardPath] = agent.key;
    return routes;
  }, {}),
);

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, statusCode, payload) {
  setCorsHeaders(res);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(payload));
}

function sendJsonNoStore(res, statusCode, payload) {
  setCorsHeaders(res);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, statusCode, html) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function sendNoContent(res) {
  setCorsHeaders(res);
  res.writeHead(204);
  res.end();
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').trim();
  if (!rawBody) return {};

  try {
    return JSON.parse(rawBody);
  } catch (_error) {
    throw new Error('Body must be valid JSON');
  }
}

function looksLikeBadRequest(error) {
  const message = String(
    error && error.message ? error.message : '',
  ).toLowerCase();
  return (
    message.includes('unsupported fields') ||
    message.includes('required') ||
    message.includes('must be valid json') ||
    message.includes('stationid') ||
    message.includes('proposalid') ||
    message.includes('securityid') ||
    message.includes('amount') ||
    message.includes('startingdate') ||
    message.includes('maturitydate') ||
    message.includes('area') ||
    message.includes('lat/lon') ||
    message.includes('chargingavailabilityid') ||
    message.includes('walletaddress') ||
    message.includes('lat and lon') ||
    message.includes('radiusmeters') ||
    message.includes('timestamp') ||
    message.includes('mongodb') ||
    message.includes('stationname') ||
    message.includes('tokenid') ||
    message.includes('accountid') ||
    message.includes('privatekey') ||
    message.includes('registryaddress') ||
    message.includes('boltaddress') ||
    message.includes('stationmetadata') ||
    message.includes('totalinvestment') ||
    message.includes('totalshares') ||
    message.includes('projecturl') ||
    message.includes('nextid mismatch') ||
    message.includes('investmenttargethbarequivalent')
  );
}

function makeServerUrl(req) {
  const configuredPublicBaseUrl = String(
    process.env.FROGGY_PLANNER_PUBLIC_BASE_URL || '',
  )
    .trim()
    .replace(/\/$/, '');

  if (RUNTIME_ENV === 'production') {
    return configuredPublicBaseUrl || 'https://froggyplanner.onrender.com';
  }

  return BASE_URL;
}

async function handleApiRequest(req, res, handler) {
  try {
    const body = await readJsonBody(req);
    const data = await handler(body);
    return sendJson(res, 200, { ok: true, data });
  } catch (error) {
    const statusCode = looksLikeBadRequest(error) ? 400 : 500;
    return sendJson(res, statusCode, {
      ok: false,
      error: error && error.message ? error.message : 'Unexpected server error',
    });
  }
}

function queryParamOrUndefined(searchParams, key) {
  const value = searchParams.get(key);
  if (value === null || String(value).trim() === '') return undefined;
  return String(value).trim();
}

function queryNumberOrUndefined(searchParams, key) {
  const value = queryParamOrUndefined(searchParams, key);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(
    req.url || '/',
    `http://${req.headers.host || `localhost:${PORT}`}`,
  );
  const pathname =
    requestUrl.pathname === '/'
      ? '/'
      : requestUrl.pathname.replace(/\/+$/, '');

  if (req.method === 'OPTIONS') {
    return sendNoContent(res);
  }

  if (req.method === 'GET' && pathname === '/') {
    res.writeHead(302, { Location: '/docs' });
    res.end();
    return;
  }

  if (req.method === 'GET' && pathname === '/openapi.json') {
    const spec = buildOpenApiSpec(makeServerUrl(req), {
      includeTestingRoutes: ENABLE_TEST_API_ROUTES,
    });
    return sendJsonNoStore(res, 200, spec);
  }

  if (req.method === 'GET' && pathname === '/docs') {
    return sendHtml(res, 200, getDocsHtml());
  }

  if (req.method === 'GET' && PUBLIC_WELL_KNOWN_ROUTES[pathname]) {
    return sendJsonNoStore(
      res,
      200,
      buildAgentCard(makeServerUrl(req), PUBLIC_WELL_KNOWN_ROUTES[pathname]),
    );
  }

  if (
    req.method === 'POST' &&
    pathname === '/a2a/investment-proposal-generator'
  ) {
    if (!requireInternalA2aAccess(req, res)) return;
    return handleA2aEndpoint(req, res, {
      agentKey: 'investmentProposalGenerator',
      runner: runInvestmentProposalGeneratorAgent,
    });
  }

  if (req.method === 'POST' && pathname === '/a2a/station-asset-issuer') {
    if (!requireInternalA2aAccess(req, res)) return;
    return handleA2aEndpoint(req, res, {
      agentKey: 'stationAssetIssuer',
      runner: runStationAssetIssuerWorker,
    });
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'POST' &&
    pathname === '/api/contracts/deploy-station-bundle'
  ) {
    return handleApiRequest(req, res, deployStationBundle);
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'POST' &&
    pathname === '/api/createEquity'
  ) {
    return handleApiRequest(req, res, createToken);
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'POST' &&
    pathname === '/api/createBond'
  ) {
    return handleApiRequest(req, res, createBond);
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'POST' &&
    pathname === '/api/discovery/poi'
  ) {
    return handleApiRequest(req, res, findPoiByArea);
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'GET' &&
    pathname === '/api/discovery/poi'
  ) {
    try {
      const input = {
        area: queryParamOrUndefined(requestUrl.searchParams, 'area'),
        query:
          queryParamOrUndefined(requestUrl.searchParams, 'q') ||
          queryParamOrUndefined(requestUrl.searchParams, 'query'),
        lat: queryNumberOrUndefined(requestUrl.searchParams, 'lat'),
        lon: queryNumberOrUndefined(requestUrl.searchParams, 'lon'),
        radius: queryNumberOrUndefined(requestUrl.searchParams, 'radius'),
        limit: queryNumberOrUndefined(requestUrl.searchParams, 'limit'),
      };
      const data = await findPoiByArea(input);
      return sendJson(res, 200, { ok: true, data });
    } catch (error) {
      const statusCode = looksLikeBadRequest(error) ? 400 : 500;
      return sendJson(res, statusCode, {
        ok: false,
        error:
          error && error.message ? error.message : 'Unexpected server error',
      });
    }
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'POST' &&
    pathname === '/api/discovery/charging-stations'
  ) {
    return handleApiRequest(req, res, findChargingStationsByAvailability);
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'GET' &&
    pathname === '/api/ev/chargingAvailability'
  ) {
    try {
      const single =
        queryParamOrUndefined(
          requestUrl.searchParams,
          'chargingAvailabilityId',
        ) || queryParamOrUndefined(requestUrl.searchParams, 'id');
      const manyRaw =
        queryParamOrUndefined(
          requestUrl.searchParams,
          'chargingAvailabilityIds',
        ) || queryParamOrUndefined(requestUrl.searchParams, 'ids');

      const chargingAvailabilityIds = manyRaw
        ? manyRaw
            .split(',')
            .map((item) => String(item).trim())
            .filter((item) => item !== '')
        : undefined;

      const input = {
        chargingAvailabilityId: single,
        chargingAvailabilityIds,
      };
      const data = await findChargingStationsByAvailability(input);
      return sendJson(res, 200, { ok: true, data });
    } catch (error) {
      const statusCode = looksLikeBadRequest(error) ? 400 : 500;
      return sendJson(res, statusCode, {
        ok: false,
        error:
          error && error.message ? error.message : 'Unexpected server error',
      });
    }
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'POST' &&
    pathname === '/api/mini-nodes'
  ) {
    return handleApiRequest(req, res, createMiniNode);
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'POST' &&
    pathname === '/api/mini-nodes/neighborhood'
  ) {
    return handleApiRequest(req, res, countMiniNodesInNeighborhood);
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'GET' &&
    pathname === '/api/mini-nodes/neighborhood'
  ) {
    try {
      const radiusMiles = queryNumberOrUndefined(
        requestUrl.searchParams,
        'radiusMiles',
      );
      const radiusMeters =
        queryNumberOrUndefined(requestUrl.searchParams, 'radiusMeters') ||
        (Number.isFinite(radiusMiles)
          ? Math.trunc(radiusMiles * MILES_TO_METERS)
          : undefined);

      const input = {
        lat: queryNumberOrUndefined(requestUrl.searchParams, 'lat'),
        lon: queryNumberOrUndefined(requestUrl.searchParams, 'lon'),
        radiusMeters,
        triggerThreshold:
          queryNumberOrUndefined(requestUrl.searchParams, 'threshold') ||
          queryNumberOrUndefined(requestUrl.searchParams, 'triggerThreshold'),
        lookbackMinutes: queryNumberOrUndefined(
          requestUrl.searchParams,
          'lookbackMinutes',
        ),
        since: queryParamOrUndefined(requestUrl.searchParams, 'since'),
        until: queryParamOrUndefined(requestUrl.searchParams, 'until'),
      };

      const data = await countMiniNodesInNeighborhood(input);
      return sendJson(res, 200, { ok: true, data });
    } catch (error) {
      const statusCode = looksLikeBadRequest(error) ? 400 : 500;
      return sendJson(res, statusCode, {
        ok: false,
        error:
          error && error.message ? error.message : 'Unexpected server error',
      });
    }
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'GET' &&
    pathname === '/api/stations/available'
  ) {
    try {
      const data = await listAvailableStations();
      return sendJson(res, 200, { ok: true, data });
    } catch (error) {
      const statusCode = looksLikeBadRequest(error) ? 400 : 500;
      return sendJson(res, statusCode, {
        ok: false,
        error:
          error && error.message ? error.message : 'Unexpected server error',
      });
    }
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'GET' &&
    /^\/api\/stations\/[^/]+$/.test(pathname)
  ) {
    try {
      const stationIdRaw = pathname.split('/').pop();
      const stationId = Number(stationIdRaw);
      if (!Number.isFinite(stationId) || stationId <= 0) {
        throw new Error('stationId must be a positive integer');
      }
      const data = await getStationById(Math.trunc(stationId));
      return sendJson(res, 200, { ok: true, data });
    } catch (error) {
      const statusCode = looksLikeBadRequest(error) ? 400 : 500;
      return sendJson(res, statusCode, {
        ok: false,
        error:
          error && error.message ? error.message : 'Unexpected server error',
      });
    }
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'POST' &&
    pathname === '/api/mint'
  ) {
    return handleApiRequest(req, res, mint);
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'POST' &&
    pathname === '/api/issue'
  ) {
    return handleApiRequest(req, res, issue);
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'POST' &&
    pathname === '/api/balance'
  ) {
    return handleApiRequest(req, res, getBalance);
  }


  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'POST' &&
    pathname === '/api/guardian/mint'
  ) {
    return handleApiRequest(req, res, mintWithGuardian);
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'POST' &&
    pathname === '/api/guardian/agent/create-station-policies'
  ) {
    return handleApiRequest(req, res, guardianAdminTools.createStationPolicies);
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'POST' &&
    pathname === '/api/guardian/createPolicy'
  ) {
    return handleApiRequest(req, res, createPolicyWithGuardian);
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'POST' &&
    /^\/api\/guardian\/schemas\/push\/[^/]+$/.test(pathname)
  ) {
    try {
      const parts = pathname.split('/');
      const topicId = decodeURIComponent(String(parts[5] || '')).trim();
      const body = await readJsonBody(req);
      const data = await createSchemaWithGuardian({ topicId, ...body });
      return sendJson(res, 200, { ok: true, data });
    } catch (error) {
      const statusCode = looksLikeBadRequest(error) ? 400 : 500;
      return sendJson(res, statusCode, {
        ok: false,
        error:
          error && error.message ? error.message : 'Unexpected server error',
      });
    }
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'GET' &&
    pathname === '/api/guardian/policies'
  ) {
    try {
      const pageSize = queryNumberOrUndefined(
        requestUrl.searchParams,
        'pageSize',
      );
      const maxPages = queryNumberOrUndefined(
        requestUrl.searchParams,
        'maxPages',
      );
      const data = await listPoliciesWithGuardian({ pageSize, maxPages });
      return sendJson(res, 200, { ok: true, data });
    } catch (error) {
      const statusCode = looksLikeBadRequest(error) ? 400 : 500;
      return sendJson(res, statusCode, {
        ok: false,
        error:
          error && error.message ? error.message : 'Unexpected server error',
      });
    }
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'GET' &&
    /^\/api\/guardian\/schemas\/by-topic\/[^/]+$/.test(pathname)
  ) {
    try {
      const parts = pathname.split('/');
      const topicId = decodeURIComponent(String(parts[5] || '')).trim();
      const pageSize = queryNumberOrUndefined(
        requestUrl.searchParams,
        'pageSize',
      );
      const maxPages = queryNumberOrUndefined(
        requestUrl.searchParams,
        'maxPages',
      );
      const data = await listSchemasByTopicIdWithGuardian({
        topicId,
        pageSize,
        maxPages,
      });
      return sendJson(res, 200, { ok: true, data });
    } catch (error) {
      const statusCode = looksLikeBadRequest(error) ? 400 : 500;
      return sendJson(res, statusCode, {
        ok: false,
        error:
          error && error.message ? error.message : 'Unexpected server error',
      });
    }
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'GET' &&
    /^\/api\/guardian\/policies\/[^/]+$/.test(pathname)
  ) {
    try {
      const policyId = decodeURIComponent(
        String(pathname.split('/').pop() || ''),
      ).trim();
      const data = await getPolicyByIdWithGuardian({ policyId });
      return sendJson(res, 200, { ok: true, data });
    } catch (error) {
      const statusCode = looksLikeBadRequest(error) ? 400 : 500;
      return sendJson(res, statusCode, {
        ok: false,
        error:
          error && error.message ? error.message : 'Unexpected server error',
      });
    }
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'PUT' &&
    /^\/api\/guardian\/policies\/[^/]+\/publish-treasury$/.test(pathname)
  ) {
    try {
      const parts = pathname.split('/');
      const policyId = decodeURIComponent(String(parts[4] || '')).trim();
      const body = await readJsonBody(req);
      const data = await publishPolicyByIdWithGuardianTreasury({
        policyId,
        ...body,
      });
      return sendJson(res, 200, { ok: true, data });
    } catch (error) {
      const statusCode = looksLikeBadRequest(error) ? 400 : 500;
      return sendJson(res, statusCode, {
        ok: false,
        error:
          error && error.message ? error.message : 'Unexpected server error',
      });
    }
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'PUT' &&
    /^\/api\/guardian\/policies\/[^/]+\/publish$/.test(pathname)
  ) {
    try {
      const parts = pathname.split('/');
      const policyId = decodeURIComponent(String(parts[4] || '')).trim();
      const body = await readJsonBody(req);
      const data = await publishPolicyByIdWithGuardian({ policyId, ...body });
      return sendJson(res, 200, { ok: true, data });
    } catch (error) {
      const statusCode = looksLikeBadRequest(error) ? 400 : 500;
      return sendJson(res, statusCode, {
        ok: false,
        error:
          error && error.message ? error.message : 'Unexpected server error',
      });
    }
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'PUT' &&
    /^\/api\/guardian\/policies\/[^/]+$/.test(pathname)
  ) {
    try {
      const policyId = decodeURIComponent(
        String(pathname.split('/').pop() || ''),
      ).trim();
      const body = await readJsonBody(req);
      const data = await updatePolicyByIdWithGuardian({ policyId, ...body });
      return sendJson(res, 200, { ok: true, data });
    } catch (error) {
      const statusCode = looksLikeBadRequest(error) ? 400 : 500;
      return sendJson(res, statusCode, {
        ok: false,
        error:
          error && error.message ? error.message : 'Unexpected server error',
      });
    }
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'POST' &&
    pathname === '/api/guardian/wipe'
  ) {
    return handleApiRequest(req, res, wipeWithGuardian);
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'POST' &&
    pathname === '/api/guardian/token-associate'
  ) {
    return handleApiRequest(req, res, associateTokenWithHederaSdk);
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'POST' &&
    pathname === '/api/agent/froggy-planner'
  ) {
    return handleApiRequest(req, res, runAgent);
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'POST' &&
    pathname === '/api/agent/froggy-foundry'
  ) {
    return handleApiRequest(req, res, runFoundryAgent);
  }

  if (
    !ENABLE_TEST_API_ROUTES &&
    pathname.startsWith('/api/') &&
    pathname !== '/api/openapi.json'
  ) {
    return sendJson(res, 404, {
      ok: false,
      error:
        '',
    });
  }

  return sendJson(res, 404, { ok: false, error: 'Route not found' });
});

server.listen(PORT, () => {
  console.log(`froggy-planner API listening on http://localhost:${PORT}`);
});
