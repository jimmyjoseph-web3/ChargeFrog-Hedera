import { GetRolesForRequest } from '@hashgraph/asset-tokenization-sdk';
import { SDKService as sdk } from '../services/SDKService';

/**
 * Fetch roles for a specific diamond contract.
 */
export async function getRoles() {
  const RolesReq = new GetRolesForRequest({
    securityId: '0.0.7169251',
    targetId: '0.0.7106098',
    start: 0,
    end: 10,
  });

  const roles_res = await sdk.getRolesFor(RolesReq);
  return JSON.stringify(roles_res, null, 2).replace(/"(.*?)"(,?)/g, '"$1"$2\n');
}