const { runGuardianPolicyStationFlow } = require('./policyFlowAgent');
const { listStationsByStage, getStationById } = require('../store/stationStore');

const guardianAdminTools = {
  // Internal tool for listing stations eligible for Guardian policy/schema creation.
  async listFullyInvestedStations() {
    return listStationsByStage('fully-invested');
  },

  // Internal tool for reading a station snapshot by stationId.
  async getStationById(input = {}) {
    return getStationById(input.stationId);
  },

  // Mirrors: POST /api/guardian/agent/create-station-policies
  async createStationPolicies(input = {}) {
    return runGuardianPolicyStationFlow(input);
  },
};

module.exports = {
  guardianAdminTools,
};
