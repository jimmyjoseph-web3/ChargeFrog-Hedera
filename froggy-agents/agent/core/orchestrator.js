const crypto = require('crypto');
const { ensureConnected } = require('../../clients/atsClient');
const { callInternalA2aAgent } = require('../../http/internalA2a');
const { agentTools } = require('../tools');
const { buildProposalModel } = require('../services/proposalFormatter');
const {
  toFiniteNumber,
  normalizeWalletAddress,
  logStructured,
  normalizeReasoningEffort,
} = require('./shared');
const {
  parseLatLonFromMessage,
  normalizeAreaForTomTom,
  parseStationId,
  parseStationNameHint,
  findBestStationByNameHint,
  parseProposalId,
  parseAmount,
  parseRequestedAssetType,
  isBalanceQueryMessage,
  isInvestmentExecutionMessage,
  toPositiveWholeNumber,
  normalizeStationName,
  buildTokenSymbol,
  normalizeWorkflowIntent,
  evaluateChatDomainScope,
} = require('./parsing');
const {
  resolveProposalPayload,
  resolveSuppliesFromProposalPayload,
  buildAssetMetadataFromProposal,
  buildTokenCreateOverridesFromProposal,
} = require('./proposalPayloads');
const {
  summarizeAvailability,
  computeStationScore,
  deriveProposedAreaFromChargingEvidence,
  deriveProposedStationName,
  buildProposalDescription,
} = require('./stationPlanning');
const {
  createInvestmentProposalDraftWithLlm,
  classifyWorkflowIntent,
} = require('./llm');
const {
  AGENTS,
  STATE,
  INTENT,
  TOOL_DEFINITIONS,
  DECISION_POLICIES,
  PROMPT_VERSION,
} = require('../config/constants');
const {
  INTENT_CLASSIFIER_PROMPT,
  ORCHESTRATOR_PROMPT,
  STATION_FINDER_PROMPT,
  INVESTMENT_PROPOSAL_GENERATOR_PROMPT,
  STATION_ASSET_ISSUER_PROMPT,
} = require('../config/prompts');

const AGENT_PROMPTS = {
  intent: INTENT_CLASSIFIER_PROMPT,
  orchestrator: ORCHESTRATOR_PROMPT,
  stationFinder: STATION_FINDER_PROMPT,
  investmentProposalGenerator: INVESTMENT_PROPOSAL_GENERATOR_PROMPT,
  stationAssetIssuer: STATION_ASSET_ISSUER_PROMPT,
};

// Runtime behavior: the public coordinator delegates to internal worker agents
// over internal A2A, and worker agents invoke local tools directly.
let initPromise;
const PLANNER_WORKER_ENDPOINTS = Object.freeze({
  froggyFoundry: '/a2a/froggy-foundry',
  stationFinder: '/a2a/station-finder',
  investmentProposalGenerator: '/a2a/investment-proposal-generator',
  stationAssetIssuer: '/a2a/station-asset-issuer',
});

const PENDING_ADMIN_ACTION_REPLY =
  'Thank you for your interest! We are so happy with the successful funding of this station, now we need the ChargeFrog Team to greenlight the deployment and issuance of equity and bond tokens.';
const FOUNDRY_APPROVAL_REPLY =
  'would you like to approve this station, this would mean deployment on hedera testnet through the chargefrog contracts, and the creation of equity and bond stations';

// Handles callTool.
async function callTool({
  correlationId,
  agent,
  toolName,
  args,
  required = true,
}) {
  const startedAt = Date.now();
  if (!agentTools[toolName]) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  try {
    const data = await agentTools[toolName](args || {});
    logStructured({
      correlationId,
      agent,
      action: `tool:${toolName}`,
      input: args,
      outputSummary: {
        ok: true,
        keys:
          data && typeof data === 'object'
            ? Object.keys(data).slice(0, 12)
            : [],
      },
      success: true,
      durationMs: Date.now() - startedAt,
    });
    return { ok: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStructured({
      correlationId,
      level: required ? 'error' : 'warn',
      agent,
      action: `tool:${toolName}`,
      input: args,
      outputSummary: { ok: false },
      success: false,
      durationMs: Date.now() - startedAt,
      error: message,
    });
    if (required) {
      throw new Error(`${toolName} failed: ${message}`);
    }
    return { ok: false, error: message };
  }
}

async function callWorkerAgent({
  callerAgent,
  endpointPath,
  payload,
  correlationId,
  action,
}) {
  const startedAt = Date.now();
  try {
    const result = await callInternalA2aAgent({
      endpointPath,
      data: payload,
      metadata: {
        correlationId,
        source: callerAgent,
      },
    });
    logStructured({
      correlationId,
      agent: callerAgent,
      action,
      input: payload,
      outputSummary:
        result && typeof result === 'object'
          ? {
              status: result.status || null,
              keys: Object.keys(result).slice(0, 12),
            }
          : { status: null },
      success: true,
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStructured({
      correlationId,
      level: 'error',
      agent: callerAgent,
      action,
      input: payload,
      outputSummary: {},
      success: false,
      durationMs: Date.now() - startedAt,
      error: message,
    });
    throw error;
  }
}

async function callPlannerWorkerAgent({
  endpointPath,
  payload,
  correlationId,
  action,
}) {
  return callWorkerAgent({
    callerAgent: AGENTS.ORCHESTRATOR,
    endpointPath,
    payload,
    correlationId,
    action,
  });
}

function buildDefaultFoundryProjectUrl(stationId) {
  const rawBase = String(
    process.env.CHARGEFROG_STATION_PROJECT_BASE_URL ||
      process.env.FROGGY_PLANNER_PUBLIC_BASE_URL ||
      'https://chargefrog.vercel.app',
  )
    .trim()
    .replace(/\/$/, '');

  const normalizedStationId = toPositiveWholeNumber(stationId);
  if (!normalizedStationId) {
    return `${rawBase}/stations`;
  }
  return `${rawBase}/stations/${normalizedStationId}`;
}

// Handles ensureWalletForAction.
function ensureWalletForAction(walletAddress, actionLabel) {
  if (walletAddress) return;
  throw new Error(`walletAddress is required for ${actionLabel}`);
}

// Handles runStationFinderAgent.
async function runStationFinderAgent({
  message,
  walletAddress,
  intentAnalysis,
  correlationId,
}) {
  const toolTrace = [];
  const area = normalizeAreaForTomTom(
    String(intentAnalysis?.area || parseLocation(message) || ''),
  );
  const explicitCoordinates = parseLatLonFromMessage(message);

  if (!area && !explicitCoordinates) {
    return {
      status: 'missing_area',
      reply:
        'I can run station discovery, but I need a target area or coordinates first. Example: "near Barclays Center, New York" or "lat 40.68, lon -73.97".',
      toolTrace,
    };
  }

  const resolveCenterArgs = {};
  if (area) {
    resolveCenterArgs.area = area;
  }
  if (explicitCoordinates) {
    resolveCenterArgs.lat = explicitCoordinates.lat;
    resolveCenterArgs.lon = explicitCoordinates.lon;
  }

  const areaCenter = await callTool({
    correlationId,
    agent: AGENTS.STATION_FINDER,
    toolName: 'resolveAreaCenter',
    args: resolveCenterArgs,
  });
  toolTrace.push({
    tool: 'resolveAreaCenter',
    arguments: resolveCenterArgs,
    resultSummary: {
      center: areaCenter.data.center,
      resolutionSource: areaCenter.data.resolutionSource,
    },
  });

  const center = areaCenter.data?.center;
  if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lon)) {
    return {
      status: 'poi_resolution_failed',
      reply:
        'I could not resolve the requested area to a valid location. Please try a more specific place name.',
      toolTrace,
    };
  }

  const resolvedArea =
    normalizeAreaForTomTom(String(areaCenter.data?.area || area || '')) ||
    `Lat ${center.lat.toFixed(6)}, Lon ${center.lon.toFixed(6)}`;

  if (!walletAddress) {
    return {
      status: 'wallet_required_for_interest',
      reply:
        'To register your interest in this location, please provide walletAddress.',
      area: resolvedArea,
      anchor: center,
      toolTrace,
    };
  }

  const timestamp = new Date().toISOString();
  const interest = await callTool({
    correlationId,
    agent: AGENTS.STATION_FINDER,
    toolName: 'registerMiniNode',
    args: {
      lat: center.lat,
      lon: center.lon,
      walletAddress,
      timestamp,
    },
  });
  toolTrace.push({
    tool: 'registerMiniNode',
    arguments: {
      lat: center.lat,
      lon: center.lon,
      walletAddress,
      timestamp,
    },
    resultSummary: {
      insertedId: interest.data.insertedId,
    },
  });

  const neighborhood = await callTool({
    correlationId,
    agent: AGENTS.STATION_FINDER,
    toolName: 'getNeighborhoodSummary',
    args: {
      lat: center.lat,
      lon: center.lon,
      radiusMiles: DECISION_POLICIES.defaultNeighborhoodRadiusMiles,
      threshold: DECISION_POLICIES.defaultInterestThreshold,
    },
  });
  toolTrace.push({
    tool: 'getNeighborhoodSummary',
    arguments: {
      lat: center.lat,
      lon: center.lon,
      radiusMiles: DECISION_POLICIES.defaultNeighborhoodRadiusMiles,
      threshold: DECISION_POLICIES.defaultInterestThreshold,
    },
    resultSummary: {
      count: neighborhood.data.count,
      triggerThreshold: neighborhood.data.triggerThreshold,
      shouldTriggerProposal: neighborhood.data.shouldTriggerProposal,
      centroid: neighborhood.data.centroid,
    },
  });

  if (!neighborhood.data.shouldTriggerProposal) {
    return {
      status: 'not_enough_interest',
      reply: `Not enough interests in the area yet, please check back soon. Current count: ${neighborhood.data.count}, threshold: ${neighborhood.data.triggerThreshold}.`,
      currentCount: neighborhood.data.count,
      threshold: neighborhood.data.triggerThreshold,
      area: resolvedArea,
      anchor: center,
      toolTrace,
    };
  }

  const centroid = neighborhood.data.centroid || center;
  const stationCandidates = await callTool({
    correlationId,
    agent: AGENTS.STATION_FINDER,
    toolName: 'getPoi',
    args: {
      lat: centroid.lat,
      lon: centroid.lon,
      radius: DECISION_POLICIES.candidateRadiusMeters,
      query: 'ev charging station',
      limit: DECISION_POLICIES.candidateLimit,
    },
  });
  toolTrace.push({
    tool: 'getPoi',
    arguments: {
      lat: centroid.lat,
      lon: centroid.lon,
      radius: DECISION_POLICIES.candidateRadiusMeters,
      query: 'ev charging station',
      limit: DECISION_POLICIES.candidateLimit,
    },
    resultSummary: {
      totalResults: stationCandidates.data.totalResults,
      center: stationCandidates.data.center,
    },
  });

  const availabilityIds = (stationCandidates.data?.pointsOfInterest || [])
    .map((point) => point.chargingAvailabilityId)
    .filter((id) => Boolean(id))
    .slice(0, 15);

  let availabilityMap = new Map();
  if (availabilityIds.length > 0) {
    const optionalAvailability = await callTool({
      correlationId,
      agent: AGENTS.STATION_FINDER,
      toolName: 'getChargingAvailability',
      args: { chargingAvailabilityIds: availabilityIds },
      required: false,
    });
    if (optionalAvailability.ok) {
      availabilityMap = new Map(
        (optionalAvailability.data?.chargingStations || []).map((entry) => [
          entry.chargingAvailabilityId,
          entry,
        ]),
      );
      toolTrace.push({
        tool: 'getChargingAvailability',
        arguments: { chargingAvailabilityIds: availabilityIds },
        resultSummary: {
          successfulCount: optionalAvailability.data.successfulCount,
          failedCount: optionalAvailability.data.failedCount,
        },
      });
    } else {
      toolTrace.push({
        tool: 'getChargingAvailability',
        arguments: { chargingAvailabilityIds: availabilityIds },
        resultSummary: {
          degraded: true,
          reason: optionalAvailability.error,
        },
      });
    }
  } else {
    toolTrace.push({
      tool: 'getChargingAvailability',
      arguments: { chargingAvailabilityIds: availabilityIds },
      resultSummary: {
        degraded: true,
        reason: 'no chargingAvailabilityId candidates returned by POI',
      },
    });
  }

  const rankedStations = (stationCandidates.data?.pointsOfInterest || [])
    .map((station) => {
      const stationAvailability = availabilityMap.get(
        station.chargingAvailabilityId,
      );
      const availabilitySummary = summarizeAvailability(
        stationAvailability?.connectors || [],
      );
      const connectorCount = Array.isArray(station.connectors)
        ? station.connectors.length
        : 0;
      return {
        id: station.id,
        name: station.name,
        address: station.address,
        position: station.position,
        chargingAvailabilityId: station.chargingAvailabilityId,
        connectorCount,
        availabilitySummary,
        score: computeStationScore({ connectorCount, availabilitySummary }),
      };
    })
    .sort((a, b) => b.score - a.score);

  const bestStation = rankedStations[0] || null;
  const proposedArea =
    deriveProposedAreaFromChargingEvidence({
      centroid,
      rankedStations,
      maxShiftMeters: Math.max(
        Math.trunc((DECISION_POLICIES.candidateRadiusMeters || 5000) * 0.5),
        1500,
      ),
    }) || centroid;
  const reverseGeocode = await callTool({
    correlationId,
    agent: AGENTS.STATION_FINDER,
    toolName: 'reverseGeocode',
    args: {
      lat: proposedArea.lat,
      lon: proposedArea.lon,
    },
    required: false,
  });
  const proposedStationLabel = deriveProposedStationName({
    centroid: proposedArea,
    preferredArea: resolvedArea,
    bestStation,
    rankedStations,
    reverseGeocode: reverseGeocode.ok ? reverseGeocode.data : null,
  });
  const proposedStationName =
    `ChargeFrog Station - ${proposedStationLabel}`.trim();
  toolTrace.push({
    tool: 'proposeStationArea',
    arguments: {
      centroid,
      candidateCount: rankedStations.length,
    },
    resultSummary: {
      proposedArea,
      source: proposedArea?.source || 'unknown',
    },
  });
  toolTrace.push({
    tool: 'reverseGeocode',
    arguments: {
      lat: proposedArea.lat,
      lon: proposedArea.lon,
    },
    resultSummary: reverseGeocode.ok
      ? {
          freeformAddress:
            reverseGeocode.data?.address?.freeformAddress || null,
          municipality: reverseGeocode.data?.address?.municipality || null,
          municipalitySubdivision:
            reverseGeocode.data?.address?.municipalitySubdivision || null,
          neighborhood: reverseGeocode.data?.address?.neighborhood || null,
          proposedStationName,
        }
      : {
          degraded: true,
          reason: reverseGeocode.error,
          proposedStationName,
        },
  });

  const rationale = bestStation
    ? `Threshold met. Proposed area for ${proposedStationName} is (${proposedArea.lat.toFixed(6)}, ${proposedArea.lon.toFixed(6)}) from centroid + charging availability evidence. Best nearby evidence: ${bestStation.name || 'Unnamed'} (score ${bestStation.score.toFixed(2)}).`
    : `Threshold met. Proposed area for ${proposedStationName} is (${proposedArea.lat.toFixed(6)}, ${proposedArea.lon.toFixed(6)}) from centroid evidence.`;

  return {
    status: 'candidate_ready',
    reply:
      'Interest threshold met. I prepared a proposed station area and rationale. Passing to Investment Proposal Generator for proposal generation.',
    area: resolvedArea,
    anchor: center,
    neighborhood: neighborhood.data,
    proposedArea,
    proposedStationName,
    rationale,
    bestStation,
    rankedStations: rankedStations.slice(0, 5),
    toolTrace,
  };
}

// Handles runInvestmentProposalGeneratorAgent.
async function runInvestmentProposalGeneratorAgent({
  finderResult,
  correlationId,
}) {
  const toolTrace = [];
  if (!finderResult || finderResult.status !== 'candidate_ready') {
    return {
      status: 'skipped',
      reply:
        'Investment Proposal Generator skipped because Station Finder did not produce a candidate.',
      toolTrace,
    };
  }

  const existingStation = await callTool({
    correlationId,
    agent: AGENTS.INVESTMENT_PROPOSAL_GENERATOR,
    toolName: 'findStationByLocation',
    args: {
      location: finderResult.proposedArea,
      radiusMeters: DECISION_POLICIES.duplicateStationRadiusMeters,
    },
    required: false,
  });
  toolTrace.push({
    tool: 'findStationByLocation',
    arguments: {
      location: finderResult.proposedArea,
      radiusMeters: DECISION_POLICIES.duplicateStationRadiusMeters,
    },
    resultSummary: existingStation.ok
      ? existingStation.data
        ? {
            stationId: existingStation.data.stationId,
            stage: existingStation.data.stage,
            distanceMeters: existingStation.data.distanceMeters,
          }
        : { stationFound: false }
      : {
          degraded: true,
          reason: existingStation.error,
        },
  });

  if (existingStation.ok && existingStation.data) {
    return {
      status: 'proposal_blocked_existing_station',
      reply:
        `A station already exists near this recommended area (station ${existingStation.data.stationId}, ` +
        `stage: ${existingStation.data.stage}). Proposal creation is blocked to avoid duplicates.`,
      existingStation: existingStation.data,
      toolTrace,
    };
  }

  const shares = Number(process.env.STATION_DEFAULT_SHARES || 1000);
  const cap = Number(process.env.STATION_DEFAULT_CAP || shares);
  const pricing = {
    equityPriceHbar: Number(process.env.STATION_EQUITY_PRICE_HBAR || 1),
    bondPriceHbar: Number(process.env.STATION_BOND_PRICE_HBAR || 1),
  };

  const defaultTitle = `ChargeFrog Station Proposal - ${finderResult.proposedStationName || finderResult.area}`;
  const defaultDescription = buildProposalDescription({
    area: finderResult.area,
    proposedArea: finderResult.proposedArea,
    bestStation: finderResult.bestStation,
    neighborhood: finderResult.neighborhood,
    proposedStationName: finderResult.proposedStationName,
  });

  if (!DECISION_POLICIES.proposalWebResearchRequired) {
    throw new Error(
      'Investment proposal policy misconfigured: web research must be required.',
    );
  }

  const query = `${finderResult.area} EV charging demand grid permit requirements`;
  const webSearchResult = await callTool({
    correlationId,
    agent: AGENTS.INVESTMENT_PROPOSAL_GENERATOR,
    toolName: 'webSearch',
    args: { query, limit: 5 },
  });
  const webResearch = webSearchResult.data;
  const webResultCount = Array.isArray(webResearch?.results)
    ? webResearch.results.length
    : 0;
  toolTrace.push({
    tool: 'webSearch',
    arguments: { query, limit: 5 },
    resultSummary: {
      resultCount: webResultCount,
      required: true,
    },
  });
  if (webResultCount < DECISION_POLICIES.proposalWebResearchMinResults) {
    throw new Error(
      `webSearch returned ${webResultCount} result(s); at least ${DECISION_POLICIES.proposalWebResearchMinResults} required before creating investment proposal.`,
    );
  }

  const FIXED_HBAR_USD_PRICE = 0.1015;
  pricing.hbarUsdPrice = FIXED_HBAR_USD_PRICE;
  toolTrace.push({
    tool: 'fixedHbarUsdPrice',
    arguments: {},
    resultSummary: {
      hbarUsdPrice: FIXED_HBAR_USD_PRICE,
      source: 'fixed',
    },
  });

  let llmDraft = null;
  const llmStartedAt = Date.now();
  try {
    llmDraft = await createInvestmentProposalDraftWithLlm({
      finderResult,
      cap,
      shares,
      pricing,
    });
    if (llmDraft) {
      toolTrace.push({
        tool: 'llm.investmentProposalGenerator',
        arguments: {
          model: llmDraft.model,
          reasoning_effort: llmDraft.reasoningEffort,
        },
        resultSummary: {
          hasTitle: Boolean(llmDraft.title),
          hasDescription: Boolean(llmDraft.description),
          hasRationale: Boolean(llmDraft.rationale),
          riskCount: llmDraft.risks.length,
          assumptionCount: llmDraft.assumptions.length,
        },
      });
      logStructured({
        correlationId,
        agent: AGENTS.INVESTMENT_PROPOSAL_GENERATOR,
        action: 'llm:investment_proposal_generator',
        input: {
          area: finderResult.area,
          stationId: finderResult?.bestStation?.id || null,
        },
        outputSummary: {
          model: llmDraft.model,
          reasoning_effort: llmDraft.reasoningEffort,
          hasTitle: Boolean(llmDraft.title),
          hasDescription: Boolean(llmDraft.description),
        },
        success: true,
        durationMs: Date.now() - llmStartedAt,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toolTrace.push({
      tool: 'llm.investmentProposalGenerator',
      arguments: {
        model:
          process.env.AGENT_INVESTMENT_PROPOSAL_MODEL ||
          process.env.AGENT_DAO_MODEL ||
          process.env.AGENT_MODEL ||
          'gpt-5.2',
        reasoning_effort: normalizeReasoningEffort(
          process.env.AGENT_INVESTMENT_PROPOSAL_REASONING_EFFORT ||
            process.env.AGENT_DAO_REASONING_EFFORT ||
            'high',
          'high',
        ),
      },
      resultSummary: {
        degraded: true,
        reason: message,
      },
    });
    logStructured({
      correlationId,
      level: 'warn',
      agent: AGENTS.INVESTMENT_PROPOSAL_GENERATOR,
      action: 'llm:investment_proposal_generator',
      input: {
        area: finderResult.area,
        stationId: finderResult?.bestStation?.id || null,
      },
      outputSummary: {
        degraded: true,
      },
      success: true,
      durationMs: Date.now() - llmStartedAt,
      error: message,
    });
  }

  const title = llmDraft?.title || defaultTitle;
  const description = llmDraft?.description || defaultDescription;

  const parameters = {
    threshold: finderResult.neighborhood?.triggerThreshold,
    currentCount: finderResult.neighborhood?.count,
    radiusMeters: finderResult.neighborhood?.radiusMeters,
  };

  const proposalPayloadDraft = buildProposalModel({
    finderResult,
    cap,
    shares,
    pricing,
  });
  const derivedCap = toPositiveWholeNumber(
    proposalPayloadDraft?.tokenizationInvestmentTerms?.investmentTargetUsd,
  );
  const derivedShares = toPositiveWholeNumber(
    proposalPayloadDraft?.tokenizationInvestmentTerms?.totalSupply
      ?.equityShares,
  );
  const webSources = (webResearch?.results || [])
    .map((item) => item?.url || item?.title)
    .filter((value) => typeof value === 'string' && value.trim() !== '')
    .slice(0, 3);
  const mergedSources = [...new Set([...webSources])].slice(0, 4);
  if (
    proposalPayloadDraft?.metadataProofAnchors &&
    Array.isArray(proposalPayloadDraft.metadataProofAnchors.externalDataSources)
  ) {
    proposalPayloadDraft.metadataProofAnchors.externalDataSources = [
      ...proposalPayloadDraft.metadataProofAnchors.externalDataSources.slice(
        0,
        2,
      ),
      ...mergedSources,
    ];
  }
  const metadata = {
    proposedStationName:
      proposalPayloadDraft?.tokenizationInvestmentTerms?.stationName || null,
    proposedArea: finderResult.proposedArea,
    pricing,
    cap: derivedCap || cap || null,
    shares: derivedShares || shares || null,
    rationale: llmDraft?.rationale || finderResult.rationale,
    webSources: mergedSources,
  };

  const proposal = await callTool({
    correlationId,
    agent: AGENTS.INVESTMENT_PROPOSAL_GENERATOR,
    toolName: 'createInvestmentProposal',
    args: {
      title,
      description,
      location: finderResult.proposedArea,
      metadata,
      parameters,
      cap: derivedCap || cap || null,
      shares: derivedShares || shares || null,
      proposalPayload: proposalPayloadDraft,
      correlationId,
    },
  });
  toolTrace.push({
    tool: 'createInvestmentProposal',
    arguments: {
      title,
      location: finderResult.proposedArea,
    },
    resultSummary: proposal.data,
  });

  return {
    status: 'proposal_created',
    reply:
      'Investment proposal generated and submitted through the proposal tool. Status is now pending admin approval.',
    proposal: proposal.data,
    proposalPayload: proposal.data?.proposalPayload || proposalPayloadDraft,
    toolTrace,
  };
}

// Handles autoAdvanceProposalToInvestment.
async function autoAdvanceProposalToInvestment({ proposalId, correlationId }) {
  const normalizedProposalId = String(proposalId || '').trim();
  if (!normalizedProposalId) {
    return {
      status: 'missing_proposal_id',
      reply: 'Proposal created but auto-transition failed: missing proposalId.',
    };
  }

  const issuance = await runStationAssetIssuerIfProposalApproved({
    proposalId: normalizedProposalId,
    correlationId,
  });

  return {
    status:
      issuance?.status === 'assets_issued'
        ? 'investment_ready'
        : 'issuance_failed',
    reply:
      issuance?.status === 'assets_issued'
        ? 'Proposal was auto-transitioned to investment stage and station assets were issued.'
        : issuance?.reply || 'Proposal was created, but asset issuance failed.',
    issuance,
  };
}

// Handles runStationAssetIssuerAgent.
async function runStationAssetIssuerAgent({ message, correlationId }) {
  const toolTrace = [];
  const proposalId = parseProposalId(message);
  if (!proposalId) {
    return {
      status: 'missing_proposal_id',
      reply:
        'To issue station assets, provide a proposal ID. Example: "issue assets for proposal proposal_123".',
      toolTrace,
    };
  }

  const onChainProposal = await callTool({
    correlationId,
    agent: AGENTS.STATION_ASSET_ISSUER,
    toolName: 'readOnChainProposal',
    args: { proposalId },
  });
  toolTrace.push({
    tool: 'readOnChainProposal',
    arguments: { proposalId },
    resultSummary: {
      status: onChainProposal.data.status,
      metadataUri: onChainProposal.data.metadataUri,
      stationId: onChainProposal.data.stationId,
    },
  });

  const stationSnapshot = await loadStationSnapshotForProposal({
    correlationId,
    agent: AGENTS.STATION_ASSET_ISSUER,
    proposalId,
    fallbackStationId: onChainProposal.data.stationId,
    toolTrace,
  });
  const resolvedStation = stationSnapshot.ok ? stationSnapshot.data : null;
  const resolvedStationId = toPositiveWholeNumber(
    resolvedStation?.stationId ?? onChainProposal.data.stationId,
  );
  if (!resolvedStationId) {
    throw new Error('proposal stationId is missing; cannot issue assets');
  }
  const hasEquityToken = Boolean(resolvedStation?.equityTokenAddress);
  const hasBondToken = Boolean(resolvedStation?.bondTokenAddress);
  if (hasEquityToken && hasBondToken) {
    return {
      status: 'already_issued',
      reply: `Station ${resolvedStationId} already has equity and bond tokens. Duplicate issuance is blocked.`,
      proposalId,
      stationId: resolvedStationId,
      station: resolvedStation,
      toolTrace,
    };
  }
  if (hasEquityToken || hasBondToken) {
    return {
      status: 'partial_assets_exist',
      reply:
        `Station ${resolvedStationId} already has a token address recorded. ` +
        'Issuance is blocked to avoid duplicate token creation.',
      proposalId,
      stationId: resolvedStationId,
      station: resolvedStation,
      toolTrace,
    };
  }

  if (onChainProposal.data.status === 'issued') {
    return {
      status: 'already_issued',
      reply: `Proposal ${proposalId} is already issued. Returning current station asset state.`,
      proposalId,
      stationId: resolvedStationId,
      station: resolvedStation,
      toolTrace,
    };
  }

  const offChainMetadata = await callTool({
    correlationId,
    agent: AGENTS.STATION_ASSET_ISSUER,
    toolName: 'readOffChainMetadata',
    args: { metadataUri: onChainProposal.data.metadataUri },
  });
  toolTrace.push({
    tool: 'readOffChainMetadata',
    arguments: { metadataUri: onChainProposal.data.metadataUri },
    resultSummary: {
      cap: offChainMetadata.data.cap,
      shares: offChainMetadata.data.shares,
      pricing: offChainMetadata.data.pricing,
    },
  });

  const proposalPayload = resolveProposalPayload(
    onChainProposal.data,
    offChainMetadata.data,
  );
  if (!proposalPayload) {
    throw new Error(
      'Proposal payload is missing. Cannot issue assets without explicit tokenizationInvestmentTerms.',
    );
  }

  const proposalSupply = resolveSuppliesFromProposalPayload(proposalPayload);

  const stationId = resolvedStationId;
  const stationName = normalizeStationName(
    resolvedStation?.stationName ||
      proposalPayload?.tokenizationInvestmentTerms?.stationName ||
      offChainMetadata.data?.stationDetails?.metadata?.proposedStationName ||
      offChainMetadata.data?.stationDetails?.metadata?.area,
    `Station-${stationId}`,
  );
  const equitySymbol = buildTokenSymbol(stationName, stationId, 'EQ');
  const bondSymbol = buildTokenSymbol(stationName, stationId, 'BD');
  const equityShares = proposalSupply.equityShares;
  const bondUnits = proposalSupply.bondUnits;
  const cap = Number(
    proposalSupply.hardCap ||
      offChainMetadata.data.cap ||
      onChainProposal.data.cap ||
      Math.max(equityShares, bondUnits),
  );
  const pricing = {
    equityPriceHbar: Number(
      offChainMetadata.data?.pricing?.equityPriceHbar ||
        onChainProposal.data?.pricing?.equityPriceHbar ||
        1,
    ),
    bondPriceHbar: Number(
      offChainMetadata.data?.pricing?.bondPriceHbar ||
        onChainProposal.data?.pricing?.bondPriceHbar ||
        1,
    ),
  };

  const equityIsin = await callTool({
    correlationId,
    agent: AGENTS.STATION_ASSET_ISSUER,
    toolName: 'generateISIN',
    args: { stationId, assetType: 'equity' },
  });
  toolTrace.push({
    tool: 'generateISIN',
    arguments: { stationId, assetType: 'equity' },
    resultSummary: equityIsin.data,
  });

  const bondIsin = await callTool({
    correlationId,
    agent: AGENTS.STATION_ASSET_ISSUER,
    toolName: 'generateISIN',
    args: { stationId, assetType: 'bond' },
  });
  toolTrace.push({
    tool: 'generateISIN',
    arguments: { stationId, assetType: 'bond' },
    resultSummary: bondIsin.data,
  });

  const equityToken = await callTool({
    correlationId,
    agent: AGENTS.STATION_ASSET_ISSUER,
    toolName: 'createEquityToken',
    args: {
      ...buildTokenCreateOverridesFromProposal({
        proposalPayload,
        stationName,
        assetType: 'equity',
      }),
      stationId,
      isin_number: equityIsin.data.isin_number || equityIsin.data.isin,
      stationName,
      name: `ChargeFrog-${stationName}`,
      symbol: equitySymbol,
      totalShares: String(equityShares),
      pricePerShare: String(pricing.equityPriceHbar),
      cap: String(cap),
      metadata: buildAssetMetadataFromProposal({
        proposalId,
        stationId,
        metadataUri: onChainProposal.data.metadataUri,
        proposalPayload,
        assetType: 'equity',
        isinNumber: equityIsin.data.isin_number || equityIsin.data.isin,
        totalSupply: equityShares,
        pricePerUnitHbar: pricing.equityPriceHbar,
        cap,
      }),
      correlationId,
    },
  });
  toolTrace.push({
    tool: 'createEquityToken',
    arguments: {
      stationId,
      isin_number: equityIsin.data.isin_number || equityIsin.data.isin,
      totalShares: String(equityShares),
    },
    resultSummary: {
      tokenAddress: equityToken.data.tokenAddress,
      txHash: equityToken.data.txHash,
      isin_number: equityToken.data.isin_number || null,
      totalShares: equityToken.data.totalShares,
    },
  });

  const bondToken = await callTool({
    correlationId,
    agent: AGENTS.STATION_ASSET_ISSUER,
    toolName: 'createBondToken',
    args: {
      ...buildTokenCreateOverridesFromProposal({
        proposalPayload,
        stationName,
        assetType: 'bond',
      }),
      stationId,
      isin_number: bondIsin.data.isin_number || bondIsin.data.isin,
      stationName,
      name: `ChargeFrog-${stationName}-Bond`,
      symbol: bondSymbol,
      totalBonds: String(bondUnits),
      pricePerBond: String(pricing.bondPriceHbar),
      cap: String(cap),
      metadata: buildAssetMetadataFromProposal({
        proposalId,
        stationId,
        metadataUri: onChainProposal.data.metadataUri,
        proposalPayload,
        assetType: 'bond',
        isinNumber: bondIsin.data.isin_number || bondIsin.data.isin,
        totalSupply: bondUnits,
        pricePerUnitHbar: pricing.bondPriceHbar,
        cap,
      }),
      correlationId,
    },
  });
  toolTrace.push({
    tool: 'createBondToken',
    arguments: {
      stationId,
      isin_number: bondIsin.data.isin_number || bondIsin.data.isin,
      totalBonds: String(bondUnits),
    },
    resultSummary: {
      tokenAddress: bondToken.data.tokenAddress,
      txHash: bondToken.data.txHash,
      isin_number: bondToken.data.isin_number || null,
      totalBonds: bondToken.data.totalBonds,
    },
  });

  const saved = await callTool({
    correlationId,
    agent: AGENTS.STATION_ASSET_ISSUER,
    toolName: 'saveIssuedAssets',
    args: {
      proposalId,
      stationId,
      cap,
      shares: equityShares,
      pricing,
      metadataUri: onChainProposal.data.metadataUri,
      equity: {
        tokenAddress: equityToken.data.tokenAddress,
        txHash: equityToken.data.txHash,
        isin: equityIsin.data.isin_number || equityIsin.data.isin,
        isin_number: equityIsin.data.isin_number || equityIsin.data.isin,
        supply: equityShares,
        name: equityToken.data.name || null,
        symbol: equityToken.data.symbol || null,
        metadata: equityToken.data.requestPayload?.metadata || null,
      },
      bond: {
        tokenAddress: bondToken.data.tokenAddress,
        txHash: bondToken.data.txHash,
        isin: bondIsin.data.isin_number || bondIsin.data.isin,
        isin_number: bondIsin.data.isin_number || bondIsin.data.isin,
        supply: bondUnits,
        name: bondToken.data.name || null,
        symbol: bondToken.data.symbol || null,
        metadata: bondToken.data.requestPayload?.metadata || null,
      },
      metadata: {
        assetIssuance: {
          proposalId,
          issuedAt: new Date().toISOString(),
          equityTxHash: equityToken.data.txHash || null,
          bondTxHash: bondToken.data.txHash || null,
        },
      },
    },
  });
  toolTrace.push({
    tool: 'saveIssuedAssets',
    arguments: { proposalId, stationId },
    resultSummary: {
      stage: saved.data.stage,
      stationId: saved.data.stationId,
    },
  });

  return {
    status: 'assets_issued',
    reply:
      'Station assets issued. Equity and bond tokens are now available for investment stage.',
    proposalId,
    stationId,
    equity: {
      tokenAddress: equityToken.data.tokenAddress,
      txHash: equityToken.data.txHash,
      isin: equityIsin.data.isin_number || equityIsin.data.isin,
      isin_number: equityIsin.data.isin_number || equityIsin.data.isin,
      totalSupply: equityShares,
    },
    bond: {
      tokenAddress: bondToken.data.tokenAddress,
      txHash: bondToken.data.txHash,
      isin: bondIsin.data.isin_number || bondIsin.data.isin,
      isin_number: bondIsin.data.isin_number || bondIsin.data.isin,
      totalSupply: bondUnits,
    },
    proposalSupply: {
      equityShares,
      bondUnits,
    },
    toolTrace,
  };
}

// Handles runStationAssetIssuerIfProposalApproved.
async function runStationAssetIssuerIfProposalApproved({
  proposalId,
  correlationId,
}) {
  const normalizedProposalId = String(proposalId || '').trim();
  if (!normalizedProposalId) {
    throw new Error('proposalId is required');
  }

  const resolvedCorrelationId = correlationId || crypto.randomUUID();
  return runStationAssetIssuerAgent({
    message: `issue assets for proposal ${normalizedProposalId}`,
    correlationId: resolvedCorrelationId,
  });
}

async function runStationAssetIssuerWorker(input = {}) {
  const proposalId = String(input.proposalId || '').trim();
  if (proposalId) {
    return runStationAssetIssuerIfProposalApproved({
      proposalId,
      correlationId: input.correlationId,
    });
  }

  const message = String(input.message || '').trim();
  if (!message) {
    throw new Error('message or proposalId is required');
  }

  return runStationAssetIssuerAgent({
    message,
    correlationId: input.correlationId,
  });
}

function extractDeploymentMetadata(station) {
  const deployment =
    station?.metadata?.deployment &&
    typeof station.metadata.deployment === 'object'
      ? station.metadata.deployment
      : null;
  return deployment;
}

function resolveFoundryProposalId(input = {}) {
  const direct = String(input.proposalId || '').trim();
  if (direct) {
    return direct;
  }
  return parseProposalId(input.message);
}

function parseFoundryIntent(input = {}) {
  const proposalId = String(input.proposalId || '').trim();
  if (proposalId) {
    return 'approve_pending_admin_action';
  }

  const text = String(input.message || '')
    .trim()
    .toLowerCase();
  if (!text) {
    return 'general';
  }

  const asksAttentionQueue =
    /\b(require|requires|need|needs)\s+my\s+attention\b/.test(text) ||
    /\bwhat\s+(?:stations?|proposals?)\b/.test(text) ||
    /\bwhich\s+(?:stations?|proposals?)\b/.test(text) ||
    /\bpending[-\s]?admin[-\s]action\b/.test(text) ||
    /\bpending[-\s]?admin\b/.test(text);
  const asksApproval =
    /\b(approve|approval|greenlight|green\s*light|go\s+ahead|deploy)\b/.test(
      text,
    ) || Boolean(parseProposalId(text));

  if (asksAttentionQueue && !asksApproval) {
    return 'list_pending_admin_action';
  }
  if (asksApproval) {
    return 'approve_pending_admin_action';
  }
  return 'general';
}

function summarizePendingAdminStation(station) {
  if (!station || typeof station !== 'object') {
    return 'Unknown station';
  }
  return [
    `station ${station.stationId}`,
    station.stationName ? `(${station.stationName})` : null,
    station.proposalId ? `proposal ${station.proposalId}` : null,
  ]
    .filter(Boolean)
    .join(' ');
}

function summarizeReviewText(value, maxLength = 220) {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) {
    return null;
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function buildFoundryStationReviewSummary({
  station,
  onChainProposal,
  offChainMetadata,
}) {
  const summaryPrefix = summarizePendingAdminStation(station);
  const proposalPayload = resolveProposalPayload(
    onChainProposal || {},
    offChainMetadata || {},
  );
  const terms =
    proposalPayload?.tokenizationInvestmentTerms &&
    typeof proposalPayload.tokenizationInvestmentTerms === 'object'
      ? proposalPayload.tokenizationInvestmentTerms
      : {};

  let proposalSupply = {};
  try {
    proposalSupply = resolveSuppliesFromProposalPayload(proposalPayload);
  } catch (_error) {
    proposalSupply = {};
  }

  const pricing =
    offChainMetadata?.pricing && typeof offChainMetadata.pricing === 'object'
      ? offChainMetadata.pricing
      : onChainProposal?.pricing && typeof onChainProposal.pricing === 'object'
        ? onChainProposal.pricing
        : station?.pricing && typeof station.pricing === 'object'
          ? station.pricing
          : {};

  const investmentTargetHbar = toFiniteNumber(
    terms.investmentTargetHbarEquivalent,
  );
  const equityShares = toPositiveWholeNumber(
    proposalSupply.equityShares ??
      terms?.totalSupply?.equityShares ??
      offChainMetadata?.shares ??
      onChainProposal?.shares ??
      station?.shares,
  );
  const bondUnits = toPositiveWholeNumber(
    proposalSupply.bondUnits ?? terms?.totalSupply?.bondUnits,
  );
  const hardCap = toPositiveWholeNumber(
    proposalSupply.hardCap ??
      terms.hardCap ??
      offChainMetadata?.cap ??
      onChainProposal?.cap ??
      station?.cap,
  );
  const equityPriceHbar = toFiniteNumber(
    pricing.equityPriceHbar ?? terms?.tokenPriceHbar?.equity,
  );
  const bondPriceHbar = toFiniteNumber(
    pricing.bondPriceHbar ?? terms?.tokenPriceHbar?.bond,
  );
  const title = summarizeReviewText(onChainProposal?.title, 120);
  const description = summarizeReviewText(onChainProposal?.description, 180);

  const detailParts = [
    investmentTargetHbar !== undefined
      ? `target ${investmentTargetHbar} HBAR`
      : null,
    equityShares ? `${equityShares} equity shares` : null,
    bondUnits ? `${bondUnits} bond units` : null,
    hardCap ? `hard cap ${hardCap}` : null,
    equityPriceHbar !== undefined ? `equity ${equityPriceHbar} HBAR` : null,
    bondPriceHbar !== undefined ? `bond ${bondPriceHbar} HBAR` : null,
  ].filter(Boolean);

  return [
    summaryPrefix,
    title ? `title: ${title}` : null,
    detailParts.length > 0 ? detailParts.join(', ') : null,
    description ? `summary: ${description}` : null,
  ]
    .filter(Boolean)
    .join('. ');
}

async function buildFoundryStationReview({ station, correlationId }) {
  const stationSummary = summarizePendingAdminStation(station);
  const proposalId = String(station?.proposalId || '').trim();
  if (!proposalId) {
    return {
      ...station,
      reviewSummary: stationSummary,
    };
  }

  const onChainProposal = await callTool({
    correlationId,
    agent: AGENTS.FOUNDRY,
    toolName: 'readOnChainProposal',
    args: { proposalId },
    required: false,
  });
  const metadataUri = onChainProposal.ok
    ? String(onChainProposal.data?.metadataUri || '').trim()
    : '';
  const offChainMetadata =
    metadataUri !== ''
      ? await callTool({
          correlationId,
          agent: AGENTS.FOUNDRY,
          toolName: 'readOffChainMetadata',
          args: { metadataUri },
          required: false,
        })
      : { ok: false };

  const reviewSummary = buildFoundryStationReviewSummary({
    station,
    onChainProposal: onChainProposal.ok ? onChainProposal.data : null,
    offChainMetadata: offChainMetadata.ok ? offChainMetadata.data : null,
  });

  return {
    ...station,
    reviewSummary,
    proposalTitle: onChainProposal.ok ? onChainProposal.data?.title || null : null,
    proposalDescription: onChainProposal.ok
      ? summarizeReviewText(onChainProposal.data?.description, 180)
      : null,
  };
}

function pushStationSnapshotTrace({ toolTrace, toolName, args, station }) {
  if (!Array.isArray(toolTrace) || !station) {
    return;
  }

  toolTrace.push({
    tool: toolName,
    arguments: args,
    resultSummary: {
      stationId: station.stationId || null,
      stage: station.stage || null,
      hasDeployment: Boolean(extractDeploymentMetadata(station)),
      equityTokenAddress: station.equityTokenAddress || null,
      bondTokenAddress: station.bondTokenAddress || null,
    },
  });
}

async function loadStationSnapshotForProposal({
  correlationId,
  agent,
  proposalId,
  fallbackStationId,
  toolTrace,
}) {
  const byProposalId = await callTool({
    correlationId,
    agent,
    toolName: 'getStationByProposalId',
    args: { proposalId },
    required: false,
  });
  if (byProposalId.ok && byProposalId.data) {
    pushStationSnapshotTrace({
      toolTrace,
      toolName: 'getStationByProposalId',
      args: { proposalId },
      station: byProposalId.data,
    });
    return byProposalId;
  }

  if (fallbackStationId === undefined || fallbackStationId === null) {
    return byProposalId;
  }

  const byStationId = await callTool({
    correlationId,
    agent,
    toolName: 'getStation',
    args: { stationId: fallbackStationId },
    required: false,
  });
  if (byStationId.ok && byStationId.data) {
    pushStationSnapshotTrace({
      toolTrace,
      toolName: 'getStation',
      args: { stationId: fallbackStationId },
      station: byStationId.data,
    });
  }
  return byStationId;
}

async function listPendingAdminActionStations({ correlationId }) {
  const listed = await callTool({
    correlationId,
    agent: AGENTS.FOUNDRY,
    toolName: 'listStationsByStage',
    args: { stage: 'pending-admin-action' },
  });
  const stations = Array.isArray(listed.data) ? listed.data : [];

  return stations;
}

async function runFoundryAttentionQueue({ correlationId }) {
  const stations = await listPendingAdminActionStations({ correlationId });
  if (stations.length === 0) {
    return {
      status: 'no_pending_admin_action',
      reply: 'There are no stations pending admin action right now.',
      stations: [],
    };
  }

  const reviewedStations = await Promise.all(
    stations.map((station) => buildFoundryStationReview({ station, correlationId })),
  );
  const stationSummaries = reviewedStations.map(
    (station) => station.reviewSummary || summarizePendingAdminStation(station),
  );
  return {
    status: 'pending_admin_action_queue',
    reply:
      stations.length === 1
        ? `The station requiring your attention is ${stationSummaries[0]}; ${FOUNDRY_APPROVAL_REPLY}`
        : `These stations require your attention: ${stationSummaries.join('; ')}; ${FOUNDRY_APPROVAL_REPLY}`,
    stations: reviewedStations,
  };
}

async function resolveFoundryApprovalTarget({ input, correlationId }) {
  const explicitProposalId = String(input.proposalId || '').trim();
  if (explicitProposalId) {
    return {
      status: 'resolved',
      proposalId: explicitProposalId,
    };
  }

  const message = String(input.message || '').trim();
  const proposalId = parseProposalId(message);
  if (proposalId) {
    return {
      status: 'resolved',
      proposalId,
    };
  }

  const stationId = parseStationId(message);
  if (stationId !== undefined) {
    const station = await callTool({
      correlationId,
      agent: AGENTS.FOUNDRY,
      toolName: 'getStation',
      args: { stationId },
      required: false,
    });
    if (!station.ok || !station.data) {
      return {
        status: 'station_not_found',
        reply: `I could not find station ${stationId}.`,
      };
    }
    if (
      String(station.data.stage || '')
        .trim()
        .toLowerCase() !== 'pending-admin-action'
    ) {
      return {
        status: 'station_not_pending_admin_action',
        reply: `Station ${stationId} is not pending admin action.`,
        station: station.data,
      };
    }
    if (!station.data.proposalId) {
      return {
        status: 'proposal_not_found_for_station',
        reply: `Station ${stationId} does not have a proposalId recorded.`,
        station: station.data,
      };
    }
    return {
      status: 'resolved',
      proposalId: station.data.proposalId,
      station: station.data,
    };
  }

  const pendingStations = await listPendingAdminActionStations({
    correlationId,
  });
  const stationNameHint = parseStationNameHint(message);
  if (stationNameHint) {
    const matchedStation = findBestStationByNameHint(
      pendingStations,
      stationNameHint,
    );
    if (!matchedStation) {
      return {
        status: 'station_not_found',
        reply:
          'I could not find that station in the pending admin action queue.',
        stations: pendingStations,
      };
    }
    if (!matchedStation.proposalId) {
      return {
        status: 'proposal_not_found_for_station',
        reply: `Station ${matchedStation.stationId} does not have a proposalId recorded.`,
        station: matchedStation,
      };
    }
    return {
      status: 'resolved',
      proposalId: matchedStation.proposalId,
      station: matchedStation,
    };
  }

  if (pendingStations.length === 0) {
    return {
      status: 'no_pending_admin_action',
      reply: 'There are no stations pending admin action right now.',
      stations: [],
    };
  }

  if (pendingStations.length === 1 && pendingStations[0].proposalId) {
    return {
      status: 'resolved',
      proposalId: pendingStations[0].proposalId,
      station: pendingStations[0],
    };
  }

  return {
    status: 'approval_target_required',
    reply:
      'Multiple stations are pending admin action. Please specify the stationId, proposalId, or full ChargeFrog station name you want to approve.',
    stations: pendingStations,
  };
}

function resolveFoundryDeploymentInput({
  proposalId,
  onChainProposal,
  proposalPayload,
  stationSnapshot,
  overrides,
}) {
  const normalizedOverrides =
    overrides && typeof overrides === 'object' ? overrides : {};
  const terms =
    proposalPayload?.tokenizationInvestmentTerms &&
    typeof proposalPayload.tokenizationInvestmentTerms === 'object'
      ? proposalPayload.tokenizationInvestmentTerms
      : {};
  const supply = resolveSuppliesFromProposalPayload(proposalPayload);
  const stationId = toPositiveWholeNumber(
    normalizedOverrides.expectedStationId ??
      normalizedOverrides.stationId ??
      stationSnapshot?.stationId ??
      onChainProposal?.stationId ??
      terms.stationId,
  );
  const stationName =
    String(
      normalizedOverrides.stationName ||
        stationSnapshot?.stationName ||
        terms.stationName ||
        onChainProposal?.stationName ||
        '',
    ).trim() || null;
  const totalInvestmentHbar =
    normalizedOverrides.totalInvestmentHbar ??
    terms.investmentTargetHbarEquivalent ??
    null;
  const totalShares =
    normalizedOverrides.totalShares ?? supply.equityShares ?? null;

  if (!stationId) {
    throw new Error('proposal stationId is missing; cannot deploy station');
  }
  if (!stationName) {
    throw new Error('proposal stationName is missing; cannot deploy station');
  }
  if (totalInvestmentHbar === null || totalInvestmentHbar === undefined) {
    throw new Error(
      'proposal investmentTargetHbarEquivalent is missing; cannot deploy station',
    );
  }
  if (totalShares === null || totalShares === undefined) {
    throw new Error(
      'proposal totalSupply.equityShares is missing; cannot deploy station',
    );
  }

  return {
    proposalId,
    expectedStationId: String(stationId),
    stationId: String(stationId),
    stationName,
    projectUrl:
      normalizedOverrides.projectUrl ||
      buildDefaultFoundryProjectUrl(stationId),
    totalInvestment: normalizedOverrides.totalInvestment,
    totalInvestmentHbar: String(totalInvestmentHbar),
    totalShares: String(totalShares),
    stationMetadata:
      normalizedOverrides.stationMetadata !== undefined
        ? normalizedOverrides.stationMetadata
        : {
            proposalId,
            stationId: String(stationId),
            metadataUri: onChainProposal?.metadataUri || null,
            proposalTxHash: onChainProposal?.txHash || null,
            onChainProposalId:
              onChainProposal?.onChain?.onChainProposalId || null,
          },
    initialFundAddress: normalizedOverrides.initialFundAddress,
    registryAddress: normalizedOverrides.registryAddress,
    boltAddress: normalizedOverrides.boltAddress,
    rpcUrl: normalizedOverrides.rpcUrl,
  };
}

async function runFoundryWorkflow(input = {}) {
  const proposalId = resolveFoundryProposalId(input);
  if (!proposalId) {
    throw new Error(
      'proposalId is required. Example: {"proposalId":"proposal_123"} or "deploy and issue proposal proposal_123"',
    );
  }

  const correlationId = input.correlationId || crypto.randomUUID();
  const toolTrace = [];

  const onChainProposal = await callTool({
    correlationId,
    agent: AGENTS.FOUNDRY,
    toolName: 'readOnChainProposal',
    args: { proposalId },
  });
  toolTrace.push({
    tool: 'readOnChainProposal',
    arguments: { proposalId },
    resultSummary: {
      proposalId: onChainProposal.data.proposalId,
      stationId: onChainProposal.data.stationId,
      stationName: onChainProposal.data.stationName || null,
      metadataUri: onChainProposal.data.metadataUri || null,
    },
  });

  const offChainMetadata = await callTool({
    correlationId,
    agent: AGENTS.FOUNDRY,
    toolName: 'readOffChainMetadata',
    args: { metadataUri: onChainProposal.data.metadataUri },
    required: false,
  });
  if (offChainMetadata.ok) {
    toolTrace.push({
      tool: 'readOffChainMetadata',
      arguments: { metadataUri: onChainProposal.data.metadataUri },
      resultSummary: {
        stationName: offChainMetadata.data?.stationDetails?.stationName || null,
        cap: offChainMetadata.data?.cap ?? null,
        shares: offChainMetadata.data?.shares ?? null,
      },
    });
  }

  const proposalPayload = resolveProposalPayload(
    onChainProposal.data,
    offChainMetadata.ok ? offChainMetadata.data : {},
  );
  if (!proposalPayload) {
    throw new Error(
      'Proposal payload is missing. Cannot deploy station without tokenizationInvestmentTerms.',
    );
  }

  const stationSnapshot = await loadStationSnapshotForProposal({
    correlationId,
    agent: AGENTS.FOUNDRY,
    proposalId,
    fallbackStationId: onChainProposal.data.stationId,
    toolTrace,
  });

  let deploymentRecord = extractDeploymentMetadata(stationSnapshot.data);
  let deployment;
  const resolvedStationId =
    stationSnapshot.data?.stationId || onChainProposal.data.stationId || null;
  if (deploymentRecord?.stationAddress) {
    deployment = {
      status: 'already_deployed',
      reply: `Station ${resolvedStationId} is already deployed. Proceeding to token issuance.`,
      deployment: deploymentRecord,
    };
  } else {
    const deployInput = resolveFoundryDeploymentInput({
      proposalId,
      onChainProposal: onChainProposal.data,
      proposalPayload,
      stationSnapshot: stationSnapshot.data,
      overrides: input,
    });
    const deployed = await callTool({
      correlationId,
      agent: AGENTS.FOUNDRY,
      toolName: 'deployStationBundle',
      args: deployInput,
    });
    toolTrace.push({
      tool: 'deployStationBundle',
      arguments: {
        proposalId,
        expectedStationId: deployInput.expectedStationId,
        stationName: deployInput.stationName,
        projectUrl: deployInput.projectUrl,
      },
      resultSummary: {
        stationId: deployed.data?.station?.stationId || null,
        stationAddress: deployed.data?.contracts?.stationAddress || null,
        sharesAddress: deployed.data?.contracts?.sharesAddress || null,
      },
    });

    const saveDeployment = await callTool({
      correlationId,
      agent: AGENTS.FOUNDRY,
      toolName: 'saveStationDeployment',
      args: {
        proposalId,
        stationId: deployInput.stationId,
        metadataUri: onChainProposal.data.metadataUri || null,
        deployment: {
          network: deployed.data?.network || null,
          signer: deployed.data?.signer || null,
          contracts: deployed.data?.contracts || null,
          station: deployed.data?.station || null,
          txs: deployed.data?.txs || null,
        },
      },
    });
    toolTrace.push({
      tool: 'saveStationDeployment',
      arguments: {
        proposalId,
        stationId: deployInput.stationId,
      },
      resultSummary: {
        stationId: saveDeployment.data?.stationId || null,
        stage: saveDeployment.data?.stage || null,
      },
    });

    deploymentRecord = extractDeploymentMetadata(saveDeployment.data);
    deployment = {
      status: 'station_deployed',
      reply: `Station ${deployInput.stationId} deployed successfully. Triggering station asset issuer.`,
      deployment: deploymentRecord,
    };
  }

  const issuance = await callWorkerAgent({
    callerAgent: AGENTS.FOUNDRY,
    endpointPath: PLANNER_WORKER_ENDPOINTS.stationAssetIssuer,
    action: 'a2a:station_asset_issuer',
    correlationId,
    payload: {
      proposalId,
      correlationId,
    },
  });
  toolTrace.push({
    tool: 'a2a:station-asset-issuer',
    arguments: { proposalId },
    resultSummary: {
      status: issuance?.status || null,
      stationId: issuance?.stationId || null,
    },
  });

  const issuanceCompleted =
    issuance?.status === 'assets_issued' ||
    issuance?.status === 'already_issued';

  return {
    status: issuanceCompleted
      ? 'deployment_and_issuance_complete'
      : 'deployment_complete_issuance_pending',
    reply:
      issuance?.status === 'already_issued'
        ? 'Station deployment is already recorded and the station asset issuer reports the tokens are already issued.'
        : issuanceCompleted
          ? 'Station deployment completed and the station asset issuer created equity and bond tokens.'
          : `Station deployment completed, but token issuance did not finish cleanly: ${issuance?.reply || 'unknown issuer response'}`,
    proposalId,
    stationId:
      issuance?.stationId ||
      deploymentRecord?.station?.stationId ||
      resolvedStationId,
    deployment,
    issuance: summarizeIssuance(issuance),
    toolTrace,
  };
}

async function runFoundryWorker(input = {}) {
  return runFoundryAgent(input);
}

// Handles listInvestableStations.
async function listInvestableStations({ correlationId }) {
  const listed = await callTool({
    correlationId,
    agent: AGENTS.ORCHESTRATOR,
    toolName: 'listStationsAvailable',
    args: {},
  });
  const stations = Array.isArray(listed.data) ? listed.data : [];

  return {
    status: 'listed',
    reply:
      stations.length > 0
        ? `There are ${stations.length} investable station(s) right now.`
        : 'There are no investable stations yet.',
    stations,
  };
}

// Handles resolveStationForInvestment.
async function resolveStationForInvestment({
  message,
  correlationId,
  fallbackToFirstIfNoHint = true,
}) {
  const stationId = parseStationId(message);
  const stationNameHint = parseStationNameHint(message);

  if (stationId !== undefined) {
    const picked = await callTool({
      correlationId,
      agent: AGENTS.ORCHESTRATOR,
      toolName: 'getStation',
      args: { stationId },
      required: false,
    });
    if (picked.ok) {
      return {
        station: picked.data,
        stationId,
        stationNameHint,
        matchedBy: 'station_id',
        stations: [],
      };
    }
  }

  const listed = await callTool({
    correlationId,
    agent: AGENTS.ORCHESTRATOR,
    toolName: 'listStationsAvailable',
    args: {},
  });
  const stations = Array.isArray(listed.data) ? listed.data : [];

  if (stationNameHint) {
    const matched = findBestStationByNameHint(stations, stationNameHint);
    if (matched) {
      return {
        station: matched,
        stationId,
        stationNameHint,
        matchedBy: 'station_name',
        stations,
      };
    }

    const allStations = await callTool({
      correlationId,
      agent: AGENTS.ORCHESTRATOR,
      toolName: 'listAllStations',
      args: {},
      required: false,
    });
    const allStationList =
      allStations.ok && Array.isArray(allStations.data) ? allStations.data : [];
    const matchedAnyStage = findBestStationByNameHint(
      allStationList,
      stationNameHint,
    );
    if (matchedAnyStage) {
      return {
        station: matchedAnyStage,
        stationId,
        stationNameHint,
        matchedBy: 'station_name_any_stage',
        stations: allStationList,
      };
    }

    return {
      station: null,
      stationId,
      stationNameHint,
      matchedBy: null,
      stations,
    };
  }

  if (stations.length > 0 && fallbackToFirstIfNoHint) {
    return {
      station: stations[0],
      stationId,
      stationNameHint,
      matchedBy: 'fallback_first_station',
      stations,
    };
  }

  return {
    station: null,
    stationId,
    stationNameHint,
    matchedBy: null,
    stations,
  };
}

function isPendingAdminActionStation(station) {
  return (
    String(station?.stage || '')
      .trim()
      .toLowerCase() === 'pending-admin-action'
  );
}

function buildPendingAdminActionResult(station) {
  return {
    status: 'pending_admin_action',
    reply: PENDING_ADMIN_ACTION_REPLY,
    station: station || null,
  };
}

// Handles showInvestmentChoices.
async function showInvestmentChoices({ message, correlationId }) {
  const resolved = await resolveStationForInvestment({
    message,
    correlationId,
    fallbackToFirstIfNoHint: true,
  });
  const station = resolved.station;

  if (!station) {
    if (resolved.stationNameHint || resolved.stationId !== undefined) {
      return {
        status: 'station_not_found',
        reply:
          'I could not find that station in the current investable list. ' +
          'Try "what stations are available right now?" first.',
      };
    }
    return {
      status: 'no_station_available',
      reply: 'No investable station is available yet.',
    };
  }

  if (isPendingAdminActionStation(station)) {
    return buildPendingAdminActionResult(station);
  }

  const equityPrice = station?.pricing?.equityPriceHbar || 1;
  const bondPrice = station?.pricing?.bondPriceHbar || 1;
  return {
    status: 'choices_ready',
    reply:
      `You can invest in station ${station.stationId} (${station.stationName || 'Unnamed station'}) equity or bonds. ` +
      `Current pricing: 1 equity = ${equityPrice} HBAR, 1 bond = ${bondPrice} HBAR.`,
    station,
    pricing: {
      equityPriceHbar: equityPrice,
      bondPriceHbar: bondPrice,
    },
  };
}

// Handles executeBuy.
async function executeBuy({
  message,
  walletAddress,
  correlationId,
  assetType,
}) {
  ensureWalletForAction(walletAddress, 'investment minting');

  const stationNameHint = parseStationNameHint(message);
  const hasExplicitEquity = /\bequity\b/i.test(String(message || ''));
  const hasExplicitBond = /\bbond\b/i.test(String(message || ''));
  if (
    stationNameHint &&
    ((assetType === 'equity' && !hasExplicitEquity) ||
      (assetType === 'bond' && !hasExplicitBond))
  ) {
    return {
      status: 'asset_choice_required',
      reply: `I found station "${stationNameHint}". Please specify "equity" or "bond" before I execute a purchase.`,
    };
  }

  const amount = parseAmount(message);
  const resolved = await resolveStationForInvestment({
    message,
    correlationId,
    fallbackToFirstIfNoHint: true,
  });
  const station = resolved.station;

  if (!station) {
    if (resolved.stationNameHint || resolved.stationId !== undefined) {
      return {
        status: 'station_not_found',
        reply:
          'I could not find that station in the current investable list. ' +
          'Try "what stations are available right now?" first.',
      };
    }
    return {
      status: 'no_station_available',
      reply: 'No investable station is available yet.',
    };
  }

  if (isPendingAdminActionStation(station)) {
    return buildPendingAdminActionResult(station);
  }

  if (assetType === 'equity' && !station.equityTokenAddress) {
    return {
      status: 'missing_equity_token',
      reply: `Station ${station.stationId} has no equity token issued yet.`,
      station,
    };
  }
  if (assetType === 'bond' && !station.bondTokenAddress) {
    return {
      status: 'missing_bond_token',
      reply: `Station ${station.stationId} has no bond token issued yet.`,
      station,
    };
  }

  const mintToolName = assetType === 'equity' ? 'mintEquity' : 'mintBond';
  const issueToolName = assetType === 'equity' ? 'issueEquity' : 'issueBond';

  const mintResult = await callTool({
    correlationId,
    agent: AGENTS.ORCHESTRATOR,
    toolName: mintToolName,
    args: {
      stationId: station.stationId,
      tokenAddress:
        assetType === 'equity'
          ? station.equityTokenAddress
          : station.bondTokenAddress,
      buyerWallet: walletAddress,
      amount,
      correlationId,
    },
  });

  const issueResult = await callTool({
    correlationId,
    agent: AGENTS.ORCHESTRATOR,
    toolName: issueToolName,
    args: {
      stationId: station.stationId,
      tokenAddress:
        assetType === 'equity'
          ? station.equityTokenAddress
          : station.bondTokenAddress,
      buyerWallet: walletAddress,
      amount,
      correlationId,
    },
  });

  return {
    status: assetType === 'equity' ? 'equity_purchased' : 'bond_purchased',
    reply:
      `Purchase submitted: ${amount} ${assetType}. ` +
      `Mint tx: ${mintResult.data.txHash || 'not returned'}. ` +
      `Issue tx: ${issueResult.data.txHash || 'not returned'}.`,
    stationId: station.stationId,
    stationName: station.stationName || null,
    amount,
    assetType,
    mintTxHash: mintResult.data.txHash || null,
    issueTxHash: issueResult.data.txHash || null,
    txHash: issueResult.data.txHash || mintResult.data.txHash || null,
  };
}

// Handles executeGetTokenBalance.
async function executeGetTokenBalance({
  message,
  walletAddress,
  correlationId,
}) {
  ensureWalletForAction(walletAddress, 'balance query');

  const assetType = parseRequestedAssetType(message);
  if (!assetType) {
    return {
      status: 'asset_type_required',
      reply:
        'Please specify whether you want your equity balance or bond balance.',
    };
  }

  const resolved = await resolveStationForInvestment({
    message,
    correlationId,
    fallbackToFirstIfNoHint: true,
  });
  const station = resolved.station;

  if (!station) {
    if (resolved.stationNameHint || resolved.stationId !== undefined) {
      return {
        status: 'station_not_found',
        reply:
          'I could not find that station in the current investable list. ' +
          'Try "what stations are available right now?" first.',
      };
    }
    return {
      status: 'no_station_available',
      reply: 'No investable station is available yet.',
    };
  }

  const tokenAddress =
    assetType === 'equity'
      ? station.equityTokenAddress
      : station.bondTokenAddress;
  if (!tokenAddress) {
    return {
      status:
        assetType === 'equity' ? 'missing_equity_token' : 'missing_bond_token',
      reply:
        assetType === 'equity'
          ? `Station ${station.stationId} has no equity token issued yet.`
          : `Station ${station.stationId} has no bond token issued yet.`,
      station,
    };
  }

  const balanceResult = await callTool({
    correlationId,
    agent: AGENTS.ORCHESTRATOR,
    toolName: 'getTokenBalance',
    args: {
      stationId: station.stationId,
      assetType,
      walletAddress,
      tokenAddress,
      correlationId,
    },
  });

  const balanceValue =
    balanceResult.data?.balance !== undefined &&
    balanceResult.data?.balance !== null
      ? String(balanceResult.data.balance)
      : '0';

  return {
    status: 'balance_retrieved',
    reply: `Your ${assetType} balance for station ${station.stationId} (${station.stationName || 'Unnamed station'}) is ${balanceValue}.`,
    stationId: station.stationId,
    stationName: station.stationName || null,
    assetType,
    tokenAddress,
    targetId: balanceResult.data?.targetId || null,
    securityId: balanceResult.data?.securityId || tokenAddress,
    balance: balanceResult.data?.balance ?? null,
  };
}

// Handles summarizeStationCandidate.
function summarizeStationCandidate(stationFinder = {}) {
  const neighborhood =
    stationFinder?.neighborhood &&
    typeof stationFinder.neighborhood === 'object'
      ? stationFinder.neighborhood
      : {};
  return {
    status: stationFinder.status || null,
    area: stationFinder.area || null,
    anchor:
      stationFinder?.anchor && typeof stationFinder.anchor === 'object'
        ? stationFinder.anchor
        : null,
    proposedArea:
      stationFinder?.proposedArea &&
      typeof stationFinder.proposedArea === 'object'
        ? stationFinder.proposedArea
        : null,
    proposedStationName: stationFinder.proposedStationName || null,
    rationale: stationFinder.rationale || null,
    currentCount:
      toFiniteNumber(neighborhood.count) ??
      toFiniteNumber(stationFinder.currentCount) ??
      null,
    threshold:
      toFiniteNumber(neighborhood.triggerThreshold) ??
      toFiniteNumber(stationFinder.threshold) ??
      null,
  };
}

// Handles summarizeIssuance.
function summarizeIssuance(issuance = {}) {
  if (!issuance || typeof issuance !== 'object') {
    return null;
  }
  const equity =
    issuance?.equity && typeof issuance.equity === 'object'
      ? {
          tokenAddress: issuance.equity.tokenAddress || null,
          txHash: issuance.equity.txHash || null,
          isin: issuance.equity.isin || issuance.equity.isin_number || null,
        }
      : null;
  const bond =
    issuance?.bond && typeof issuance.bond === 'object'
      ? {
          tokenAddress: issuance.bond.tokenAddress || null,
          txHash: issuance.bond.txHash || null,
          isin: issuance.bond.isin || issuance.bond.isin_number || null,
        }
      : null;
  return {
    status: issuance.status || null,
    proposalId: issuance.proposalId || null,
    stationId: toFiniteNumber(issuance.stationId) ?? null,
    equity,
    bond,
  };
}

// Handles runOrchestrator.
async function runOrchestrator({ message, walletAddress }) {
  const correlationId = crypto.randomUUID();
  const startedAt = Date.now();
  const intentAnalysis = await classifyWorkflowIntent(message, correlationId);
  let intent = normalizeWorkflowIntent(intentAnalysis.intent);
  const stationNameHint = parseStationNameHint(message);
  const hasExplicitEquity = /\bequity\b/i.test(String(message || ''));
  const hasExplicitBond = /\bbond\b/i.test(String(message || ''));
  const isBalanceQuery = isBalanceQueryMessage(message);

  // Hard guardrail:
  // If user references an existing ChargeFrog station name without choosing equity/bond,
  // force INVEST_STATION intent (which will return choices). Never send to discovery.
  if (
    stationNameHint &&
    !hasExplicitEquity &&
    !hasExplicitBond &&
    !isBalanceQuery
  ) {
    intent = STATE.INVEST_STATION;
  }

  if (stationNameHint && intent === STATE.FIND_STATION_FOR_PROPOSAL) {
    intent = STATE.INVEST_STATION;
  }

  if (intent === STATE.BUY_EQUITY || intent === STATE.BUY_BOND) {
    intent = STATE.INVEST_STATION;
  }
  const domainScope = evaluateChatDomainScope({ message, intent });
  const agents = [];
  let result;

  try {
    if (!domainScope.allowed) {
      const blocked = {
        intent,
        correlationId,
        blocked: true,
        blockedReason: domainScope.reason,
        reply: domainScope.reply,
        degraded: false,
      };

      logStructured({
        correlationId,
        level: 'warn',
        agent: AGENTS.ORCHESTRATOR,
        action: 'guardrail:block_out_of_scope',
        input: { message, walletAddress: walletAddress ? '[provided]' : null },
        outputSummary: {
          intent,
          blocked: true,
          blockedReason: domainScope.reason,
        },
        success: true,
        durationMs: Date.now() - startedAt,
      });

      return blocked;
    }

    if (intent === STATE.FIND_STATION_FOR_PROPOSAL) {
      const stationFinder = await callPlannerWorkerAgent({
        endpointPath: PLANNER_WORKER_ENDPOINTS.stationFinder,
        action: 'a2a:station_finder',
        correlationId,
        payload: {
          message,
          walletAddress,
          intentAnalysis,
          correlationId,
        },
      });
      agents.push({
        agent: AGENTS.STATION_FINDER,
        status: stationFinder.status,
      });

      if (stationFinder.status === 'candidate_ready') {
        const investmentProposalGenerator = await callPlannerWorkerAgent({
          endpointPath: PLANNER_WORKER_ENDPOINTS.investmentProposalGenerator,
          action: 'a2a:investment_proposal_generator',
          correlationId,
          payload: {
            finderResult: stationFinder,
            correlationId,
          },
        });
        agents.push({
          agent: AGENTS.INVESTMENT_PROPOSAL_GENERATOR,
          status: investmentProposalGenerator.status,
        });
        if (investmentProposalGenerator.status === 'proposal_created') {
          result = {
            status:
              investmentProposalGenerator?.proposal?.status ||
              investmentProposalGenerator.status,
            reply: `${stationFinder.reply} ${investmentProposalGenerator.reply}`,
            proposalWorkflowStatus: investmentProposalGenerator.status,
            stationCandidate: summarizeStationCandidate(stationFinder),
            proposal: investmentProposalGenerator.proposal || null,
          };
        } else {
          result = {
            status: investmentProposalGenerator.status,
            reply: `${stationFinder.reply} ${investmentProposalGenerator.reply}`,
            stationCandidate: summarizeStationCandidate(stationFinder),
            proposal: investmentProposalGenerator.proposal || null,
          };
        }
      } else {
        result = {
          status: stationFinder.status,
          reply: stationFinder.reply,
          stationCandidate: summarizeStationCandidate(stationFinder),
        };
      }
    } else if (intent === STATE.ISSUE_ASSETS_AFTER_APPROVAL) {
      const proposalId = parseProposalId(message);
      result = {
        status: 'handoff_to_froggy_foundry',
        reply: proposalId
          ? `FroggyPlanner stops after proposal creation. Use POST /api/agent/froggy-foundry with {"proposalId":"${proposalId}"} to deploy the station and then create equity and bond tokens.`
          : 'FroggyPlanner stops after proposal creation. Use POST /api/agent/froggy-foundry to deploy the station and then create equity and bond tokens.',
        proposalId: proposalId || null,
      };
    } else if (intent === STATE.LIST_AVAILABLE_STATIONS) {
      const listed = await listInvestableStations({ correlationId });
      result = {
        status: listed.status,
        reply: listed.reply,
        stations: listed.stations,
      };
    } else if (intent === STATE.GET_TOKEN_BALANCE) {
      const balance = await executeGetTokenBalance({
        message,
        walletAddress,
        correlationId,
      });
      const { reply, ...balancePayload } = balance;
      result = {
        status: balance.status,
        reply,
        balance: balancePayload,
      };
    } else if (intent === STATE.SHOW_INVESTMENT_CHOICES) {
      const choices = await showInvestmentChoices({ message, correlationId });
      const { reply, ...choicesPayload } = choices;
      result = {
        status: choices.status,
        reply,
        choices: choicesPayload,
      };
    } else if (intent === STATE.INVEST_STATION) {
      const requestedAssetType = parseRequestedAssetType(message);
      if (!requestedAssetType) {
        const choices = await showInvestmentChoices({ message, correlationId });
        const { reply, ...choicesPayload } = choices;
        result = {
          status: choices.status,
          reply,
          choices: choicesPayload,
        };
      } else {
        const buy = await executeBuy({
          message,
          walletAddress,
          correlationId,
          assetType: requestedAssetType,
        });
        const { reply, ...purchasePayload } = buy;
        result = {
          status: buy.status,
          reply,
          purchase: purchasePayload,
        };
      }
    } else if (intent === STATE.BUY_EQUITY) {
      const buy = await executeBuy({
        message,
        walletAddress,
        correlationId,
        assetType: 'equity',
      });
      const { reply, ...purchasePayload } = buy;
      result = {
        status: buy.status,
        reply,
        purchase: purchasePayload,
      };
    } else if (intent === STATE.BUY_BOND) {
      const buy = await executeBuy({
        message,
        walletAddress,
        correlationId,
        assetType: 'bond',
      });
      const { reply, ...purchasePayload } = buy;
      result = {
        status: buy.status,
        reply,
        purchase: purchasePayload,
      };
    } else {
      if (isBalanceQueryMessage(message)) {
        const balance = await executeGetTokenBalance({
          message,
          walletAddress,
          correlationId,
        });
        const { reply, ...balancePayload } = balance;
        result = {
          status: balance.status,
          reply,
          balance: balancePayload,
        };
      } else if (isInvestmentExecutionMessage(message)) {
        const requestedAssetType = parseRequestedAssetType(message);
        if (!requestedAssetType) {
          const choices = await showInvestmentChoices({
            message,
            correlationId,
          });
          const { reply, ...choicesPayload } = choices;
          result = {
            status: choices.status,
            reply,
            choices: choicesPayload,
          };
        } else {
          const buy = await executeBuy({
            message,
            walletAddress,
            correlationId,
            assetType: requestedAssetType,
          });
          const { reply, ...purchasePayload } = buy;
          result = {
            status: buy.status,
            reply,
            purchase: purchasePayload,
          };
        }
      } else {
        result = {
          status: STATE.GENERAL,
          reply:
            'I can help with: find station for proposal, list available stations, show choices, buy equity/bond, or get token balance. Station deployment and token creation are handled by /api/agent/froggy-foundry.',
        };
      }
    }

    const assembled = {
      intent,
      correlationId,
      degraded: false,
      ...result,
    };

    logStructured({
      correlationId,
      agent: AGENTS.ORCHESTRATOR,
      action: 'run_orchestrator',
      input: { message, walletAddress: walletAddress ? '[provided]' : null },
      outputSummary: {
        intent,
        status: assembled.status || null,
        agentsRun: agents.map((agent) => `${agent.agent}:${agent.status}`),
      },
      success: true,
      durationMs: Date.now() - startedAt,
    });

    return assembled;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStructured({
      correlationId,
      level: 'error',
      agent: AGENTS.ORCHESTRATOR,
      action: 'run_orchestrator',
      input: { message, walletAddress: walletAddress ? '[provided]' : null },
      outputSummary: {},
      success: false,
      durationMs: Date.now() - startedAt,
      error: errorMessage,
    });
    return {
      intent,
      correlationId,
      degraded: true,
      reply:
        'I hit an upstream dependency error while executing this workflow. Please try again shortly.',
      error: errorMessage,
    };
  }
}

// Handles initializeAgent.
async function initializeAgent() {
  if (initPromise) {
    return initPromise;
  }

  initPromise = ensureConnected().catch((error) => {
    initPromise = undefined;
    throw error;
  });

  return initPromise;
}

// Handles runAgent.
async function runAgent(input = {}) {
  const allowedKeys = new Set(['message', 'walletAddress']);
  const extraKeys = Object.keys(input || {}).filter(
    (key) => !allowedKeys.has(key),
  );
  if (extraKeys.length > 0) {
    throw new Error(
      `Unsupported fields for /api/agent/froggy-planner: ${extraKeys.join(', ')}. Allowed fields: message, walletAddress`,
    );
  }

  const message = String(input.message || '').trim();
  if (!message) {
    throw new Error('message is required');
  }

  const walletAddress = normalizeWalletAddress(input.walletAddress);
  return runOrchestrator({ message, walletAddress });
}

async function runFoundryAgent(input = {}) {
  const allowedKeys = new Set([
    'message',
    'proposalId',
    'stationName',
    'projectUrl',
    'stationMetadata',
    'totalInvestment',
    'totalInvestmentHbar',
    'totalShares',
    'initialFundAddress',
    'registryAddress',
    'boltAddress',
    'rpcUrl',
    'expectedStationId',
    'stationId',
    'correlationId',
  ]);
  const extraKeys = Object.keys(input || {}).filter(
    (key) => !allowedKeys.has(key),
  );
  if (extraKeys.length > 0) {
    throw new Error(
      `Unsupported fields for /api/agent/froggy-foundry: ${extraKeys.join(', ')}. Allowed fields: message, proposalId, stationName, projectUrl, stationMetadata, totalInvestment, totalInvestmentHbar, totalShares, initialFundAddress, registryAddress, boltAddress, rpcUrl, expectedStationId, stationId, correlationId`,
    );
  }

  const proposalId = String(input.proposalId || '').trim();
  const message = String(input.message || '').trim();

  if (!proposalId && !message) {
    throw new Error('message or proposalId is required');
  }

  const correlationId = input.correlationId || crypto.randomUUID();
  const intent = parseFoundryIntent(input);

  if (intent === 'list_pending_admin_action') {
    return runFoundryAttentionQueue({ correlationId });
  }

  if (intent === 'approve_pending_admin_action') {
    const resolution = await resolveFoundryApprovalTarget({
      input,
      correlationId,
    });
    if (resolution.status !== 'resolved') {
      return resolution;
    }
    return runFoundryWorkflow({
      ...input,
      proposalId: resolution.proposalId,
      correlationId,
    });
  }

  return {
    status: 'general',
    reply:
      'I can list stations pending admin action, and approve a station proposal for deployment on Hedera testnet plus equity and bond token creation.',
  };
}

module.exports = {
  initializeAgent,
  runAgent,
  runFoundryAgent,
  runFoundryWorker,
  runStationFinderAgent,
  runInvestmentProposalGeneratorAgent,
  runStationAssetIssuerAgent,
  runStationAssetIssuerWorker,
  INTENT,
  TOOL_DEFINITIONS,
  STATE,
  AGENTS,
  DECISION_POLICIES,
  PROMPT_VERSION,
  AGENT_PROMPTS,
  runStationAssetIssuerIfProposalApproved,
};
