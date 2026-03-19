const fs = require('fs');
const path = require('path');

require('reflect-metadata');
const dotenv = require('dotenv');
const sdkBasePath = path.resolve(
  __dirname,
  '../../../packages/ats/sdk/build/cjs/src',
);
const {
  ApplyRolesRequest,
  Bond,
  CreateBondRequest,
  CreateEquityRequest,
  Equity,
  GetAccountBalanceRequest,
  InitializationRequest,
  IssueRequest,
  MintRequest,
  Network,
  Role,
  RoleRequest,
  Security,
  SetMaxSupplyRequest,
} = require('@hashgraph/asset-tokenization-sdk');
const {
  createPrivateKeySigner,
  normalizePrivateKey,
} = require('./privateKeyEthereumProvider');
const Injectable = require(
  path.join(sdkBasePath, 'core/injectable/Injectable.js'),
).default;
const { RPCTransactionAdapter } = require(
  path.join(sdkBasePath, 'port/out/rpc/RPCTransactionAdapter.js'),
);

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

const DEFAULT_MIRROR_NODE_URL = 'https://testnet.mirrornode.hedera.com/api/v1/';
const DEFAULT_RPC_NODE_URL = 'https://testnet.hashio.io/api';
const DEFAULT_NETWORK = 'testnet';
const DEFAULT_FACTORY_ADDRESS = '0.0.6930123';
const DEFAULT_RESOLVER_ADDRESS = '0.0.6930056';
const DEFAULT_CHAIN_ID = 296;
const DEFAULT_CONFIG_ID =
  '0x0000000000000000000000000000000000000000000000000000000000000001';
const DEFAULT_BOND_CONFIG_ID =
  '0x0000000000000000000000000000000000000000000000000000000000000002';
const DEFAULT_BOND_CONFIG_VERSION = 1;

const SECURITY_ROLE = {
  ISSUER: '0x4be32e8849414d19186807008dabd451c1d87dae5f8e22f32f5ce94d486da842',
  AGENT: '0xc4aed0454da9bde6defa5baf93bb49d4690626fc243d138104e12d1def783ea6',
  CAP: '0xb60cac52541732a1020ce6841bc7449e99ed73090af03b50911c75d631476571',
};

function envValue(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return undefined;
}

function envNumber(defaultValue, ...keys) {
  const value = envValue(...keys);
  if (!value) return defaultValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function normalizeMirrorUrl(baseUrl) {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

const config = {
  privateKey: () =>
    normalizePrivateKey(
      envValue('ADMIN_PRIVATE_KEY', 'VITE_ADMIN_PRIVATE_KEY'),
    ),
  chainId: envNumber(DEFAULT_CHAIN_ID, 'HEDERA_CHAIN_ID'),
  network: envValue('HEDERA_NETWORK') || DEFAULT_NETWORK,
  mirrorNode: {
    baseUrl: normalizeMirrorUrl(
      envValue('MIRROR_NODE_URL', 'VITE_MIRROR_NODE_URL') ||
        DEFAULT_MIRROR_NODE_URL,
    ),
    apiKey: '',
    headerName: '',
  },
  rpcNode: {
    baseUrl: envValue('RPC_NODE_URL') || DEFAULT_RPC_NODE_URL,
    apiKey: '',
    headerName: '',
  },
  factoryAddress: envValue('FACTORY_ADDRESS') || DEFAULT_FACTORY_ADDRESS,
  resolverAddress: envValue('RESOLVER_ADDRESS') || DEFAULT_RESOLVER_ADDRESS,
  adminAccountId: envValue('ADMIN_ACCOUNT_ID'),
};

let sdkConnectionPromise;
let resolvedAdminAccountId = config.adminAccountId;
let signerEvmAddress;

function getRequiredPrivateKey() {
  const privateKey = config.privateKey();
  if (!privateKey) {
    throw new Error(
      'Missing ADMIN_PRIVATE_KEY (or VITE_ADMIN_PRIVATE_KEY) in .env',
    );
  }
  return privateKey;
}

async function ensureConnected() {
  if (sdkConnectionPromise) {
    return sdkConnectionPromise;
  }

  sdkConnectionPromise = (async () => {
    const privateKey = getRequiredPrivateKey();
    const { wallet, address } = createPrivateKeySigner({
      privateKey,
      rpcUrl: config.rpcNode.baseUrl,
    });
    signerEvmAddress = address;

    await Network.init(
      new InitializationRequest({
        network: config.network,
        mirrorNode: config.mirrorNode,
        rpcNode: config.rpcNode,
        configuration: {
          factoryAddress: config.factoryAddress,
          resolverAddress: config.resolverAddress,
        },
        mirrorNodes: {
          nodes: [
            {
              mirrorNode: config.mirrorNode,
              environment: config.network,
            },
          ],
        },
        jsonRpcRelays: {
          nodes: [
            {
              jsonRpcRelay: config.rpcNode,
              environment: config.network,
            },
          ],
        },
        factories: {
          factories: [
            {
              factory: config.factoryAddress,
              environment: config.network,
            },
          ],
        },
        resolvers: {
          resolvers: [
            {
              resolver: config.resolverAddress,
              environment: config.network,
            },
          ],
        },
      }),
    );

    const rpcAdapter = Injectable.resolve(RPCTransactionAdapter);
    rpcAdapter.setConfig({
      mirrorNodes: {
        nodes: [
          {
            mirrorNode: config.mirrorNode,
            environment: config.network,
          },
        ],
      },
      jsonRpcRelays: {
        nodes: [
          {
            jsonRpcRelay: config.rpcNode,
            environment: config.network,
          },
        ],
      },
      factories: {
        factories: [
          {
            factory: config.factoryAddress,
            environment: config.network,
          },
        ],
      },
      resolvers: {
        resolvers: [
          {
            resolver: config.resolverAddress,
            environment: config.network,
          },
        ],
      },
    });

    const accountId = await resolveAdminAccountId(address);
    await rpcAdapter.register({ id: accountId, evmAddress: address }, true);
    rpcAdapter.setSignerOrProvider(wallet);

    return { evmAddress: address, accountId };
  })().catch((error) => {
    sdkConnectionPromise = undefined;
    throw error;
  });

  return sdkConnectionPromise;
}

async function resolveAdminAccountId(evmAddress) {
  if (resolvedAdminAccountId) {
    return resolvedAdminAccountId;
  }

  const lookupAddress = evmAddress || signerEvmAddress;
  if (!lookupAddress) {
    throw new Error(
      'Missing ADMIN_ACCOUNT_ID and signer address is not available',
    );
  }

  const mirrorUrl = `${config.mirrorNode.baseUrl}accounts/${lookupAddress}`;
  const response = await fetch(mirrorUrl);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `Unable to resolve ADMIN_ACCOUNT_ID from mirror node (404) for signer ${lookupAddress}. Set ADMIN_ACCOUNT_ID=0.0.x in .env, or use a funded testnet ECDSA account that matches ADMIN_PRIVATE_KEY.`,
      );
    }
    throw new Error(
      `Unable to resolve ADMIN_ACCOUNT_ID from mirror node (${response.status}) for signer ${lookupAddress}`,
    );
  }

  const payload = await response.json();
  if (!payload?.account) {
    throw new Error('Mirror node did not return an account for signer address');
  }

  resolvedAdminAccountId = String(payload.account);
  return resolvedAdminAccountId;
}

function currencyCodeToHex(currency) {
  const raw = String(currency || 'USD').trim();
  if (/^0x[0-9a-fA-F]+$/.test(raw)) {
    return raw.toLowerCase();
  }
  const value = raw.toUpperCase();
  return `0x${Buffer.from(value, 'ascii').toString('hex')}`;
}

function toUnixTimestampSeconds(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error('startingDate and maturityDate must be valid timestamps');
  }

  const normalized = Math.trunc(timestamp);
  if (normalized > 1_000_000_000_000) {
    return Math.trunc(normalized / 1000);
  }

  return normalized;
}

function resolveSecurityId(input = {}) {
  const pick = (value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string' || typeof value === 'number') {
      const raw = String(value).trim();
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
      const nested = pick(value[key]);
      if (nested) return nested;
    }
    return null;
  };

  const explicit = pick(input.securityId) || pick(input.tokenAddress);
  if (explicit) return explicit;

  const stationId = Number(input.stationId);
  if (stationId === 1) return envValue('VITE_STATION_1_SECURITY_CONTRACT_ID');
  if (stationId === 2) return envValue('VITE_STATION_2_SECURITY_CONTRACT_ID');
  if (stationId === 3) return envValue('VITE_STATION_3_SECURITY_CONTRACT_ID');
  if (stationId === 4) return envValue('VITE_STATION_4_SECURITY_CONTRACT_ID');

  return envValue('VITE_SECURITY_CONTRACT_ID', 'SECURITY_CONTRACT_ID');
}

function toAmountString(amount) {
  if (amount === undefined || amount === null || amount === '') {
    throw new Error('amount is required');
  }
  return String(amount);
}

function normalizeOptionalId(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  const normalized = String(value).trim();
  if (!normalized) {
    return undefined;
  }
  const lowered = normalized.toLowerCase();
  if (lowered === 'undefined' || lowered === 'null') {
    return undefined;
  }
  return normalized;
}

function formatSdkError(error) {
  if (!error) return 'unknown_error';
  const parts = [];

  if (error instanceof Error && error.message) {
    parts.push(error.message);
  }

  const nestedError =
    error.error && typeof error.error === 'object' ? error.error : null;
  if (nestedError?.message) {
    parts.push(`sdk_error=${nestedError.message}`);
  }
  if (nestedError?.transactionId) {
    parts.push(`txId=${nestedError.transactionId}`);
  }
  if (nestedError?.status) {
    parts.push(`status=${nestedError.status}`);
  }

  if (error.transactionUrl) {
    parts.push(`transactionUrl=${error.transactionUrl}`);
  }

  const causeMessage =
    error?.cause && typeof error.cause === 'object' && error.cause.message
      ? error.cause.message
      : null;
  if (causeMessage) {
    parts.push(`cause=${causeMessage}`);
  }

  if (parts.length === 0) {
    try {
      return JSON.stringify(error);
    } catch (_jsonError) {
      return String(error);
    }
  }

  return parts.join(' | ');
}

function isRetryableUpstreamError(error) {
  const message = String(
    error?.message || error?.cause?.message || error?.error?.message || '',
  ).toLowerCase();
  return (
    message.includes('error code: 502') ||
    message.includes('status\":502') ||
    message.includes('server_error') ||
    message.includes('call_exception') ||
    message.includes('missing revert data') ||
    message.includes('gateway') ||
    message.includes('timed out') ||
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('temporarily unavailable')
  );
}

async function retryOperation(task, { retries = 2, baseDelayMs = 500 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await task(attempt + 1);
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !isRetryableUpstreamError(error)) {
        throw error;
      }
      const waitMs = baseDelayMs * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw lastError;
}

async function createToken(input = {}) {
  await ensureConnected();

  const adminAccountId = String(
    input.adminAccountId || (await resolveAdminAccountId()),
  );
  const numberOfShares = String(input.numberOfShares || '1000');
  const complianceId = normalizeOptionalId(input.complianceId);
  const identityRegistryId = normalizeOptionalId(input.identityRegistryId);
  const createRequestPayload = {
    name: String(input.name || 'ChargeFrog-Equity'),
    symbol: String(input.symbol || 'CFEQ'),
    isin: String(input.isin || 'MY760VPEW3I9'),
    decimals: Number(input.decimals ?? 6),

    isWhiteList: Boolean(input.isWhiteList ?? false),
    isControllable: Boolean(input.isControllable ?? true),
    arePartitionsProtected: Boolean(input.arePartitionsProtected ?? false),
    isMultiPartition: Boolean(input.isMultiPartition ?? false),
    clearingActive: Boolean(input.clearingActive ?? false),
    internalKycActivated: Boolean(input.internalKycActivated ?? false),

    externalPausesIds: Array.isArray(input.externalPausesIds)
      ? input.externalPausesIds
      : [],
    externalControlListsIds: Array.isArray(input.externalControlListsIds)
      ? input.externalControlListsIds
      : [],
    externalKycListsIds: Array.isArray(input.externalKycListsIds)
      ? input.externalKycListsIds
      : [],

    diamondOwnerAccount: String(input.diamondOwnerAccount || adminAccountId),

    votingRight: Boolean(input.votingRight ?? false),
    informationRight: Boolean(input.informationRight ?? true),
    liquidationRight: Boolean(input.liquidationRight ?? false),
    subscriptionRight: Boolean(input.subscriptionRight ?? false),
    conversionRight: Boolean(input.conversionRight ?? false),
    redemptionRight: Boolean(input.redemptionRight ?? false),
    putRight: Boolean(input.putRight ?? false),
    dividendRight: Number(input.dividendRight ?? 0),

    currency: currencyCodeToHex(input.currencyHex || input.currency || 'USD'),
    numberOfShares,
    nominalValue: String(input.nominalValue || '1'),

    regulationType: Number(input.regulationType ?? 1),
    regulationSubType: Number(input.regulationSubType ?? 0),
    isCountryControlListWhiteList: Boolean(
      input.isCountryControlListWhiteList ?? false,
    ),
    countries: String(input.countries ?? ''),

    info: String(
      input.info || 'ChargeFrog equity token created via froggy-planner',
    ),

    configId: String(input.configId || DEFAULT_CONFIG_ID),
    configVersion: Number(input.configVersion ?? DEFAULT_BOND_CONFIG_VERSION),
    erc20VotesActivated: Boolean(input.erc20VotesActivated ?? false),
  };

  // The SDK treats optional IDs strictly when present, so only include them if valid.
  if (complianceId) {
    createRequestPayload.complianceId = complianceId;
  }
  if (identityRegistryId) {
    createRequestPayload.identityRegistryId = identityRegistryId;
  }

  const createRequest = new CreateEquityRequest(createRequestPayload);

  const result = await Equity.create(createRequest);
  if (!result || !result.security || !result.security.diamondAddress) {
    throw new Error('Token creation failed: missing security payload');
  }

  const securityId = result.security.diamondAddress;
  const roles = [SECURITY_ROLE.ISSUER, SECURITY_ROLE.AGENT, SECURITY_ROLE.CAP];

  const applyRolesResult = await retryOperation(
    () =>
      Role.applyRoles(
        new ApplyRolesRequest({
          targetId: adminAccountId,
          securityId,
          roles,
          actives: [false, false, false],
        }),
      ),
    { retries: 3, baseDelayMs: 700 },
  );

  const grantRoleResults = [];
  for (const role of roles) {
    const roleResult = await retryOperation(
      () =>
        Role.grantRole(
          new RoleRequest({
            targetId: adminAccountId,
            securityId,
            role,
          }),
        ),
      { retries: 2, baseDelayMs: 600 },
    );
    grantRoleResults.push({ role, result: roleResult });
  }

  const maxSupply = String(input.maxSupply || numberOfShares);
  const setMaxSupplyResult = await retryOperation(
    () =>
      Security.setMaxSupply(
        new SetMaxSupplyRequest({
          securityId,
          maxSupply,
        }),
      ),
    { retries: 2, baseDelayMs: 600 },
  );

  return {
    security: result.security,
    applyRolesResult,
    grantRoleResults,
    setMaxSupplyResult,
  };
}

async function createBond(input = {}) {
  await ensureConnected();

  const adminAccountId = String(
    input.adminAccountId || (await resolveAdminAccountId()),
  );
  const numberOfUnits = String(
    input.numberOfUnits || input.numberOfShares || '1000',
  );
  const nowSeconds = Math.floor(Date.now() / 1000);
  let startingDate = toUnixTimestampSeconds(
    input.startingDate,
    nowSeconds + 3600,
  );
  const minSafeStartingDate = nowSeconds + 300;
  if (startingDate <= minSafeStartingDate) {
    startingDate = nowSeconds + 3600;
  }
  let maturityDate = toUnixTimestampSeconds(
    input.maturityDate,
    startingDate + 365 * 24 * 60 * 60,
  );
  if (maturityDate <= startingDate) {
    maturityDate = startingDate + 365 * 24 * 60 * 60;
  }

  const complianceId = normalizeOptionalId(input.complianceId);
  const identityRegistryId = normalizeOptionalId(input.identityRegistryId);
  const createRequestPayload = {
    name: String(input.name || 'ChargeFrog-Bond'),
    symbol: String(input.symbol || 'CFBD'),
    isin: String(input.isin || 'MY760VPEW3I9'),
    decimals: Number(input.decimals ?? 6),

    isWhiteList: Boolean(input.isWhiteList ?? false),
    isControllable: Boolean(input.isControllable ?? true),
    arePartitionsProtected: Boolean(input.arePartitionsProtected ?? false),
    isMultiPartition: Boolean(input.isMultiPartition ?? false),
    clearingActive: Boolean(input.clearingActive ?? false),
    internalKycActivated: Boolean(input.internalKycActivated ?? true),

    externalPausesIds: Array.isArray(input.externalPausesIds)
      ? input.externalPausesIds
      : [],
    externalControlListsIds: Array.isArray(input.externalControlListsIds)
      ? input.externalControlListsIds
      : [],
    externalKycListsIds: Array.isArray(input.externalKycListsIds)
      ? input.externalKycListsIds
      : [],

    diamondOwnerAccount: String(input.diamondOwnerAccount || adminAccountId),

    currency: currencyCodeToHex(input.currencyHex || input.currency || 'USD'),
    numberOfUnits,
    nominalValue: String(input.nominalValue || '1'),
    startingDate: String(startingDate),
    maturityDate: String(maturityDate),

    regulationType: Number(input.regulationType ?? 1),
    regulationSubType: Number(input.regulationSubType ?? 0),
    isCountryControlListWhiteList: Boolean(
      input.isCountryControlListWhiteList ?? true,
    ),
    countries: String(input.countries ?? 'US'),

    info: String(
      input.info || 'ChargeFrog bond token created via froggy-planner',
    ),

    configId: String(input.configId || DEFAULT_BOND_CONFIG_ID),
    configVersion: Number(input.configVersion ?? DEFAULT_BOND_CONFIG_VERSION),
    erc20VotesActivated: Boolean(input.erc20VotesActivated ?? false),
  };

  // The SDK treats optional IDs strictly when present, so only include them if valid.
  if (complianceId) {
    createRequestPayload.complianceId = complianceId;
  }
  if (identityRegistryId) {
    createRequestPayload.identityRegistryId = identityRegistryId;
  }

  const createRequest = new CreateBondRequest(createRequestPayload);

  let result;
  try {
    result = await Bond.create(createRequest);
  } catch (error) {
    const details = formatSdkError(error);
    throw new Error(
      `Bond.create failed: ${details}. Request summary: symbol=${createRequestPayload.symbol}, numberOfUnits=${numberOfUnits}, startingDate=${startingDate}, maturityDate=${maturityDate}, configId=${createRequestPayload.configId}, configVersion=${createRequestPayload.configVersion}, regulationType=${createRequestPayload.regulationType}, regulationSubType=${createRequestPayload.regulationSubType}, internalKycActivated=${createRequestPayload.internalKycActivated}, countries=${createRequestPayload.countries}`,
    );
  }
  if (!result || !result.security || !result.security.diamondAddress) {
    throw new Error('Bond creation failed: missing security payload');
  }

  const securityId = result.security.diamondAddress;
  const roles = [SECURITY_ROLE.ISSUER, SECURITY_ROLE.AGENT, SECURITY_ROLE.CAP];

  const applyRolesResult = await retryOperation(
    () =>
      Role.applyRoles(
        new ApplyRolesRequest({
          targetId: adminAccountId,
          securityId,
          roles,
          actives: [false, false, false],
        }),
      ),
    { retries: 3, baseDelayMs: 700 },
  );

  const grantRoleResults = [];
  for (const role of roles) {
    const roleResult = await retryOperation(
      () =>
        Role.grantRole(
          new RoleRequest({
            targetId: adminAccountId,
            securityId,
            role,
          }),
        ),
      { retries: 2, baseDelayMs: 600 },
    );
    grantRoleResults.push({ role, result: roleResult });
  }

  const maxSupply = String(input.maxSupply || numberOfUnits);
  const setMaxSupplyResult = await retryOperation(
    () =>
      Security.setMaxSupply(
        new SetMaxSupplyRequest({
          securityId,
          maxSupply,
        }),
      ),
    { retries: 2, baseDelayMs: 600 },
  );

  return {
    security: result.security,
    applyRolesResult,
    grantRoleResults,
    setMaxSupplyResult,
  };
}

async function mint(input = {}) {
  await ensureConnected();

  const securityId = resolveSecurityId(input);
  if (!securityId) {
    throw new Error('securityId or valid stationId is required');
  }

  const targetId = String(input.targetId || (await resolveAdminAccountId()));
  const amount = toAmountString(input.amount);

  const response = await Security.mint(
    new MintRequest({
      securityId,
      targetId,
      amount,
    }),
  );

  return {
    securityId,
    targetId,
    amount,
    transactionId: response.transactionId,
    payload: response.payload,
  };
}

async function issue(input = {}) {
  await ensureConnected();

  const securityId = resolveSecurityId(input);
  if (!securityId) {
    throw new Error('securityId or valid stationId is required');
  }

  const targetId = String(input.targetId || (await resolveAdminAccountId()));
  const amount = toAmountString(input.amount);

  const response = await Security.issue(
    new IssueRequest({
      securityId,
      targetId,
      amount,
    }),
  );

  return {
    securityId,
    targetId,
    amount,
    transactionId: response.transactionId,
    payload: response.payload,
  };
}

async function getBalance(input = {}) {
  await ensureConnected();

  const securityId = resolveSecurityId(input);
  if (!securityId) {
    throw new Error('securityId or valid stationId is required');
  }

  const targetId = String(input.targetId || (await resolveAdminAccountId()));

  const balance = await Security.getBalanceOf(
    new GetAccountBalanceRequest({
      securityId,
      targetId,
    }),
  );

  return {
    securityId,
    targetId,
    balance,
  };
}

module.exports = {
  ensureConnected,
  createToken,
  createBond,
  mint,
  issue,
  getBalance,
  resolveSecurityId,
  config,
};
