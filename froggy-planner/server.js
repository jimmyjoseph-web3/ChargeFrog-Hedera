const http = require('http');
const { URL } = require('url');
const {
  createToken,
  createBond,
  mint,
  issue,
  getBalance,
} = require('./clients/atsClient');
const { buildOpenApiSpec, getDocsHtml } = require('./http/openapi');

const PORT = Number(process.env.PORT || 8787);
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
    message.includes('walletaddress')
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

  return sendJson(res, 404, { ok: false, error: 'Route not found' });
});

server.listen(PORT, () => {
  console.log(`froggy-planner API listening on http://localhost:${PORT}`);
});
