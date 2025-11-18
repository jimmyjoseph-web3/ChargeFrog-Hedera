import { GetRolesForRequest } from '@hashgraph/asset-tokenization-sdk';
import { SDKService as sdk } from '../services/SDKService';

/**
 * Fetch roles for a specific diamond contract.
 */
export async function getRoles(targetId: string, stationId: number) {
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
  const RolesReq = new GetRolesForRequest({
    securityId: security,

    targetId,
    start: 0,
    end: 10,
  });

  const roles_res = await sdk.getRolesFor(RolesReq);
  return JSON.stringify(roles_res, null, 2).replace(/"(.*?)"(,?)/g, '"$1"$2\n');
}
