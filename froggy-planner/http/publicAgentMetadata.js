const { AIAgentCapability } = require('@hashgraphonline/standards-sdk');

function buildPublicAgentSocials(publicBaseUrl) {
  return Object.freeze([
    { platform: 'website', handle: String(publicBaseUrl || '').trim() },
  ]);
}

function buildPublicAgentSocials(publicBaseUrl) {
  return Object.freeze([
    { platform: 'website', handle: String(publicBaseUrl || '').trim() },
  ]);
}

function resolvePlannerModel() {
  return String(process.env.AGENT_MODEL || 'gpt-5.2').trim();
}

function resolveGuardianModel() {
  return String(
    process.env.GUARDIAN_AGENT_MODEL ||
      process.env.AGENT_MODEL ||
      'gpt-5.2',
  ).trim();
}

function resolveFoundryModel() {
  return String(
    process.env.FOUNDRY_AGENT_MODEL ||
      process.env.AGENT_MODEL ||
      'gpt-5.2',
  ).trim();
}

function resolveChatDocumentationUrl() {
  return String(process.env.HOL_DOCUMENTATION_CHAT || '/docs').trim() || '/docs';
}