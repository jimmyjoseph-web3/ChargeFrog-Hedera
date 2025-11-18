import { GetAccountBalanceRequest } from '@hashgraph/asset-tokenization-sdk';
import { SDKService as sdk } from '../services/SDKService';

/**
 * Fetches the balance of a tokenized asset.
 */
export async function getBalanceOf(targetId: string, stationId: number) {
  const security =
    stationId === 1
      ? import.meta.env.VITE_STATION_1_SECURITY_CONTRACT_ID
      : stationId === 2
        ? import.meta.env.VITE_STATION_2_SECURITY_CONTRACT_ID
        : stationId === 3
          ? import.meta.env.VITE_STATION_3_SECURITY_CONTRACT_ID
          : stationId === 4
            ? import.meta.env.VITE_STATION_4_SECURITY_CONTRACT_ID
            : (import.meta.env.VITE_SECURITY_CONTRACT_ID ?? '');
  const balance_req = new GetAccountBalanceRequest({
    securityId: security,

    targetId,
  });

  const balance_res = await sdk.getBalanceOf(balance_req); // Balance of tokenized asset

  return JSON.stringify(balance_res); // Return the entire response as a string
}
