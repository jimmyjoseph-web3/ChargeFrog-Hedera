import {
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
  options?: MintAssetHandlerOptions,
) {
  try {
    const onProgress = options?.onProgress;
    // 1 — APPLY ROLES FIRST
    const security = import.meta.env.VITE_SECURITY_CONTRACT_ID ?? ''; // security contract
    // Share the same amount string for mint and optional transfer
    const amountStr =
      options?.transferAmount !== undefined
        ? String(options.transferAmount)
        : '0.0';

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
      targetId: '0.0.7106098',
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
    if (options?.receiverId) {
      const transReq = new TransferRequest({
        targetId: options.receiverId,
        amount: amountStr,
        securityId: security,
      });
      onProgress?.(`Transferring ${amountStr} tokens to receiver...`);
      transferRes = await sdk.transfer(transReq);
      if (transferRes) {
        onProgress?.('Transfer completed');
      }
    }

    return JSON.stringify({ mintResult, transferRes });
  } catch (err) {
    console.error('❌ Operation failed:', err);
    options?.onProgress?.('Operation failed');
  }
}
