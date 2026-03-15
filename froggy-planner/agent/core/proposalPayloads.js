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
} = {}) {
  const payload =
    proposalPayload && typeof proposalPayload === 'object'
      ? proposalPayload
      : {};
  const terms =
    payload?.tokenizationInvestmentTerms &&
    typeof payload.tokenizationInvestmentTerms === 'object'
      ? payload.tokenizationInvestmentTerms
      : {};
  const normalizedAssetType = String(assetType || '')
    .trim()
    .toLowerCase();
  const lockupMonths = parseLockupPeriodToMonths(terms.lockupPeriod);
  const transferability =
    terms.transferability !== undefined ? terms.transferability : undefined;
  const overrides = {
    stationName: stationName || terms.stationName || undefined,
  };

  if (lockupMonths !== null) {
    overrides.lockupPeriodInMonths = lockupMonths;
  }
  if (transferability !== undefined) {
    overrides.transferability = transferability;
  }

  if (normalizedAssetType === 'equity') {
    const revenueSharePercent = toFiniteNumber(terms.revenueSharePercent);
    if (revenueSharePercent !== undefined) {
      overrides.revenueSharePercent = revenueSharePercent;
    }
    return overrides;
  }

  if (normalizedAssetType === 'bond') {
    const couponRate = toFiniteNumber(
      terms.couponRate ??
        terms.couponRatePercent ??
        terms.bondCouponRate ??
        terms.interestRate,
    );
    if (couponRate !== undefined) {
      overrides.couponRate = couponRate;
    }
    if (terms.startingDate !== undefined) {
      overrides.startingDate = terms.startingDate;
    }
    if (terms.maturityDate !== undefined) {
      overrides.maturityDate = terms.maturityDate;
    }
    if (terms.redemptionModel !== undefined) {
      overrides.redemptionModel = terms.redemptionModel;
    }
  }

  return overrides;
}

module.exports = {
  resolveProposalPayload,
  resolveSuppliesFromProposalPayload,
  buildAssetMetadataFromProposal,
  parseLockupPeriodToMonths,
  buildTokenCreateOverridesFromProposal,
};
