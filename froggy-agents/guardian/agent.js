const { runGuardianPolicyStationFlow } = require('./policyFlowAgent');
const { guardianTools } = require('./tools');

const guardianPolicyAgent = {
  name: 'guardian_policy_agent',
  version: '1.0.0',
  description:
    'Executes strict two-policy Guardian replication flow (Carbon then Wipe) using Guardian API-mirrored tools.',
  tools: Object.freeze({
    createPolicy: '/api/guardian/createPolicy',
    pushSchemaByTopic: '/api/guardian/schemas/push/{topicId}',
    listPolicies: '/api/guardian/policies',
    getPolicyById: '/api/guardian/policies/{policyId}',
    updatePolicyById: '/api/guardian/policies/{policyId}',
    publishPolicyById: '/api/guardian/policies/{policyId}/publish',
    publishPolicyByIdTreasury:
      '/api/guardian/policies/{policyId}/publish-treasury',
    listSchemasByTopicId: '/api/guardian/schemas/by-topic/{topicId}',
  }),
  run: runGuardianPolicyStationFlow,
};

module.exports = {
  guardianPolicyAgent,
  guardianTools,
  runGuardianPolicyAgent: runGuardianPolicyStationFlow,
};
