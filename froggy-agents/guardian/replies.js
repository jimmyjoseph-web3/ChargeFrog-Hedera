const REPLY_TEMPLATES = Object.freeze({
  adminAutoSelectedSingleStation:
    'Done! There was only one fully-invested station available, so I used {{STATION_NAME}} as the source station. Here are the details of your replication workflow.',
  adminGeneralBlocked:
    'I only handle two admin actions here: listing fully-invested stations, or creating Guardian policy and schema records for a fully-invested station by station name.',
  adminListMultipleFullyInvestedStations:
    'I found {{STATION_COUNT}} fully-invested stations that are ready for Guardian policy and schema creation so they can move closer to going live: {{STATION_SUMMARY}}. If you want to continue, just tell me which station you want me to use.',
  adminListOneFullyInvestedStation:
    'I found 1 fully-invested station that is ready for Guardian policy and schema creation so the station can move closer to going live: {{STATION_SUMMARY}}.',
  adminNoFullyInvestedStations:
    'There are currently no fully-invested stations. Check back in awhile',
  adminNoSourceStations:
    'There are no fully-invested stations available to use as source stations for Guardian policy and schema creation.',
  adminSelectedStation:
    'Done! Here are the details of your replication workflow for {{STATION_NAME}}.',
  adminStationNotFullyInvested:
    'Station {{STATION_ID}} is not in fully-invested stage.',
  adminUnresolvedStation:
    'I can do that, but I could not tell which past station you meant. These fully-invested stations are ready for policy and schema creation so they can move toward going live: {{STATION_SUMMARY}}.',
  chatGeneralBlockedReply:
    'I only handle Guardian policy enquiries for a specific station. Please provide a station name and ask about its policy.',
  chatGeneralBlockedSummary:
    'I only handle Guardian policy enquiries for a specific station.',
  chatMissingStationReply:
    'This Guardian enquiry requires a station name. Example: "show me the policy for Madison Square Garden".',
  chatMissingStationSummary:
    'This Guardian enquiry requires a station name.',
  chatNoPoliciesReply:
    'I could not find any Guardian policy entries matching station name "{{STATION_NAME}}".',
  chatNoPoliciesSummary:
    'I could not find any Guardian policies for {{STATION_NAME}}.',
});

function renderGuardianReply(templateKey, variables = {}) {
  const template = REPLY_TEMPLATES[templateKey];
  if (!template) {
    throw new Error(`Unknown Guardian reply template: ${templateKey}`);
  }

  return template.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = variables[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

module.exports = {
  REPLY_TEMPLATES,
  renderGuardianReply,
};
