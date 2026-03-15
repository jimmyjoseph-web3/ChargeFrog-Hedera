const path = require('path');
const { PROMPT_VERSION } = require('./constants');
const { loadMarkdownPrompt } = require('../../lib/promptLoader');

const PROMPTS_DIR = path.resolve(__dirname, '../prompts');
const PARTIALS_DIR = path.join(PROMPTS_DIR, 'partials');

const OUTPUT_CONTRACT_BLOCK = loadMarkdownPrompt(
  path.join(PARTIALS_DIR, 'output-contract-block.md'),
);

const SHARED_POLICY_BLOCK = loadMarkdownPrompt(
  path.join(PARTIALS_DIR, 'shared-policy-block.md'),
);

const promptVariables = {
  PROMPT_VERSION,
  SHARED_POLICY_BLOCK,
  OUTPUT_CONTRACT_BLOCK,
};

const INTENT_CLASSIFIER_PROMPT = loadMarkdownPrompt(
  path.join(PROMPTS_DIR, 'intent-classifier.md'),
  promptVariables,
);

const ORCHESTRATOR_PROMPT = loadMarkdownPrompt(
  path.join(PROMPTS_DIR, 'orchestrator.md'),
  promptVariables,
);

const STATION_FINDER_PROMPT = loadMarkdownPrompt(
  path.join(PROMPTS_DIR, 'station-finder.md'),
  promptVariables,
);

const INVESTMENT_PROPOSAL_GENERATOR_PROMPT = loadMarkdownPrompt(
  path.join(PROMPTS_DIR, 'investment-proposal-generator.md'),
  promptVariables,
);

const OUT_OF_SCOPE_REPLY_PROMPT = loadMarkdownPrompt(
  path.join(PROMPTS_DIR, 'out-of-scope-reply.md'),
  promptVariables,
);

module.exports = {
  PROMPT_VERSION,
  SHARED_POLICY_BLOCK,
  INTENT_CLASSIFIER_PROMPT,
  ORCHESTRATOR_PROMPT,
  STATION_FINDER_PROMPT,
  INVESTMENT_PROPOSAL_GENERATOR_PROMPT,
  OUT_OF_SCOPE_REPLY_PROMPT,
};
