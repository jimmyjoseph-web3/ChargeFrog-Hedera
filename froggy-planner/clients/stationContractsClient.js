const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { ethers } = require('ethers');
const {
  createPrivateKeySigner,
  normalizePrivateKey,
} = require('./privateKeyEthereumProvider');

const DEFAULT_RPC_NODE_URL = 'https://testnet.hashio.io/api';
const DEFAULT_REGISTRY_ADDRESS = '0xE690102867901aaF25F960E95E65421e1cC78b07';
const DEFAULT_BOLT_ADDRESS = '0x173E5D299fFECaE7856504164a157506859F486f';
const DEFAULT_PROJECT_URL = 'https://chargefrog.vercel.app/';

const ARTIFACT_PATHS = Object.freeze({
  Registry: path.resolve(
    __dirname,
    '../../contracts/artifacts/logic/registry.sol/Registry.json',
  ),
  Bolt: path.resolve(
    __dirname,
    '../../contracts/artifacts/logic/bolt.sol/Bolt.json',
  ),
  Station: path.resolve(
    __dirname,
    '../../contracts/artifacts/logic/station.sol/Station.json',
  ),
  Shares: path.resolve(
    __dirname,
    '../../contracts/artifacts/logic/shares.sol/Shares.json',
  ),
});

const artifactCache = new Map();

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

function getArtifact(name) {
  if (artifactCache.has(name)) {
    return artifactCache.get(name);
  }

  const artifactPath = ARTIFACT_PATHS[name];
  if (!artifactPath) {
    throw new Error(`Unknown contract artifact: ${name}`);
  }
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Missing contract artifact: ${artifactPath}`);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  artifactCache.set(name, artifact);
  return artifact;
}

function normalizeAddress(value, label) {
  const raw = String(value || '').trim();
  if (!raw) {
    throw new Error(`${label} is required`);
  }
  try {
    return ethers.utils.getAddress(raw);
  } catch (_error) {
    throw new Error(`${label} must be a valid EVM address`);
  }
}

function normalizeWholeNumber(value, label) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${label} is required`);
  }
  if (typeof value === 'bigint') {
    if (value < 0n) throw new Error(`${label} must be non-negative`);
    return value.toString();
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
      throw new Error(`${label} must be a non-negative integer`);
    }
    return String(value);
  }

  const raw = String(value).trim();
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${label} must be a non-negative integer string`);
  }
  return raw;
}

function normalizeOptionalWholeNumber(value, label) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return normalizeWholeNumber(value, label);
}

function resolveTotalInvestment(input = {}) {
  const rawValue =
    input.totalInvestment ??
    input.totalInvestmentWei ??
    input.totalInvestmentWeibar ??
    input.totalInvestmentTinybar;

  if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
    return normalizeWholeNumber(rawValue, 'totalInvestment');
  }

  const hbarValue = input.totalInvestmentHbar ?? input.targetHbar;
  if (hbarValue !== undefined && hbarValue !== null && hbarValue !== '') {
    const raw = String(hbarValue).trim();
    try {
      return ethers.utils.parseUnits(raw, 18).toString();
    } catch (_error) {
      throw new Error('totalInvestmentHbar must be a valid numeric string');
    }
  }

  throw new Error(
    'totalInvestment (or totalInvestmentHbar) is required for station deployment',
  );
}

function resolveStationMetadata(value) {
  if (value === undefined || value === null || value === '') {
    return '0x';
  }

  if (Buffer.isBuffer(value)) {
    return `0x${value.toString('hex')}`;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '0x';
    if (/^0x[0-9a-fA-F]*$/.test(trimmed)) {
      return trimmed;
    }
    return ethers.utils.hexlify(ethers.utils.toUtf8Bytes(trimmed));
  }

  return ethers.utils.hexlify(
    ethers.utils.toUtf8Bytes(JSON.stringify(value)),
  );
}

function txSummary(tx, receipt, label) {
  return {
    label,
    hash:
      (tx && tx.hash) ||
      (receipt && (receipt.transactionHash || receipt.hash)) ||
      null,
    blockNumber:
      receipt && Number.isFinite(Number(receipt.blockNumber))
        ? Number(receipt.blockNumber)
        : null,
    status:
      receipt && receipt.status !== undefined && receipt.status !== null
        ? Number(receipt.status)
        : null,
    gasUsed:
      receipt && receipt.gasUsed && typeof receipt.gasUsed.toString === 'function'
        ? receipt.gasUsed.toString()
        : null,
  };
}

async function waitForTx(tx, label) {
  const receipt = await tx.wait();
  return txSummary(tx, receipt, label);
}

async function waitForDeployment(contract, label) {
  await contract.deployed();
  const deployTx = contract.deployTransaction || null;
  const receipt = deployTx ? await deployTx.wait() : null;
  return txSummary(deployTx, receipt, label);
}

function extractStationId(receipt, registryContract) {
  const events = Array.isArray(receipt && receipt.events) ? receipt.events : [];
  for (const event of events) {
    if (event && event.event === 'StationCreated' && event.args) {
      const stationId = event.args.stationId ?? event.args[0];
      if (stationId !== undefined && stationId !== null) {
        return stationId.toString();
      }
    }
  }

  const logs = Array.isArray(receipt && receipt.logs) ? receipt.logs : [];
  for (const log of logs) {
    try {
      const parsed = registryContract.interface.parseLog(log);
      if (parsed && parsed.name === 'StationCreated') {
        const stationId = parsed.args.stationId ?? parsed.args[0];
        if (stationId !== undefined && stationId !== null) {
          return stationId.toString();
        }
      }
    } catch (_error) {
      // Ignore logs from other contracts.
    }
  }

  return null;
}

async function ensureContractCode(provider, address, label) {
  const code = await provider.getCode(address);
  if (!code || code === '0x') {
    throw new Error(`${label} does not contain deployed contract code`);
  }
}

async function ensureOwner(contract, expectedOwner, label) {
  if (!contract || typeof contract.owner !== 'function') {
    throw new Error(`${label} does not expose owner()`);
  }

  const owner = normalizeAddress(await contract.owner(), `${label}.owner()`);
  if (owner.toLowerCase() !== expectedOwner.toLowerCase()) {
    throw new Error(
      `${label} owner mismatch: signer ${expectedOwner} is not ${label} owner ${owner}`,
    );
  }

  return owner;
}

function getClientConfig(input = {}) {
  const privateKey = normalizePrivateKey(
    input.privateKey || envValue('ADMIN_PRIVATE_KEY', 'VITE_ADMIN_PRIVATE_KEY'),
  );
  if (!privateKey) {
    throw new Error(
      'Missing ADMIN_PRIVATE_KEY (or VITE_ADMIN_PRIVATE_KEY) in .env',
    );
  }

  const rpcUrl = String(
    input.rpcUrl || envValue('RPC_NODE_URL') || DEFAULT_RPC_NODE_URL,
  ).trim();
  if (!rpcUrl) {
    throw new Error('RPC_NODE_URL is required');
  }

  const registryAddress = normalizeAddress(
    input.registryAddress ||
      envValue(
        'STATION_REGISTRY_ADDRESS',
        'REGISTRY_ADDRESS',
        'VITE_STATION_REGISTRY_ADDRESS',
      ) ||
      DEFAULT_REGISTRY_ADDRESS,
    'registryAddress',
  );
  const boltAddress = normalizeAddress(
    input.boltAddress ||
      envValue(
        'STATION_BOLT_ADDRESS',
        'BOLT_ADDRESS',
        'VITE_STATION_BOLT_ADDRESS',
      ) ||
      DEFAULT_BOLT_ADDRESS,
    'boltAddress',
  );

  return {
    privateKey,
    rpcUrl,
    registryAddress,
    boltAddress,
  };
}

async function deployStationBundle(input = {}) {
  const config = getClientConfig(input);
  const { wallet, provider, address } = createPrivateKeySigner({
    privateKey: config.privateKey,
    rpcUrl: config.rpcUrl,
  });
  const signerAddress = normalizeAddress(address, 'signerAddress');

  const stationName = String(input.stationName || input.name || '').trim();
  if (!stationName) {
    throw new Error('stationName is required');
  }

  const projectUrl = String(
    input.projectUrl || input.website || input.url || DEFAULT_PROJECT_URL,
  ).trim();
  const totalInvestment = resolveTotalInvestment(input);
  const totalShares = normalizeWholeNumber(
    input.totalShares ?? input.shares ?? 1000,
    'totalShares',
  );
  const stationMetadata = resolveStationMetadata(
    input.stationMetadata ?? input.metadata ?? stationName,
  );
  const initialFundAddress = normalizeAddress(
    input.initialFundAddress || input.fundAddress || signerAddress,
    'initialFundAddress',
  );

  await ensureContractCode(provider, config.registryAddress, 'registryAddress');
  await ensureContractCode(provider, config.boltAddress, 'boltAddress');

  const registryArtifact = getArtifact('Registry');
  const boltArtifact = getArtifact('Bolt');
  const stationArtifact = getArtifact('Station');
  const sharesArtifact = getArtifact('Shares');

  const registry = new ethers.Contract(
    config.registryAddress,
    registryArtifact.abi,
    wallet,
  );
  const bolt = new ethers.Contract(config.boltAddress, boltArtifact.abi, wallet);
  const stationFactory = new ethers.ContractFactory(
    stationArtifact.abi,
    stationArtifact.bytecode,
    wallet,
  );
  const sharesFactory = new ethers.ContractFactory(
    sharesArtifact.abi,
    sharesArtifact.bytecode,
    wallet,
  );

  const chain = await provider.getNetwork();
  const registryOwner = await ensureOwner(registry, signerAddress, 'Registry');
  const boltOwner = await ensureOwner(bolt, signerAddress, 'Bolt');
  const expectedStationId = normalizeOptionalWholeNumber(
    input.expectedStationId ?? input.stationId,
    'expectedStationId',
  );
  const nextRegistryStationId =
    typeof registry.nextId === 'function'
      ? (await registry.nextId()).toString()
      : null;

  if (
    expectedStationId !== null &&
    nextRegistryStationId !== null &&
    nextRegistryStationId !== expectedStationId
  ) {
    throw new Error(
      `Registry nextId mismatch: expected stationId ${expectedStationId}, but registry will assign ${nextRegistryStationId}`,
    );
  }

  const createStationTx = await registry.createStation(
    totalInvestment,
    totalShares,
    stationMetadata,
    initialFundAddress,
  );
  const createStationReceipt = await createStationTx.wait();
  const createStationSummary = txSummary(
    createStationTx,
    createStationReceipt,
    'createStation',
  );

  let stationId = extractStationId(createStationReceipt, registry);
  if (!stationId) {
    const nextId = await registry.nextId();
    stationId = ethers.BigNumber.from(nextId).sub(1).toString();
  }
  if (expectedStationId !== null && stationId !== expectedStationId) {
    throw new Error(
      `Deployed stationId mismatch: expected ${expectedStationId}, got ${stationId}`,
    );
  }

  const stationContract = await stationFactory.deploy(
    stationId,
    totalInvestment,
    config.registryAddress,
    config.boltAddress,
    stationName,
    projectUrl,
  );
  const deployStationSummary = await waitForDeployment(
    stationContract,
    'deployStation',
  );
  const stationAddress = normalizeAddress(
    stationContract.address,
    'stationAddress',
  );

  const sharesContract = await sharesFactory.deploy(stationAddress);
  const deploySharesSummary = await waitForDeployment(
    sharesContract,
    'deployShares',
  );
  const sharesAddress = normalizeAddress(
    sharesContract.address,
    'sharesAddress',
  );

  const setSharesTrackerSummary = await waitForTx(
    await stationContract.setSharesTracker(sharesAddress),
    'setSharesTracker',
  );
  const initializeStationAdminSummary = await waitForTx(
    await registry.initializeStationAdmin(stationId, stationAddress),
    'initializeStationAdmin',
  );
  const updateFundAddressSummary = await waitForTx(
    await registry.updateFundAddress(stationId, stationAddress),
    'updateFundAddress',
  );
  const registerStationSummary = await waitForTx(
    await bolt.registerStation(stationId, stationAddress),
    'registerStation',
  );

  return {
    network: {
      chainId: Number(chain.chainId),
      name: chain.name || 'unknown',
      rpcUrl: config.rpcUrl,
    },
    signer: {
      address: signerAddress,
      registryOwner,
      boltOwner,
    },
    contracts: {
      registryAddress: config.registryAddress,
      boltAddress: config.boltAddress,
      stationAddress,
      sharesAddress,
    },
    station: {
      stationId,
      expectedStationId,
      nextRegistryStationId,
      stationName,
      projectUrl,
      totalInvestment,
      totalShares,
      stationMetadata,
      initialFundAddress,
    },
    txs: {
      createStation: createStationSummary,
      deployStation: deployStationSummary,
      deployShares: deploySharesSummary,
      setSharesTracker: setSharesTrackerSummary,
      initializeStationAdmin: initializeStationAdminSummary,
      updateFundAddress: updateFundAddressSummary,
      registerStation: registerStationSummary,
    },
  };
}

module.exports = {
  deployStationBundle,
};
