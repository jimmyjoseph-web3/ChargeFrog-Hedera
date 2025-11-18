import {
  GetMaxSupplyRequest,
  IssueRequest,
  TransferRequest,
} from '@hashgraph/asset-tokenization-sdk';
import { SDKService as sdk } from '../services/SDKService';

/**
 * Handles minting assets and transferring tokens.
 */
type MintAssetHandlerOptions = {
  onProgress?: (message: string) => void;
  receiverId?: string; // optional separate receiver; if omitted, skips transfer
  transferAmount?: number; // optional amount to transfer (e.g., requestedShares)
};

export async function mintAssetHandler(
  _targetId: string,
  stationId: number,
  options?: MintAssetHandlerOptions,
) {
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
  try {
    const onProgress = options?.onProgress;
    // 1 — APPLY ROLES FIRST

    // Share the same amount string for mint and optional transfer
    const amountStr =
      options?.transferAmount !== undefined
        ? String(options.transferAmount)
        : '0.0';

    console.log('StationID:', stationId);
    console.log('TargetID:', _targetId);
    console.log(
      'SecurityID:',
      import.meta.env.VITE_STATION_1_SECURITY_CONTRACT_ID,
    );

    const max_supply = new GetMaxSupplyRequest({
      securityId: security,
    });

    const max_res = await sdk.getMaxSupply(max_supply);

    console.log('This is the max supply:', max_res);

    /*
    This was commented out because admins have already been given the issuer and agent roles.

    const roles = [SecurityRole._ISSUER_ROLE, SecurityRole._AGENT_ROLE];
    onProgress?.('Applying roles (issuer, agent)...');
    const admin_role_req = new ApplyRolesRequest({
      targetId: target,
      securityId: security,
      roles,
      actives: [true, true],
    });

    const admin_req_res = await sdk.applyRoles(admin_role_req);
    if (admin_req_res) {
      console.log('✅ ApplyRolesRequest sent');
      onProgress?.('ApplyRolesRequest sent');
    }

    Roles have already been granted
    const grantRoleRes = [];
    for (const role of roles) {
      onProgress?.(`Granting role ${role}...`);
      const grant_role_req = new RoleRequest({
        targetId: target,
        securityId: security,
        role,
      });

      const res = await sdk.grantRole(grant_role_req);
      grantRoleRes.push(res);
      console.log(`✅ Granted role: ${role}`, res);
      onProgress?.(`Granted role ${role}`);
    }

    console.log('✅ Roles applied & granted');
    onProgress?.('Roles applied & granted');
    */

    // 2 — MINT CREDIT/EQUITY TO TARGET
    const mintReq = new IssueRequest({
      securityId: security,
      // IMPORTANT: per requirement, do not change this targetId
      targetId: import.meta.env.VITE_DIAMOND_OWNER_ACCOUNT_ID,
      amount: amountStr,
    });

    onProgress?.(`Minting ${amountStr} tokens to target...`);

    const mintResult = await sdk.mint(mintReq);

    if (!mintResult) {
      console.error('❌ Mint failed');
      onProgress?.('Mint failed');
      return;
    }

    onProgress?.('Mint successful');

    // 3 — Transfer after mint
    let transferRes: unknown = null;

    const transReq = new TransferRequest({
      targetId: _targetId,
      amount: amountStr,
      securityId: security,
    });
    onProgress?.(`Transferring ${amountStr} tokens to receiver...`);
    transferRes = await sdk.transfer(transReq);
    if (transferRes) {
      onProgress?.('Transfer completed');
    }

    return JSON.stringify({ mintResult, transferRes });
  } catch (err) {
    console.error('❌ Operation failed:', err);
    options?.onProgress?.('Operation failed');
  }
}
