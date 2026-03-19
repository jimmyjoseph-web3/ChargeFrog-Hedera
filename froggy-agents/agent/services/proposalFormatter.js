const crypto = require('crypto');

const GEOHASH_BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

// Handles toFiniteNumber.
function toFiniteNumber(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

// Handles roundTo.
function roundTo(value, decimals) {
  const number = toFiniteNumber(value);
  if (number === undefined) return null;
  const factor = 10 ** decimals;
  return Math.round(number * factor) / factor;
}

// Handles sha256Hex.
function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

// Handles encodeGeohash.
function encodeGeohash(lat, lon, precision = 10) {
  const latitude = toFiniteNumber(lat);
  const longitude = toFiniteNumber(lon);
  if (latitude === undefined || longitude === undefined) {
    return null;
  }

  let idx = 0;
  let bit = 0;
  let even = true;
  let geohash = '';
  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;

  while (geohash.length < precision) {
    if (even) {
      const lonMid = (lonMin + lonMax) / 2;
      if (longitude >= lonMid) {
        idx = idx * 2 + 1;
        lonMin = lonMid;
      } else {
        idx = idx * 2;
        lonMax = lonMid;
      }
    } else {
      const latMid = (latMin + latMax) / 2;
      if (latitude >= latMid) {
        idx = idx * 2 + 1;
        latMin = latMid;
      } else {
        idx = idx * 2;
        latMax = latMid;
      }
    }
    even = !even;
    bit += 1;
    if (bit === 5) {
      geohash += GEOHASH_BASE32[idx];
      bit = 0;
      idx = 0;
    }
  }
  return geohash;
}

// Handles toIsoOrNull.
function toIsoOrNull(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

const SAMPLE_BASELINE = {
  locationInfrastructure: {
    landOwnershipType: 'Lease',
    leaseCostUsdMonthly: 12000,
    leaseTermYears: 10,
    gridCapacityAvailableKva: 350,
    gridUpgradeRequired: true,
    gridUpgradeCostUsd: 180000,
    localUtilityProvider: 'Con Edison (Consolidated Edison of New York)',
    zoningPermitStatus: 'Pending',
    permitCostUsd: 25000,
  },

  technicalChargingSpecs: {
    maxSitePowerKw: 300,
    peakConcurrentLoadKw: 260,
    loadBalancingSupport: true,
    smartChargingEnabled: true,
    remoteMonitoringOcppVersion: 'OCPP 1.6J',
    uptimeSlaPercent: 98.5,
    redundancyLevel: 'Single feed',
    futureExpansionCapacity: false,
    additionalStallsSupported: 0,
  },

  financialInputs: {
    capex: {
      chargerHardwareCostUsd: 140000,
      installationCivilWorksUsd: 210000,
      gridConnectionFeeUsd: 25000,
      softwareBackendSetupUsd: 5000,
      contingencyBufferPercent: 12,
    },
    opex: {
      electricityCostUsdPerKwh: 0.22,
      demandChargesUsdAnnual: 65000,
      maintenanceCostUsdAnnual: 14000,
      insuranceCostUsdAnnual: 6000,
      siteLeaseCostUsdAnnual: 144000,
      backendSaasFeesUsdAnnual: 7200,
    },
  },

  revenueModel: {
    pricingModel: 'Flat per kWh with peak/off-peak adjustment',
    pricePerKwhUsd: 0.39,
    expectedSessionsPerDay: 18,
    averageSessionLengthKwh: 28,
    treasurySettlementCurrency: 'Mixed',
  },

  riskSensitivityMetrics: {
    breakEvenUtilizationKwhPerMonth: 22000,
    worstCaseUtilizationKwhPerMonth: 9000,
    bestCaseUtilizationKwhPerMonth: 36000,
    revenueVariancePercent: 30,
    regulatoryRiskLevel: 'Medium',
    technologyObsolescenceRisk: 'Medium',
  },

  tokenizationInvestmentTerms: {
    tokenType: 'Equity',
    minimumInvestmentHbar: 1,
    lockupPeriod: '12 months',
    transferability: 'Non-transferable',
    redemptionModel: 'Monthly',
    revenueSharePercent: 85,
    yieldEstimateAprPercent: { min: 6, max: 16 },
  },

  governanceCompliance: {
    proposalExpiryDays: 30,
    executionDelayTimelockHours: 72,
    emergencyShutdownFlag: true,
    disputeResolutionMechanism:
      'DAO arbitration -> foundation mediation -> legal fallback',
  },
};

// Handles clamp.
function clamp(value, min, max) {
  const number = toFiniteNumber(value);
  if (number === undefined) return min;
  return Math.min(Math.max(number, min), max);
}

// Handles addDaysIso.
function addDaysIso(baseDate, days) {
  const when = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
  return toIsoOrNull(when.toISOString());
}

// Handles inferUtilityProvider.
function inferUtilityProvider({ area, lat, lon }) {
  const normalizedArea = String(area || '').toLowerCase();
  const inNyArea =
    normalizedArea.includes('new york') ||
    normalizedArea.includes('brooklyn') ||
    normalizedArea.includes('manhattan') ||
    normalizedArea.includes('queens') ||
    normalizedArea.includes('bronx');
  const inNyBounds =
    toFiniteNumber(lat) !== undefined &&
    toFiniteNumber(lon) !== undefined &&
    lat >= 40.45 &&
    lat <= 41.15 &&
    lon >= -74.35 &&
    lon <= -73.55;

  if (inNyArea || inNyBounds) {
    return SAMPLE_BASELINE.locationInfrastructure.localUtilityProvider;
  }
  return null;
}

// Handles scaleCost.
function scaleCost(value, scale) {
  const number = toFiniteNumber(value);
  if (number === undefined) return null;
  return Math.round(number * scale);
}

// Handles buildProposedStationName.
function buildProposedStationName({ area, geohash, lat, lon }) {
  const normalizedArea = String(area || '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalizedArea) {
    return normalizedArea;
  }
  if (lat !== null && lon !== null) {
    return `Site ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }
  if (geohash) {
    return `Site ${String(geohash).slice(0, 6).toUpperCase()}`;
  }
  return 'Proposed Site';
}

// Handles normalizeStationNameCandidate.
function normalizeStationNameCandidate(value) {
  const cleaned = String(value || '')
    .replace(/[^\w\s,&/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || null;
}

// Handles resolveProposedStationName.
function resolveProposedStationName({ finderResult, geohash, lat, lon }) {
  const explicit = normalizeStationNameCandidate(finderResult?.proposedStationName);
  if (explicit) {
    return explicit.replace(/^chargefrog\s+station\s*-\s*/i, '').trim() || 'Proposed Site';
  }
  return buildProposedStationName({
    area: finderResult?.area,
    geohash,
    lat,
    lon,
  });
}

// Handles buildProposalModel.
function buildProposalModel({
  finderResult,
  cap,
  shares,
  pricing,
  stationId = null,
  proposalId = null,
  metadataUri = null,
  txHash = null,
  now = new Date(),
}) {
  const proposedLat = roundTo(finderResult?.proposedArea?.lat, 6);
  const proposedLon = roundTo(finderResult?.proposedArea?.lon, 6);
  const geohash = encodeGeohash(proposedLat, proposedLon, 9);
  const locationHash =
    proposedLat !== null && proposedLon !== null
      ? `0x${sha256Hex(`${proposedLat},${proposedLon}`)}`
      : null;

  const bestStation = finderResult?.bestStation || null;
  const observedPowerKw =
    toFiniteNumber(bestStation?.availabilitySummary?.maxPowerKW) ||
    SAMPLE_BASELINE.technicalChargingSpecs.maxSitePowerKw;
  const totalConnectors =
    toFiniteNumber(bestStation?.availabilitySummary?.totalConnectors) ||
    toFiniteNumber(bestStation?.connectorCount) ||
    8;
  const availableConnectors =
    toFiniteNumber(bestStation?.availabilitySummary?.available) ||
    Math.round(totalConnectors * 0.6);
  const equityPriceHbar = toFiniteNumber(pricing?.equityPriceHbar) || 1;
  const bondPriceHbar = toFiniteNumber(pricing?.bondPriceHbar) || 1;
  const hbarUsdFromPricing = toFiniteNumber(pricing?.hbarUsdPrice);
  const hbarUsdFromEnv = toFiniteNumber(process.env.STATION_HBAR_USD);
  const hbarUsdPrice =
    hbarUsdFromPricing && hbarUsdFromPricing > 0
      ? hbarUsdFromPricing
      : hbarUsdFromEnv && hbarUsdFromEnv > 0
        ? hbarUsdFromEnv
        : 0.1015;
  const minInvestmentTargetUsd = Math.max(
    toFiniteNumber(process.env.STATION_MIN_INVESTMENT_TARGET_USD) || 120000,
    50000,
  );
  const powerScale = clamp(
    observedPowerKw / SAMPLE_BASELINE.technicalChargingSpecs.maxSitePowerKw,
    0.7,
    1.8,
  );
  const connectorScale = clamp(totalConnectors / 8, 0.7, 1.8);
  const blendedScale = roundTo((powerScale + connectorScale) / 2, 3) || 1;

  const capexBase = SAMPLE_BASELINE.financialInputs.capex;
  const opexBase = SAMPLE_BASELINE.financialInputs.opex;
  const capexBreakdown = {
    chargerHardwareCostUsd: scaleCost(
      capexBase.chargerHardwareCostUsd,
      blendedScale,
    ),
    installationCivilWorksUsd: scaleCost(
      capexBase.installationCivilWorksUsd,
      blendedScale,
    ),
    gridConnectionFeeUsd: scaleCost(
      capexBase.gridConnectionFeeUsd,
      blendedScale,
    ),
    softwareBackendSetupUsd: scaleCost(
      capexBase.softwareBackendSetupUsd,
      blendedScale,
    ),
    contingencyBufferPercent: capexBase.contingencyBufferPercent,
  };
  const capexSubtotal =
    (capexBreakdown.chargerHardwareCostUsd || 0) +
    (capexBreakdown.installationCivilWorksUsd || 0) +
    (capexBreakdown.gridConnectionFeeUsd || 0) +
    (capexBreakdown.softwareBackendSetupUsd || 0);
  const contingencyBufferUsd = roundTo(
    capexSubtotal * ((capexBreakdown.contingencyBufferPercent || 0) / 100),
    0,
  );
  const totalCapexUsd = roundTo(capexSubtotal + (contingencyBufferUsd || 0), 0);

  const opexBreakdown = {
    electricityCostUsdPerKwh: opexBase.electricityCostUsdPerKwh,
    demandChargesUsdAnnual: scaleCost(
      opexBase.demandChargesUsdAnnual,
      blendedScale,
    ),
    maintenanceCostUsdAnnual: scaleCost(
      opexBase.maintenanceCostUsdAnnual,
      blendedScale,
    ),
    insuranceCostUsdAnnual: scaleCost(
      opexBase.insuranceCostUsdAnnual,
      blendedScale,
    ),
    siteLeaseCostUsdAnnual: scaleCost(
      opexBase.siteLeaseCostUsdAnnual,
      blendedScale,
    ),
    backendSaasFeesUsdAnnual: scaleCost(
      opexBase.backendSaasFeesUsdAnnual,
      blendedScale,
    ),
  };
  const totalOpexAnnualUsd =
    (opexBreakdown.demandChargesUsdAnnual || 0) +
    (opexBreakdown.maintenanceCostUsdAnnual || 0) +
    (opexBreakdown.insuranceCostUsdAnnual || 0) +
    (opexBreakdown.siteLeaseCostUsdAnnual || 0) +
    (opexBreakdown.backendSaasFeesUsdAnnual || 0);

  const sessionsPerDay = Math.max(
    10,
    Math.round(
      SAMPLE_BASELINE.revenueModel.expectedSessionsPerDay *
        (availableConnectors / 5) *
        clamp(observedPowerKw / 300, 0.6, 1.7),
    ),
  );
  const averageSessionLengthKwh =
    SAMPLE_BASELINE.revenueModel.averageSessionLengthKwh;
  const monthlyEnergySoldKwh = Math.round(
    sessionsPerDay * averageSessionLengthKwh * 30,
  );
  const pricePerKwhUsd = SAMPLE_BASELINE.revenueModel.pricePerKwhUsd;
  const grossMonthlyRevenueUsd = roundTo(
    monthlyEnergySoldKwh * pricePerKwhUsd,
    0,
  );

  const utilizationScale = clamp(monthlyEnergySoldKwh / 25000, 0.6, 2.2);
  const breakEvenKwh = roundTo(
    SAMPLE_BASELINE.riskSensitivityMetrics.breakEvenUtilizationKwhPerMonth *
      utilizationScale,
    0,
  );
  const worstCaseKwh = roundTo(
    SAMPLE_BASELINE.riskSensitivityMetrics.worstCaseUtilizationKwhPerMonth *
      utilizationScale,
    0,
  );
  const bestCaseKwh = roundTo(
    SAMPLE_BASELINE.riskSensitivityMetrics.bestCaseUtilizationKwhPerMonth *
      utilizationScale,
    0,
  );

  const breakEvenUtilizationPercent = monthlyEnergySoldKwh
    ? roundTo((breakEvenKwh / monthlyEnergySoldKwh) * 100, 2)
    : null;
  const worstCaseUtilizationPercent = monthlyEnergySoldKwh
    ? roundTo((worstCaseKwh / monthlyEnergySoldKwh) * 100, 2)
    : null;
  const bestCaseUtilizationPercent = monthlyEnergySoldKwh
    ? roundTo((bestCaseKwh / monthlyEnergySoldKwh) * 100, 2)
    : null;

  const configuredCapUsd = toFiniteNumber(cap);
  const operationalRunwayMultiplier =
    toFiniteNumber(process.env.STATION_OPEX_RUNWAY_YEARS) || 2;
  const modeledInvestmentTargetUsd = roundTo(
    (totalCapexUsd || 0) + totalOpexAnnualUsd * operationalRunwayMultiplier,
    0,
  );
  const investmentTargetUsd = Math.max(
    modeledInvestmentTargetUsd || 0,
    configuredCapUsd || 0,
    minInvestmentTargetUsd,
  );
  const investmentTargetHbarEquivalent = roundTo(
    investmentTargetUsd / hbarUsdPrice,
    0,
  );
  const proportionalEquitySupply = roundTo(
    investmentTargetHbarEquivalent / equityPriceHbar,
    0,
  );
  const proportionalBondSupply = roundTo(
    investmentTargetHbarEquivalent / bondPriceHbar,
    0,
  );
  const hardCap = roundTo(
    Math.max(proportionalEquitySupply || 0, proportionalBondSupply || 0),
    0,
  );
  const softCap = hardCap
    ? roundTo(hardCap >= 75000 ? 75000 : hardCap * 0.72, 0)
    : null;
  const stationTokenType = String(
    process.env.STATION_TOKEN_TYPE ||
      SAMPLE_BASELINE.tokenizationInvestmentTerms.tokenType,
  );

  const proposalExpiryDate = addDaysIso(
    now,
    SAMPLE_BASELINE.governanceCompliance.proposalExpiryDays,
  );
  const operatorAddress =
    String(process.env.ADMIN_ACCOUNT_ID || '').trim() || null;
  const treasuryAddress =
    String(
      process.env.DAO_TREASURY_ADDRESS ||
        process.env.DAO_TREASURY_ACCOUNT_ID ||
        '',
    ).trim() || null;

  const localUtilityProvider =
    inferUtilityProvider({
      area: finderResult?.area,
      lat: proposedLat,
      lon: proposedLon,
    }) || null;
  const inferredGridKva =
    roundTo(observedPowerKw * 1.67, 0) ||
    SAMPLE_BASELINE.locationInfrastructure.gridCapacityAvailableKva;
  const gridUpgradeRequired = observedPowerKw > inferredGridKva * 0.8;
  const gridUpgradeCostUsd = gridUpgradeRequired ? 18000 : 0;
  const peakConcurrentLoadKw = roundTo(observedPowerKw * 0.87, 0);
  const additionalStallsSupported = Math.max(
    SAMPLE_BASELINE.technicalChargingSpecs.additionalStallsSupported,
    Math.round(totalConnectors * 0.5),
  );
  const baseStationName = resolveProposedStationName({
    finderResult,
    geohash,
    lat: proposedLat,
    lon: proposedLon,
  });
  const stationName = `ChargeFrog Station - ${baseStationName}`.trim();

  const model = {
    locationInfrastructure: {
      exactCoordinates: {
        lat: proposedLat,
        lon: proposedLon,
      },
      geohash,
      locationHash,
      landOwnershipType:
        SAMPLE_BASELINE.locationInfrastructure.landOwnershipType,
      leaseCost: {
        usdMonthly: roundTo(
          SAMPLE_BASELINE.locationInfrastructure.leaseCostUsdMonthly *
            blendedScale,
          0,
        ),
        hbarMonthly: roundTo(
          (SAMPLE_BASELINE.locationInfrastructure.leaseCostUsdMonthly *
            blendedScale) /
            hbarUsdPrice,
          2,
        ),
        termYears: SAMPLE_BASELINE.locationInfrastructure.leaseTermYears,
      },
      gridCapacityAvailableKva: inferredGridKva,
      gridUpgradeRequired,
      gridUpgradeCostUsd,
      localUtilityProvider,
      zoningPermitStatus:
        SAMPLE_BASELINE.locationInfrastructure.zoningPermitStatus,
      permitCostUsd: SAMPLE_BASELINE.locationInfrastructure.permitCostUsd,
    },
    technicalChargingSpecs: {
      maxSitePowerKw: observedPowerKw,
      peakConcurrentLoadKw,
      loadBalancingSupport:
        SAMPLE_BASELINE.technicalChargingSpecs.loadBalancingSupport,
      smartChargingEnabled:
        SAMPLE_BASELINE.technicalChargingSpecs.smartChargingEnabled,
      remoteMonitoringOcppVersion:
        SAMPLE_BASELINE.technicalChargingSpecs.remoteMonitoringOcppVersion,
      uptimeSlaPercent: SAMPLE_BASELINE.technicalChargingSpecs.uptimeSlaPercent,
      redundancyLevel: SAMPLE_BASELINE.technicalChargingSpecs.redundancyLevel,
      futureExpansionCapacity:
        SAMPLE_BASELINE.technicalChargingSpecs.futureExpansionCapacity,
      additionalStallsSupported,
    },
    financialInputs: {
      capexBreakdown: {
        ...capexBreakdown,
        contingencyBufferUsd,
      },
      totalCapexUsd,
      opexBreakdown,
      totalOpexAnnualUsd,
    },
    revenueModel: {
      pricingModel: SAMPLE_BASELINE.revenueModel.pricingModel,
      pricePerKwhUsd,
      pricePerKwhHbar: roundTo(pricePerKwhUsd / hbarUsdPrice, 6),
      expectedSessionsPerDay: sessionsPerDay,
      averageSessionLengthKwh,
      monthlyEnergySoldKwh,
      grossMonthlyRevenue: {
        usd: grossMonthlyRevenueUsd,
        hbarEquivalent: roundTo(grossMonthlyRevenueUsd / hbarUsdPrice, 2),
      },
      treasurySettlementCurrency:
        SAMPLE_BASELINE.revenueModel.treasurySettlementCurrency,
    },
    riskSensitivityMetrics: {
      breakEvenUtilizationPercent,
      breakEvenUtilizationKwhPerMonth: breakEvenKwh,
      worstCaseUtilizationPercent: worstCaseUtilizationPercent,
      worstCaseUtilizationKwhPerMonth: worstCaseKwh,
      bestCaseUtilizationPercent: bestCaseUtilizationPercent,
      bestCaseUtilizationKwhPerMonth: bestCaseKwh,
      electricityPriceSensitivity:
        'Every +USD 0.01/kWh reduces annual profit by approximately USD 3,000',
      revenueVariancePercent:
        SAMPLE_BASELINE.riskSensitivityMetrics.revenueVariancePercent,
      regulatoryRiskLevel:
        SAMPLE_BASELINE.riskSensitivityMetrics.regulatoryRiskLevel,
      technologyObsolescenceRisk:
        SAMPLE_BASELINE.riskSensitivityMetrics.technologyObsolescenceRisk,
    },
    tokenizationInvestmentTerms: {
      stationId,
      proposalId,
      stationName,
      investmentTargetUsd: investmentTargetUsd ?? null,
      investmentTargetHbarEquivalent: investmentTargetHbarEquivalent ?? null,
      tokenType: stationTokenType,
      tokenPriceHbar: {
        equity: equityPriceHbar,
        bond: bondPriceHbar,
      },
      totalSupply: {
        equityShares: proportionalEquitySupply ?? null,
        bondUnits: proportionalBondSupply ?? null,
      },
      hardCap: hardCap ?? null,
      softCap: softCap ?? null,
      minimumInvestmentHbar:
        SAMPLE_BASELINE.tokenizationInvestmentTerms.minimumInvestmentHbar,
      lockupPeriod: SAMPLE_BASELINE.tokenizationInvestmentTerms.lockupPeriod,
      transferability:
        SAMPLE_BASELINE.tokenizationInvestmentTerms.transferability,
      redemptionModel:
        SAMPLE_BASELINE.tokenizationInvestmentTerms.redemptionModel,
      revenueSharePercent:
        SAMPLE_BASELINE.tokenizationInvestmentTerms.revenueSharePercent,
      yieldEstimateAprPercent:
        SAMPLE_BASELINE.tokenizationInvestmentTerms.yieldEstimateAprPercent,
    },
    governanceCompliance: {
      proposalExpiryDate,
      executionDelayTimelockHours:
        SAMPLE_BASELINE.governanceCompliance.executionDelayTimelockHours,
      operatorAddress,
      treasuryAddress,
      emergencyShutdownFlag:
        SAMPLE_BASELINE.governanceCompliance.emergencyShutdownFlag,
      disputeResolutionMechanism:
        SAMPLE_BASELINE.governanceCompliance.disputeResolutionMechanism,
    },
    metadataProofAnchors: {
      offChainMetadataUri: metadataUri,
      externalDataSources: [
        'TomTom POI Search',
        'TomTom Charging Availability',
      ],
      oracleUsedHbarUsd: hbarUsdPrice,
      lastUpdatedTimestamp: now.toISOString(),
      anchorTxHash: txHash,
    },
  };

  return model;
}

// Handles buildIpfsProposalPayload.
function buildIpfsProposalPayload(proposalPayload = {}) {
  const source =
    proposalPayload && typeof proposalPayload === 'object'
      ? proposalPayload
      : {};
  return {
    locationInfrastructure: source.locationInfrastructure || {},
    technicalChargingSpecs: source.technicalChargingSpecs || {},
    financialInputs: source.financialInputs || {},
    revenueModel: source.revenueModel || {},
    riskSensitivityMetrics: source.riskSensitivityMetrics || {},
    tokenizationInvestmentTerms: source.tokenizationInvestmentTerms || {},
    governanceCompliance: source.governanceCompliance || {},
  };
}

module.exports = {
  buildProposalModel,
  buildIpfsProposalPayload,
  encodeGeohash,
  sha256Hex,
};
