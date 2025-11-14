import { GetAccountBalanceRequest } from '@hashgraph/asset-tokenization-sdk';
import { SDKService as sdk } from '../services/SDKService';

/**
 * Fetches the balance of a tokenized asset.
 */
export async function getBalanceOf(targetId: string) {
  const balance_req = new GetAccountBalanceRequest({
    securityId: import.meta.env.VITE_SECURITY_CONTRACT_ID ?? '',
    targetId,
  });

  const balance_res = await sdk.getBalanceOf(balance_req); // Balance of tokenized asset

  return JSON.stringify(balance_res); // Return the entire response as a string
}
