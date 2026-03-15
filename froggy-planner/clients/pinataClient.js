const DEFAULT_PINATA_API_BASE_URL = 'https://api.pinata.cloud';
const DEFAULT_PINATA_GATEWAY_BASE_URL = 'https://gateway.pinata.cloud/ipfs/';

function envValue(...keys) {
  for (const key of keys) {
    const raw = process.env[key];
    if (raw !== undefined && String(raw).trim() !== '') {
      return String(raw).trim();
    }
  }
  return undefined;
}

function ensureTrailingSlash(value) {
  return value.endsWith('/') ? value : `${value}/`;
}

function buildPinataAuthHeaders() {
  const jwt = envValue('PINATA_JWT');
  if (jwt) {
    return {
      Authorization: `Bearer ${jwt}`,
    };
  }

  const apiKey = envValue('PINATA_API_KEY');
  const apiSecret = envValue('PINATA_API_SECRET');
  if (apiKey && apiSecret) {
    return {
      pinata_api_key: apiKey,
      pinata_secret_api_key: apiSecret,
    };
  }

  throw new Error(
    'Missing Pinata credentials. Set PINATA_JWT or PINATA_API_KEY + PINATA_API_SECRET in .env',
  );
}

function toObject(value, fallback = {}) {
  return value && typeof value === 'object' ? value : fallback;
}

function sanitizePinataName(value) {
  const raw = String(value || '').trim();
  const normalized = raw.replace(/[^\w.-]/g, '-').slice(0, 120);
  return normalized || `proposal-${Date.now()}`;
}

function ipfsUriToGatewayUrl(ipfsUri) {
  const raw = String(ipfsUri || '').trim();
  if (!raw.startsWith('ipfs://')) return null;
  const cidAndPath = raw.slice('ipfs://'.length).replace(/^\/+/, '');
  if (!cidAndPath) return null;
  const gatewayBase = ensureTrailingSlash(
    envValue('PINATA_GATEWAY_URL') || DEFAULT_PINATA_GATEWAY_BASE_URL,
  );
  return `${gatewayBase}${cidAndPath}`;
}

async function uploadJsonToIpfsWithPinata(input = {}) {
  const content = toObject(input.content, null);
  if (!content) {
    throw new Error('Pinata upload requires content object');
  }

  const apiBase =
    envValue('PINATA_API_BASE_URL') || DEFAULT_PINATA_API_BASE_URL;
  const name = sanitizePinataName(input.name);
  const keyvalues = toObject(input.keyvalues, {});

  const response = await fetch(`${apiBase}/pinning/pinJSONToIPFS`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildPinataAuthHeaders(),
    },
    body: JSON.stringify({
      pinataOptions: {
        cidVersion: 1,
      },
      pinataMetadata: {
        name,
        keyvalues,
      },
      pinataContent: content,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Pinata upload failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  const cid = String(payload.IpfsHash || '').trim();
  if (!cid) {
    throw new Error('Pinata upload succeeded but IpfsHash was missing');
  }

  const ipfsUri = `ipfs://${cid}`;
  return {
    cid,
    ipfsUri,
    gatewayUrl: ipfsUriToGatewayUrl(ipfsUri),
    size: payload.PinSize ?? null,
    timestamp: payload.Timestamp || null,
    raw: payload,
  };
}

module.exports = {
  uploadJsonToIpfsWithPinata,
  ipfsUriToGatewayUrl,
};
