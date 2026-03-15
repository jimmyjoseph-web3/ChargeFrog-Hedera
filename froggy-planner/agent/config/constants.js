const PROMPT_VERSION = 'v2-prod-2026-03-15';

const AGENTS = Object.freeze({
  ORCHESTRATOR: 'orchestrator',
  FOUNDRY: 'froggy_foundry',
  STATION_FINDER: 'station_finder',
  INVESTMENT_PROPOSAL_GENERATOR: 'investment_proposal_generator',
  STATION_ASSET_ISSUER: 'station_asset_issuer',
});

const STATE = Object.freeze({
  FIND_STATION_FOR_PROPOSAL: 'FIND_STATION_FOR_PROPOSAL',
  CHECK_INTEREST_STATUS: 'CHECK_INTEREST_STATUS',
  CREATE_INVESTMENT_PROPOSAL: 'CREATE_INVESTMENT_PROPOSAL',
  INVEST_STATION: 'INVEST_STATION',
  GET_TOKEN_BALANCE: 'GET_TOKEN_BALANCE',
  LIST_AVAILABLE_STATIONS: 'LIST_AVAILABLE_STATIONS',
  SHOW_INVESTMENT_CHOICES: 'SHOW_INVESTMENT_CHOICES',
  ISSUE_ASSETS_AFTER_APPROVAL: 'ISSUE_ASSETS_AFTER_APPROVAL',
  BUY_EQUITY: 'BUY_EQUITY',
  BUY_BOND: 'BUY_BOND',
  GENERAL: 'GENERAL',
});

const INTENT = Object.freeze({
  DISCOVER_STATION: STATE.FIND_STATION_FOR_PROPOSAL,
  INVEST_STATION: STATE.INVEST_STATION,
  GENERAL: STATE.GENERAL,
  ...STATE,
});

const TOOL_DEFINITIONS = Object.freeze([
  { name: 'webSearch' },
  { name: 'resolveAreaCenter' },
  { name: 'reverseGeocode' },
  { name: 'getPoi' },
  { name: 'registerMiniNode' },
  { name: 'getNeighborhoodSummary' },
  { name: 'getChargingAvailability' },
  { name: 'createInvestmentProposal' },
  { name: 'readOnChainProposal' },
  { name: 'readOffChainMetadata' },
  { name: 'findStationByLocation' },
  { name: 'getStation' },
  { name: 'getStationByProposalId' },
  { name: 'listStationsByStage' },
  { name: 'deployStationBundle' },
  { name: 'saveStationDeployment' },
  { name: 'generateISIN' },
  { name: 'createEquityToken' },
  { name: 'createBondToken' },
  { name: 'saveIssuedAssets' },
  { name: 'mintEquity' },
  { name: 'mintBond' },
  { name: 'issueEquity' },
  { name: 'issueBond' },
  { name: 'getTokenBalance' },
  { name: 'listStationsAvailable' },
  { name: 'listAllStations' },
]);

const DECISION_POLICIES = Object.freeze({
  nonHallucination: true,
  strictDomainGuardrails: true,
  defaultNeighborhoodRadiusMiles: Number(
    process.env.STATION_NEIGHBORHOOD_RADIUS_MILES || 50,
  ),
  defaultInterestThreshold: Number(
    process.env.STATION_INTEREST_THRESHOLD ||
      process.env.STATION_INTEREST_MIN_THRESHOLD ||
      5,
  ),
  proposalThresholdOption: Number(
    process.env.STATION_INTEREST_THRESHOLD_OPTION || 10,
  ),
  candidateRadiusMeters: Number(
    process.env.STATION_CANDIDATE_RADIUS_METERS || 5000,
  ),
  duplicateStationRadiusMeters: Number(
    process.env.STATION_DUPLICATE_RADIUS_METERS || 1000,
  ),
  poiLimit: Number(process.env.STATION_POI_LIMIT || 20),
  candidateLimit: Number(process.env.STATION_CANDIDATE_LIMIT || 25),
  proposalWebResearchRequired: true,
  proposalWebResearchMinResults: Number(
    process.env.STATION_PROPOSAL_WEB_MIN_RESULTS || 1,
  ),
  retries: 2,
});

const DOMAIN_SCOPED_INTENTS = new Set([
  STATE.FIND_STATION_FOR_PROPOSAL,
  STATE.CHECK_INTEREST_STATUS,
  STATE.CREATE_INVESTMENT_PROPOSAL,
  STATE.ISSUE_ASSETS_AFTER_APPROVAL,
  STATE.INVEST_STATION,
  STATE.GET_TOKEN_BALANCE,
  STATE.LIST_AVAILABLE_STATIONS,
  STATE.SHOW_INVESTMENT_CHOICES,
  STATE.BUY_EQUITY,
  STATE.BUY_BOND,
]);

const DOMAIN_KEYWORDS = Object.freeze([
  /\bstation\b/i,
  /\binvest(?:ment|ing)?\b/i,
  /\bproposal\b/i,
  /\bequity\b/i,
  /\bbond\b/i,
  /\bmint\b/i,
  /\bissue\b/i,
  /\bbalance\b/i,
  /\bholdings?\b/i,
  /\bhbar\b/i,
  /\bcharging?\b/i,
  /\bev\b/i,
  /\bcharger\b/i,
  /\bneighbou?rhood\b/i,
  /\bpoi\b/i,
]);

const AGENT_PROMPT_REFS = Object.freeze({
  orchestrator: 'ORCHESTRATOR_PROMPT',
  stationFinder: 'STATION_FINDER_PROMPT',
  investmentProposalGenerator: 'INVESTMENT_PROPOSAL_GENERATOR_PROMPT',
  stationAssetIssuer: 'STATION_ASSET_ISSUER_PROMPT',
  intent: 'INTENT_CLASSIFIER_PROMPT',
});

module.exports = {
  PROMPT_VERSION,
  AGENTS,
  STATE,
  INTENT,
  TOOL_DEFINITIONS,
  DECISION_POLICIES,
  DOMAIN_SCOPED_INTENTS,
  DOMAIN_KEYWORDS,
  AGENT_PROMPT_REFS,
};
