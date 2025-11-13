
import { GetAccountBalanceRequest } from '@hashgraph/asset-tokenization-sdk';
import { SDKService as sdk } from '../services/SDKService';

/**
 * Fetches the balance of a tokenized asset.
 */
export async function getBalanceOf() {
  const balance_req = new GetAccountBalanceRequest({
    securityId: '0.0.7169251',
    targetId: '0.0.7098424',
  });

  const balance_res = await sdk.getBalanceOf(balance_req); // Balance of tokenized asset

  return JSON.stringify(balance_res); // Return the entire response as a string
}