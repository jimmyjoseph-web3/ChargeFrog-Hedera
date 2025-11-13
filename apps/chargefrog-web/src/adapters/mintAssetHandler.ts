import {
  IssueRequest,
  RoleRequest,
  ApplyRolesRequest,
  TransferRequest,
} from '@hashgraph/asset-tokenization-sdk';
import { SDKService as sdk } from '../services/SDKService';
import { SecurityRole } from '../utils/SecurityRole';

/**
 * Handles minting assets and transferring tokens.
 */
type MintAssetHandlerOptions = {
  onProgress?: (message: string) => void;
};

export async function mintAssetHandler(options?: MintAssetHandlerOptions) {
  try {
    const onProgress = options?.onProgress;
    // ✅ 1 — APPLY ROLES FIRST
    const roles = [SecurityRole._ISSUER_ROLE, SecurityRole._AGENT_ROLE];
    const target = '0.0.7106098'; // admin account
    const security = '0.0.7169251'; // security contract

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

    // ✅ 2 — MINT CREDIT/EQUITY FIRST
    const mintReq = new IssueRequest({
      securityId: security,
      targetId: target,
      amount: '50.0',
    });

    console.log('🚀 Minting asset:', mintReq);
    onProgress?.('Minting 50.0 tokens to target...');

    const mintResult = await sdk.mint(mintReq);

    if (!mintResult) {
      console.error('❌ Mint failed');
      onProgress?.('Mint failed');
      return;
    }

    console.log('✅ Mint successful:', mintResult);
    onProgress?.('Mint successful');

    // ✅ 3 — TRANSFER AFTER SUCCESSFUL MINT
    const transReq = new TransferRequest({
      targetId: '0.0.7098424', // receiver
      amount: '10.0',
      securityId: security,
    });

    onProgress?.('Transferring 10.0 tokens to receiver...');
    const transferRes = await sdk.transfer(transReq);

    if (transferRes) {
      console.log('✅ Transfer completed:', transferRes);
      onProgress?.('Transfer completed');
    }

    return JSON.stringify({ mintResult, transferRes });
  } catch (err) {
    console.error('❌ Operation failed:', err);
    options?.onProgress?.('Operation failed');
  }
}
