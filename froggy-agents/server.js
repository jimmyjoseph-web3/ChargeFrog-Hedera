const fs = require('fs/promises');
const http = require('http');
const path = require('path');
const { URL } = require('url');
const {
  createToken,
  createBond,
  mint,
  issue,
  getBalance,
} = require('./clients/atsClient');
const {
  deployStationBundle,
} = require('./clients/stationContractsClient');
const { buildOpenApiSpec, getDocsHtml } = require('./http/openapi');
const { buildWorkflowOpenApiSpec } = require('./http/workflowOpenapi');
const { buildAgentCard, handleA2aJsonRpc } = require('./http/a2a');
const {
  runAgent,
  runFoundryAgent,
  runFoundryWorker,
  runStationFinderAgent,
  runInvestmentProposalGeneratorAgent,
  runStationAssetIssuerWorker,
} = require('./agent/core/orchestrator');
const { runRouterAgent } = require('./router/agent');
const { applyAgentTrail } = require('./lib/workflowTrail');
const {
  INTERNAL_A2A_HEADER,
  isInternalA2aAuthorized,
} = require('./http/internalA2a');
const { PUBLIC_A2A_AGENT_METADATA } = require('./http/publicAgentMetadata');
const {
  findPoiByArea,
  findChargingStationsByAvailability,
} = require('./clients/tomtomClient');
const {
  createPolicyWithGuardian,
  createSchemaWithGuardian,
  listPoliciesWithGuardian,
  listSchemasByTopicIdWithGuardian,
  getPolicyByIdWithGuardian,
  updatePolicyByIdWithGuardian,
  publishPolicyByIdWithGuardian,
  publishPolicyByIdWithGuardianTreasury,
  mintWithGuardian,
  wipeWithGuardian,
  associateTokenWithHederaSdk,
} = require('./clients/guardianClient');
const {
  runGuardianChatAgent,
  runGuardianPolicySummarizerAgent,
  runGuardianPolicyCreatorAgent,
} = require('./guardian/chatAgent');
const { guardianAdminTools } = require('./guardian/adminTools');
const {
  createMiniNode,
  countMiniNodesInNeighborhood,
} = require('./store/miniNodeStore');
const {
  listAvailableStations,
  getStationById,
} = require('./store/stationStore');
const {
  serializeError: serializeBrokerWorkflowError,
  resolveAgent: resolveBrokerWorkflowAgent,
  callAgent: callBrokerWorkflowAgent,
  runWorkflow: runBrokerWorkflow,
} = require('./hol/workflow');

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
const PUBLIC_IMAGE_ROUTES = Object.freeze(
  Object.values(PUBLIC_A2A_AGENT_METADATA).reduce((routes, agent) => {
    if (!agent.profileImagePath || !agent.profileImageFile) {
      return routes;
    }

    routes[agent.profileImagePath] = {
      filePath: path.resolve(__dirname, 'docs', agent.profileImageFile),
      contentType: 'image/png',
    };
    return routes;
  }, {}),
);

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    `Content-Type, ${INTERNAL_A2A_HEADER}`,
  );
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

async function sendFile(res, statusCode, filePath, contentType) {
  setCorsHeaders(res);
  const body = await fs.readFile(filePath);
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=300',
  });
  res.end(body);
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
    message.includes('requires') ||
    message.includes('must be valid json') ||
    message.includes('unknown agent') ||
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
    message.includes('policyid') ||
    message.includes('blockuuid') ||
    message.includes('policytag') ||
    message.includes('policyversion') ||
    message.includes('topicid') ||
    message.includes('categories') ||
    message.includes('schema') ||
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
    message.includes('investmenttargethbarequivalent') ||
    message.includes('guardian')
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

async function runPlannerApi(body) {
  return applyAgentTrail('planner', await runAgent(body));
}

async function runFoundryApi(body) {
  return applyAgentTrail('foundry', await runFoundryAgent(body));
}

async function runGuardianApi(body) {
  return applyAgentTrail('guardian', await runGuardianChatAgent(body));
}

async function handleReadOnlyRequest(res, handler) {
  try {
    const data = await handler();
    return sendJson(res, 200, { ok: true, data });
  } catch (error) {
    const statusCode = looksLikeBadRequest(error) ? 400 : 500;
    return sendJson(res, statusCode, {
      ok: false,
      error: error && error.message ? error.message : 'Unexpected server error',
    });
  }
}

function getSerializedWorkflowErrorStatusCode(error) {
  const explicitStatus = Number(error && error.status);
  if (
    Number.isInteger(explicitStatus) &&
    explicitStatus >= 400 &&
    explicitStatus < 600
  ) {
    return explicitStatus;
  }
  return looksLikeBadRequest(error) ? 400 : 500;
}

async function handleBrokerWorkflowReadOnlyRequest(res, handler) {
  try {
    const data = await handler();
    return sendJson(res, 200, { ok: true, data });
  } catch (error) {
    return sendJson(
      res,
      getSerializedWorkflowErrorStatusCode(error),
      serializeBrokerWorkflowError(error),
    );
  }
}

async function handleBrokerWorkflowApiRequest(req, res, handler) {
  try {
    const body = await readJsonBody(req);
    const data = await handler(body);
    return sendJson(res, 200, { ok: true, data });
  } catch (error) {
    return sendJson(
      res,
      getSerializedWorkflowErrorStatusCode(error),
      serializeBrokerWorkflowError(error),
    );
  }
}

function buildBrokerWorkflowOptions(input = {}) {
  return {
    auth: input.auth,
    senderUaid: input.senderUaid,
    historyTtlSeconds: input.historyTtlSeconds,
    encryptionPreference: input.encryptionPreference,
    streaming: input.streaming,
  };
}

function buildBrokerWorkflowSteps(input = {}) {
  const steps =
    input && input.steps && typeof input.steps === 'object' ? input.steps : {};

  return {
    froggychat: input.froggychat || input.chat || input.chatMessage || steps.froggychat || steps.chat,
    planner: input.planner || input.plannerMessage || steps.planner,
    foundry: input.foundry || input.foundryMessage || steps.foundry,
    guardian: input.guardian || input.guardianMessage || steps.guardian,
  };
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

async function handleA2aEndpoint(req, res, { agentKey, runner }) {
  try {
    const body = await readJsonBody(req);
    const response = await handleA2aJsonRpc(body, {
      agentKey,
      runner,
    });
    return sendJson(res, 200, response);
  } catch (error) {
    return sendJson(res, 400, {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32600,
        message:
          error && error.message
            ? error.message
            : 'Invalid A2A JSON-RPC request',
      },
    });
  }
}

function requireInternalA2aAccess(req, res) {
  if (isInternalA2aAuthorized(req.headers || {})) {
    return true;
  }

  sendJson(res, 403, {
    ok: false,
    error: `Internal A2A endpoint requires ${INTERNAL_A2A_HEADER}.`,
  });
  return false;
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
    return sendHtml(
      res,
      200,
      getDocsHtml({
        navLinks: [
          { label: 'Main API Docs', href: '/docs' },
          { label: 'Workflow API Docs', href: '/workflow/docs' },
        ],
      }),
    );
  }

  if (req.method === 'GET' && pathname === '/workflow/openapi.json') {
    return sendJsonNoStore(
      res,
      200,
      buildWorkflowOpenApiSpec(makeServerUrl(req)),
    );
  }

  if (req.method === 'GET' && pathname === '/workflow/docs') {
    return sendHtml(
      res,
      200,
      getDocsHtml({
        title: 'Froggy Planner Broker Workflow API Docs',
        specUrl: '/workflow/openapi.json',
        navLinks: [
          { label: 'Main API Docs', href: '/docs' },
          { label: 'Workflow API Docs', href: '/workflow/docs' },
        ],
      }),
    );
  }

  if (req.method === 'GET' && PUBLIC_WELL_KNOWN_ROUTES[pathname]) {
    return sendJsonNoStore(
      res,
      200,
      buildAgentCard(makeServerUrl(req), PUBLIC_WELL_KNOWN_ROUTES[pathname]),
    );
  }

  if (req.method === 'GET' && PUBLIC_IMAGE_ROUTES[pathname]) {
    try {
      const asset = PUBLIC_IMAGE_ROUTES[pathname];
      return await sendFile(res, 200, asset.filePath, asset.contentType);
    } catch (error) {
      return sendJson(res, 404, {
        ok: false,
        error:
          error && error.message ? error.message : 'Image asset not found',
      });
    }
  }

  if (req.method === 'POST' && pathname === '/a2a/froggy-planner') {
    return handleA2aEndpoint(req, res, {
      agentKey: 'planner',
      runner: runAgent,
    });
  }

  if (req.method === 'POST' && pathname === '/a2a/froggy-chat') {
    return handleA2aEndpoint(req, res, {
      agentKey: 'froggychat',
      runner: runRouterAgent,
    });
  }

  if (req.method === 'POST' && pathname === '/a2a/froggychat') {
    return handleA2aEndpoint(req, res, {
      agentKey: 'froggychat',
      runner: runRouterAgent,
    });
  }

  if (req.method === 'POST' && pathname === '/a2a/chat') {
    return handleA2aEndpoint(req, res, {
      agentKey: 'froggychat',
      runner: runRouterAgent,
    });
  }

  if (req.method === 'POST' && pathname === '/a2a/froggy-router') {
    return handleA2aEndpoint(req, res, {
      agentKey: 'froggychat',
      runner: runRouterAgent,
    });
  }

  if (req.method === 'POST' && pathname === '/a2a/froggy-guardian') {
    return handleA2aEndpoint(req, res, {
      agentKey: 'guardian',
      runner: runGuardianChatAgent,
    });
  }

  if (req.method === 'POST' && pathname === '/a2a/froggy-foundry') {
    return handleA2aEndpoint(req, res, {
      agentKey: 'foundry',
      runner: runFoundryWorker,
    });
  }

  if (req.method === 'POST' && pathname === '/a2a/station-finder') {
    if (!requireInternalA2aAccess(req, res)) return;
    return handleA2aEndpoint(req, res, {
      agentKey: 'stationFinder',
      runner: runStationFinderAgent,
    });
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
    req.method === 'POST' &&
    pathname === '/a2a/guardian-policy-summarizer'
  ) {
    if (!requireInternalA2aAccess(req, res)) return;
    return handleA2aEndpoint(req, res, {
      agentKey: 'guardianPolicySummarizer',
      runner: runGuardianPolicySummarizerAgent,
    });
  }

  if (req.method === 'POST' && pathname === '/a2a/guardian-policy-creator') {
    if (!requireInternalA2aAccess(req, res)) return;
    return handleA2aEndpoint(req, res, {
      agentKey: 'guardianPolicyCreator',
      runner: runGuardianPolicyCreatorAgent,
    });
  }

  if (
    req.method === 'GET' &&
    pathname.startsWith('/api/hol/workflow/resolve/')
  ) {
    const agentKey = decodeURIComponent(
      pathname.slice('/api/hol/workflow/resolve/'.length),
    );
    return handleBrokerWorkflowReadOnlyRequest(res, () =>
      resolveBrokerWorkflowAgent(agentKey),
    );
  }

  if (req.method === 'POST' && pathname === '/api/hol/workflow/run') {
    return handleBrokerWorkflowApiRequest(req, res, (body) =>
      runBrokerWorkflow(
        buildBrokerWorkflowSteps(body),
        buildBrokerWorkflowOptions(body),
      ),
    );
  }

  if (req.method === 'POST' && pathname.startsWith('/api/hol/workflow/')) {
    const agentKey = decodeURIComponent(
      pathname.slice('/api/hol/workflow/'.length),
    );
    return handleBrokerWorkflowApiRequest(req, res, (body) =>
      callBrokerWorkflowAgent(
        agentKey,
        body.message,
        buildBrokerWorkflowOptions(body),
      ),
    );
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
    return handleApiRequest(req, res, runPlannerApi);
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'POST' &&
    pathname === '/api/agent/froggy-foundry'
  ) {
    return handleApiRequest(req, res, runFoundryApi);
  }

  if (
    ENABLE_TEST_API_ROUTES &&
    req.method === 'POST' &&
    pathname === '/api/agent/froggy-guardian'
  ) {
    return handleApiRequest(req, res, runGuardianApi);
  }

  if (
    !ENABLE_TEST_API_ROUTES &&
    pathname.startsWith('/api/') &&
    pathname !== '/api/openapi.json'
  ) {
    return sendJson(res, 404, {
      ok: false,
      error:
        'Direct API agent routes are hidden in production. Use the A2A endpoints instead, or set ENABLE_TEST_API_ROUTES=true for direct endpoint testing.',
    });
  }

  return sendJson(res, 404, { ok: false, error: 'Route not found' });
});

server.listen(PORT, () => {
  console.log(`froggy-planner API listening on http://localhost:${PORT}`);
});
