const {
  createPolicyWithGuardian,
  createSchemaWithGuardian,
  listPoliciesWithGuardian,
  listSchemasByTopicIdWithGuardian,
  getPolicyByIdWithGuardian,
  updatePolicyByIdWithGuardian,
  publishPolicyByIdWithGuardian,
  publishPolicyByIdWithGuardianTreasury,
} = require('../clients/guardianClient');

const guardianTools = {
  // Mirrors: POST /api/guardian/createPolicy
  async createPolicy(input = {}) {
    return createPolicyWithGuardian(input);
  },

  // Mirrors: POST /api/guardian/schemas/push/{topicId}
  async pushSchemaByTopic(input = {}) {
    return createSchemaWithGuardian(input);
  },

  // Mirrors: GET /api/guardian/policies
  async listPolicies(input = {}) {
    return listPoliciesWithGuardian(input);
  },

  // Mirrors: GET /api/guardian/policies/{policyId}
  async getPolicyById(input = {}) {
    return getPolicyByIdWithGuardian(input);
  },

  // Mirrors: PUT /api/guardian/policies/{policyId}
  async updatePolicyById(input = {}) {
    return updatePolicyByIdWithGuardian(input);
  },

  // Mirrors: PUT/POST /api/guardian/policies/{policyId}/publish
  async publishPolicyById(input = {}) {
    return publishPolicyByIdWithGuardian(input);
  },

  // Mirrors: PUT/POST /api/guardian/policies/{policyId}/publish-treasury
  async publishPolicyByIdTreasury(input = {}) {
    return publishPolicyByIdWithGuardianTreasury(input);
  },

  // Mirrors: GET /api/guardian/schemas/by-topic/{topicId}
  async listSchemasByTopicId(input = {}) {
    return listSchemasByTopicIdWithGuardian(input);
  },
};

module.exports = {
  guardianTools,
};
