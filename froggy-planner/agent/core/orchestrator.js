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
  parseAmount,
  parseRequestedAssetType,
  isBalanceQueryMessage,
  isInvestmentExecutionMessage,
  toPositiveWholeNumber,
  normalizeWorkflowIntent,
  evaluateChatDomainScope,
} = require('./parsing');
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
} = require('../config/prompts');

const AGENT_PROMPTS = {
  intent: INTENT_CLASSIFIER_PROMPT,
  orchestrator: ORCHESTRATOR_PROMPT,
  stationFinder: STATION_FINDER_PROMPT,
  investmentProposalGenerator: INVESTMENT_PROPOSAL_GENERATOR_PROMPT,
};

// Runtime behavior: the public coordinator delegates to internal worker agents
// over internal A2A, and worker agents invoke local tools directly.
let initPromise;
const PLANNER_WORKER_ENDPOINTS = Object.freeze({
  stationFinder: '/a2a/station-finder',
  investmentProposalGenerator: '/a2a/investment-proposal-generator',
});

const PENDING_ADMIN_ACTION_REPLY =
  'Thank you for your interest! We are so happy with the successful funding of this station, now we need the ChargeFrog Team to greenlight the deployment of this station.';

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
            'I can help with: find station for proposal, list available stations, show choices, buy equity/bond, or get token balance.',
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

module.exports = {
  initializeAgent,
  runAgent,
  runStationFinderAgent,
  runInvestmentProposalGeneratorAgent,
  INTENT,
  TOOL_DEFINITIONS,
  STATE,
  AGENTS,
  DECISION_POLICIES,
  PROMPT_VERSION,
  AGENT_PROMPTS,
};
