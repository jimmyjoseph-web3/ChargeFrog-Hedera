export const ENABLE_FROGGY_PLANNER_AFTER_INVEST = false;

export function buildFroggyPlannerPrompt(args: {
  stationId: string;
  amount: number;
}) {
  const { stationId, amount } = args;

  return `Oh, this was quite close to my point of interest, alrighty give me ${amount} equity tokens for this station ${stationId}`;
}