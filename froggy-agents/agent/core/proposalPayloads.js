const { toFiniteNumber } = require('./shared');
const { toPositiveWholeNumber } = require('./parsing');

function resolveProposalPayload(
  onChainProposalData = {},
  offChainMetadataData = {},
) {
  const candidates = [
    onChainProposalData?.proposalPayload,
    offChainMetadataData?.proposalPayload,
    offChainMetadataData?.stationDetails?.proposalPayload,
    offChainMetadataData?.stationDetails?.metadata?.proposalPayload,
    offChainMetadataData?.stationDetails?.metadata?.offChainMetadata
      ?.proposalPayload,
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object') {
      return candidate;
    }
  }
  return null;
}

function resolveSuppliesFromProposalPayload(proposalPayload = {}) {
  const terms =
    proposalPayload?.tokenizationInvestmentTerms &&
    typeof proposalPayload.tokenizationInvestmentTerms === 'object'
      ? proposalPayload.tokenizationInvestmentTerms
      : {};
  const totalSupply =
    terms?.totalSupply && typeof terms.totalSupply === 'object'
      ? terms.totalSupply
      : {};

  const equityShares = toPositiveWholeNumber(
    totalSupply.equityShares ?? totalSupply.equity ?? totalSupply.shares,
  );
  const bondUnits = toPositiveWholeNumber(
    totalSupply.bondUnits ?? totalSupply.bond ?? totalSupply.units,
  );

  if (!equityShares || !bondUnits) {
    throw new Error(
      'Proposal must define tokenizationInvestmentTerms.totalSupply.equityShares and tokenizationInvestmentTerms.totalSupply.bondUnits for token issuance',
    );
  }

  return {
    equityShares,
    bondUnits,
    hardCap: toPositiveWholeNumber(terms.hardCap),
  };
}

function buildAssetMetadataFromProposal({
  proposalId,
  stationId,
  metadataUri,
  proposalPayload,
  assetType,
  isinNumber,
  totalSupply,
  pricePerUnitHbar,
  cap,
}) {
  const payload =
    proposalPayload && typeof proposalPayload === 'object'
      ? proposalPayload
      : {};
  const terms =
    payload?.tokenizationInvestmentTerms &&
    typeof payload.tokenizationInvestmentTerms === 'object'
      ? payload.tokenizationInvestmentTerms
      : {};
  const location =
    payload?.locationInfrastructure &&
    typeof payload.locationInfrastructure === 'object'
      ? payload.locationInfrastructure
      : {};

  return {
    proposalId,
    stationId,
    assetType,
    stationName: terms.stationName || null,
    metadataUri: metadataUri || null,
    isin_number: isinNumber || null,
    tokenType: terms.tokenType || null,
    pricePerUnitHbar: toFiniteNumber(pricePerUnitHbar) ?? null,
    totalSupply: toPositiveWholeNumber(totalSupply) ?? null,
    hardCap: toPositiveWholeNumber(terms.hardCap ?? cap) ?? null,
    softCap: toPositiveWholeNumber(terms.softCap) ?? null,
    minimumInvestmentHbar: toFiniteNumber(terms.minimumInvestmentHbar) ?? null,
    lockupPeriod: terms.lockupPeriod || null,
    transferability: terms.transferability || null,
    redemptionModel: terms.redemptionModel || null,
    revenueSharePercent: toFiniteNumber(terms.revenueSharePercent) ?? null,
    exactCoordinates:
      location?.exactCoordinates &&
      typeof location.exactCoordinates === 'object'
        ? {
            lat: toFiniteNumber(location.exactCoordinates.lat) ?? null,
            lon: toFiniteNumber(location.exactCoordinates.lon) ?? null,
          }
        : null,
    geohash: location.geohash || null,
    locationHash: location.locationHash || null,
    proposalPayload,
  };
}

function parseLockupPeriodToMonths(lockupPeriod) {
  const text = String(lockupPeriod || '')
    .trim()
    .toLowerCase();
  if (!text) return null;
  const match = text.match(/(\d+)\s*month/);
  if (!match) return null;
  const months = Number(match[1]);
  if (!Number.isFinite(months) || months <= 0) return null;
  return Math.trunc(months);
}

function buildTokenCreateOverridesFromProposal({
  proposalPayload,
  stationName,
  assetType,
}) {
  const payload =
    proposalPayload && typeof proposalPayload === 'object'
      ? proposalPayload
      : {};
  const terms =
    payload?.tokenizationInvestmentTerms &&
    typeof payload.tokenizationInvestmentTerms === 'object'
      ? payload.tokenizationInvestmentTerms
      : {};
  const governance =
    payload?.governanceCompliance &&
    typeof payload.governanceCompliance === 'object'
      ? payload.governanceCompliance
      : {};

  const ownerAccount =
    typeof governance.operatorAddress === 'string' &&
    governance.operatorAddress.trim() !== ''
      ? governance.operatorAddress.trim()
      : String(process.env.ADMIN_ACCOUNT_ID || '0.0.7106098').trim();

  const base = {
    decimals: 6,
    isWhiteList: false,
    isControllable: true,
    arePartitionsProtected: false,
    isMultiPartition: false,
    clearingActive: false,
    internalKycActivated: false,
    externalPausesIds: [],
    externalControlListsIds: [],
    externalKycListsIds: [],
    adminAccountId: ownerAccount,
    diamondOwnerAccount: ownerAccount,
    regulationType: 1,
    regulationSubType: 0,
    currency: 'USD',
    currencyHex: '0x555344',
    erc20VotesActivated: false,
  };

  if (assetType === 'equity') {
    return {
      ...base,
      isCountryControlListWhiteList: false,
      countries: '',
      configId:
        '0x0000000000000000000000000000000000000000000000000000000000000001',
      configVersion: 0,
      votingRight: false,
      informationRight: true,
      liquidationRight: false,
      subscriptionRight: false,
      conversionRight: false,
      redemptionRight: false,
      putRight: false,
      dividendRight: 0,
      info: `ChargeFrog-${stationName} equity token for The ChargeFrog project - testnet`,
    };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const startingDate = nowSeconds + 3600;
  const lockupMonths = parseLockupPeriodToMonths(terms.lockupPeriod);
  const maturityDate = lockupMonths
    ? Math.trunc(startingDate + lockupMonths * 30 * 24 * 60 * 60)
    : Math.trunc(startingDate + 365 * 24 * 60 * 60);

  return {
    ...base,
    isCountryControlListWhiteList: true,
    countries: 'US',
    configId:
      '0x0000000000000000000000000000000000000000000000000000000000000002',
    configVersion: 1,
    nominalValue: '1',
    startingDate,
    maturityDate,
    info: `ChargeFrog-${stationName} bond token for The ChargeFrog project - testnet`,
  };
}

module.exports = {
  resolveProposalPayload,
  resolveSuppliesFromProposalPayload,
  buildAssetMetadataFromProposal,
  parseLockupPeriodToMonths,
  buildTokenCreateOverridesFromProposal,
};
