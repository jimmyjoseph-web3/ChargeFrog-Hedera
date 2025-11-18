import {
  ApplyRolesRequest,
  CreateEquityRequest,
  RoleRequest,
  SetMaxSupplyRequest,
} from '@hashgraph/asset-tokenization-sdk';
import { SDKService as sdk } from '../services/SDKService';
import { SecurityRole } from '../utils/SecurityRole';

/**
 * Creates a new equity token.
 */
export async function createNottinghamEquity() {
  try {
    const regulationType = 1; // Reg S
    const regulationSubType = 0;
    const currencyHex = '0x' + Buffer.from('USD', 'ascii').toString('hex');

    const createReq = new CreateEquityRequest({
      name: 'ChargeFrog-Notts',
      symbol: 'CFNT',
      isin: 'MY760VPEW3I9',
      decimals: 6,

      isWhiteList: false,
      isControllable: true,
      arePartitionsProtected: false,
      isMultiPartition: false,
      clearingActive: false,
      internalKycActivated: false,

      externalPausesIds: [],
      externalControlListsIds: [],
      externalKycListsIds: [],

      diamondOwnerAccount: import.meta.env.VITE_DIAMOND_OWNER_ACCOUNT_ID,

      votingRight: false,
      informationRight: true,
      liquidationRight: false,
      subscriptionRight: false,
      conversionRight: false,
      redemptionRight: false,
      putRight: false,
      dividendRight: 0,

      currency: currencyHex,
      numberOfShares: '1000',
      nominalValue: '1',

      regulationType,
      regulationSubType,
      isCountryControlListWhiteList: false,
      countries: '',

      info: 'ChargeFrog-Notts equity token for The ChargeFrog project — testnet',

      configId:
        '0x0000000000000000000000000000000000000000000000000000000000000001',
      configVersion: 0,

      complianceId: undefined,
      identityRegistryId: undefined,
      erc20VotesActivated: false,
    });

    const result = await sdk.createEquity(createReq);

    if (result && result.security) {
      console.log('🎉 Equity created successfully:', result.security);

      const roles = [
        SecurityRole._ISSUER_ROLE,
        SecurityRole._AGENT_ROLE,
        SecurityRole._CAP_ROLE,
      ];
      const admin_role_req = new ApplyRolesRequest({
        targetId: import.meta.env.VITE_DIAMOND_OWNER_ACCOUNT_ID,
        securityId: result.security.diamondAddress ?? '',
        roles,
        actives: [false, false, false],
      });

      const admin_req_res = await sdk.applyRoles(admin_role_req);
      if (admin_req_res) {
        console.log('✅ ApplyRolesRequest sent');
      }

      const grantRoleRes = [];
      for (const role of roles) {
        const grant_role_req = new RoleRequest({
          targetId: import.meta.env.VITE_DIAMOND_OWNER_ACCOUNT_ID,
          securityId: result.security.diamondAddress ?? '',
          role,
        });

        const res = await sdk.grantRole(grant_role_req);
        grantRoleRes.push(res);
        console.log(`✅ Granted role: ${role}`, res);
      }

      console.log('✅ Roles applied & granted');

      const max_supply = new SetMaxSupplyRequest({
        securityId: result.security.diamondAddress ?? '',
        maxSupply: '1000',
      });

      const max_res = await sdk.setMaxSupply(max_supply);

      console.log('Max supply set to Total Supply:', max_res);

      return JSON.stringify(result.security, null, 2);
    } else {
      console.warn('⚠️ Equity creation returned no result:', result);
      return result ? JSON.stringify(result, null, 2) : null;
    }
  } catch (err) {
    console.error('❌ Failed to create equity');

    if (err instanceof Error) {
      console.error('SDK Error Info:', {
        name: err.name,
        message: err.message,
      });
    }

    if (typeof err === 'object' && err !== null) {
      const errorObj = err as Record<string, unknown>;

      if ('reason' in errorObj || 'shortMessage' in errorObj) {
        console.error(
          'Contract/Transaction reason:',
          errorObj.reason || errorObj.shortMessage,
        );
      }

      if ('cause' in errorObj) {
        console.error('Nested cause:', errorObj.cause);
      }

      if ('data' in errorObj) {
        console.error('Error data payload:', errorObj.data);
      }
    }

    console.dir(err, { depth: null });
    return err instanceof Error
      ? `Error: ${err.message}`
      : 'Error creating equity';
  }
}

export async function createMajesticLabsEquity() {
  try {
    const regulationType = 1; // Reg S
    const regulationSubType = 0;
    const currencyHex = '0x' + Buffer.from('USD', 'ascii').toString('hex');

    const createReq = new CreateEquityRequest({
      name: 'ChargeFrog-MajesticLabs',
      symbol: 'CFML',
      isin: 'MYS1CG7RNLK5',
      decimals: 6,

      isWhiteList: false,
      isControllable: true,
      arePartitionsProtected: false,
      isMultiPartition: false,
      clearingActive: false,
      internalKycActivated: false,

      externalPausesIds: [],
      externalControlListsIds: [],
      externalKycListsIds: [],

      diamondOwnerAccount: import.meta.env.VITE_DIAMOND_OWNER_ACCOUNT_ID,

      votingRight: false,
      informationRight: true,
      liquidationRight: false,
      subscriptionRight: false,
      conversionRight: false,
      redemptionRight: false,
      putRight: false,
      dividendRight: 0,

      currency: currencyHex,
      numberOfShares: '1000',
      nominalValue: '1',

      regulationType,
      regulationSubType,
      isCountryControlListWhiteList: false,
      countries: '',

      info: 'ChargeFrog-MajesticLabs equity token for The ChargeFrog project — testnet',

      configId:
        '0x0000000000000000000000000000000000000000000000000000000000000001',
      configVersion: 0,

      complianceId: undefined,
      identityRegistryId: undefined,
      erc20VotesActivated: false,
    });

    const result = await sdk.createEquity(createReq);

    if (result && result.security) {
      console.log('🎉 Equity created successfully:', result.security);
      const roles = [
        SecurityRole._ISSUER_ROLE,
        SecurityRole._AGENT_ROLE,
        SecurityRole._CAP_ROLE,
      ];
      const admin_role_req = new ApplyRolesRequest({
        targetId: import.meta.env.VITE_DIAMOND_OWNER_ACCOUNT_ID,
        securityId: result.security.diamondAddress ?? '',
        roles,
        actives: [false, false, false],
      });

      const admin_req_res = await sdk.applyRoles(admin_role_req);
      if (admin_req_res) {
        console.log('✅ ApplyRolesRequest sent');
      }

      const grantRoleRes = [];
      for (const role of roles) {
        const grant_role_req = new RoleRequest({
          targetId: import.meta.env.VITE_DIAMOND_OWNER_ACCOUNT_ID,
          securityId: result.security.diamondAddress ?? '',
          role,
        });

        const res = await sdk.grantRole(grant_role_req);
        grantRoleRes.push(res);
        console.log(`✅ Granted role: ${role}`, res);
      }

      console.log('✅ Roles applied & granted');

      const max_supply = new SetMaxSupplyRequest({
        securityId: result.security.diamondAddress ?? '',
        maxSupply: '50',
      });

      const max_res = await sdk.setMaxSupply(max_supply);

      console.log('Max supply set to Total Supply:', max_res);

      return JSON.stringify(result.security, null, 2);
    } else {
      console.warn('⚠️ Equity creation returned no result:', result);
      return result ? JSON.stringify(result, null, 2) : null;
    }
  } catch (err) {
    console.error('❌ Failed to create equity');

    if (err instanceof Error) {
      console.error('SDK Error Info:', {
        name: err.name,
        message: err.message,
      });
    }

    if (typeof err === 'object' && err !== null) {
      const errorObj = err as Record<string, unknown>;

      if ('reason' in errorObj || 'shortMessage' in errorObj) {
        console.error(
          'Contract/Transaction reason:',
          errorObj.reason || errorObj.shortMessage,
        );
      }

      if ('cause' in errorObj) {
        console.error('Nested cause:', errorObj.cause);
      }

      if ('data' in errorObj) {
        console.error('Error data payload:', errorObj.data);
      }
    }

    console.dir(err, { depth: null });
    return err instanceof Error
      ? `Error: ${err.message}`
      : 'Error creating equity';
  }
}

export async function createMountAustinEquity() {
  try {
    const regulationType = 1; // Reg S
    const regulationSubType = 0;
    const currencyHex = '0x' + Buffer.from('USD', 'ascii').toString('hex');

    const createReq = new CreateEquityRequest({
      name: 'ChargeFrog-MountAustin',
      symbol: 'CFMA',
      isin: 'MYRNYEGF1O11',
      decimals: 6,

      isWhiteList: false,
      isControllable: true,
      arePartitionsProtected: false,
      isMultiPartition: false,
      clearingActive: false,
      internalKycActivated: false,

      externalPausesIds: [],
      externalControlListsIds: [],
      externalKycListsIds: [],

      diamondOwnerAccount: import.meta.env.VITE_DIAMOND_OWNER_ACCOUNT_ID,

      votingRight: false,
      informationRight: true,
      liquidationRight: false,
      subscriptionRight: false,
      conversionRight: false,
      redemptionRight: false,
      putRight: false,
      dividendRight: 0,

      currency: currencyHex,
      numberOfShares: '50',
      nominalValue: '1',

      regulationType,
      regulationSubType,
      isCountryControlListWhiteList: false,
      countries: '',

      info: 'ChargeFrog-MountAustin equity token for The ChargeFrog project — testnet',

      configId:
        '0x0000000000000000000000000000000000000000000000000000000000000001',
      configVersion: 0,

      complianceId: undefined,
      identityRegistryId: undefined,
      erc20VotesActivated: false,
    });

    const result = await sdk.createEquity(createReq);

    if (result && result.security) {
      console.log('🎉 Equity created successfully:', result.security);

      const roles = [
        SecurityRole._ISSUER_ROLE,
        SecurityRole._AGENT_ROLE,
        SecurityRole._CAP_ROLE,
      ];
      const admin_role_req = new ApplyRolesRequest({
        targetId: import.meta.env.VITE_DIAMOND_OWNER_ACCOUNT_ID,
        securityId: result.security.diamondAddress ?? '',
        roles,
        actives: [false, false, false],
      });

      const admin_req_res = await sdk.applyRoles(admin_role_req);
      if (admin_req_res) {
        console.log('✅ ApplyRolesRequest sent');
      }

      const grantRoleRes = [];
      for (const role of roles) {
        const grant_role_req = new RoleRequest({
          targetId: import.meta.env.VITE_DIAMOND_OWNER_ACCOUNT_ID,
          securityId: result.security.diamondAddress ?? '',
          role,
        });

        const res = await sdk.grantRole(grant_role_req);
        grantRoleRes.push(res);
        console.log(`✅ Granted role: ${role}`, res);
      }

      console.log('✅ Roles applied & granted');

      const max_supply = new SetMaxSupplyRequest({
        securityId: result.security.diamondAddress ?? '',
        maxSupply: '1000',
      });

      const max_res = await sdk.setMaxSupply(max_supply);

      console.log('Max supply set to Total Supply:', max_res);

      return JSON.stringify(result.security, null, 2);
    } else {
      console.warn('⚠️ Equity creation returned no result:', result);
      return result ? JSON.stringify(result, null, 2) : null;
    }
  } catch (err) {
    console.error('❌ Failed to create equity');

    if (err instanceof Error) {
      console.error('SDK Error Info:', {
        name: err.name,
        message: err.message,
      });
    }

    if (typeof err === 'object' && err !== null) {
      const errorObj = err as Record<string, unknown>;

      if ('reason' in errorObj || 'shortMessage' in errorObj) {
        console.error(
          'Contract/Transaction reason:',
          errorObj.reason || errorObj.shortMessage,
        );
      }

      if ('cause' in errorObj) {
        console.error('Nested cause:', errorObj.cause);
      }

      if ('data' in errorObj) {
        console.error('Error data payload:', errorObj.data);
      }
    }

    console.dir(err, { depth: null });
    return err instanceof Error
      ? `Error: ${err.message}`
      : 'Error creating equity';
  }
}

export async function createEcoMajesticEquity() {
  try {
    const regulationType = 1; // Reg S
    const regulationSubType = 0;
    const currencyHex = '0x' + Buffer.from('USD', 'ascii').toString('hex');

    const createReq = new CreateEquityRequest({
      name: 'ChargeFrog-EcoMajestic',
      symbol: 'CFEM',
      isin: 'MYQ0P6LO0QE8',
      decimals: 6,

      isWhiteList: false,
      isControllable: true,
      arePartitionsProtected: false,
      isMultiPartition: false,
      clearingActive: false,
      internalKycActivated: false,

      externalPausesIds: [],
      externalControlListsIds: [],
      externalKycListsIds: [],

      diamondOwnerAccount: import.meta.env.VITE_DIAMOND_OWNER_ACCOUNT_ID,

      votingRight: false,
      informationRight: true,
      liquidationRight: false,
      subscriptionRight: false,
      conversionRight: false,
      redemptionRight: false,
      putRight: false,
      dividendRight: 0,

      currency: currencyHex,
      numberOfShares: '1000',
      nominalValue: '1',

      regulationType,
      regulationSubType,
      isCountryControlListWhiteList: false,
      countries: '',

      info: 'ChargeFrog-EcoMajestic equity token for The ChargeFrog project — testnet',

      configId:
        '0x0000000000000000000000000000000000000000000000000000000000000001',
      configVersion: 0,

      complianceId: undefined,
      identityRegistryId: undefined,
      erc20VotesActivated: false,
    });

    const result = await sdk.createEquity(createReq);

    if (result && result.security) {
      console.log('🎉 Equity created successfully:', result.security);
      const roles = [
        SecurityRole._ISSUER_ROLE,
        SecurityRole._AGENT_ROLE,
        SecurityRole._CAP_ROLE,
      ];
      const admin_role_req = new ApplyRolesRequest({
        targetId: import.meta.env.VITE_DIAMOND_OWNER_ACCOUNT_ID,
        securityId: result.security.diamondAddress ?? '',
        roles,
        actives: [false, false, false],
      });

      const admin_req_res = await sdk.applyRoles(admin_role_req);
      if (admin_req_res) {
        console.log('✅ ApplyRolesRequest sent');
      }

      const grantRoleRes = [];
      for (const role of roles) {
        const grant_role_req = new RoleRequest({
          targetId: import.meta.env.VITE_DIAMOND_OWNER_ACCOUNT_ID,
          securityId: result.security.diamondAddress ?? '',
          role,
        });

        const res = await sdk.grantRole(grant_role_req);
        grantRoleRes.push(res);
        console.log(`✅ Granted role: ${role}`, res);
      }

      console.log('✅ Roles applied & granted');

      const max_supply = new SetMaxSupplyRequest({
        securityId: result.security.diamondAddress ?? '',
        maxSupply: '1000',
      });

      const max_res = await sdk.setMaxSupply(max_supply);

      console.log('Max supply set to Total Supply:', max_res);
      return JSON.stringify(result.security, null, 2);
    } else {
      console.warn('⚠️ Equity creation returned no result:', result);
      return result ? JSON.stringify(result, null, 2) : null;
    }
  } catch (err) {
    console.error('❌ Failed to create equity');

    if (err instanceof Error) {
      console.error('SDK Error Info:', {
        name: err.name,
        message: err.message,
      });
    }

    if (typeof err === 'object' && err !== null) {
      const errorObj = err as Record<string, unknown>;

      if ('reason' in errorObj || 'shortMessage' in errorObj) {
        console.error(
          'Contract/Transaction reason:',
          errorObj.reason || errorObj.shortMessage,
        );
      }

      if ('cause' in errorObj) {
        console.error('Nested cause:', errorObj.cause);
      }

      if ('data' in errorObj) {
        console.error('Error data payload:', errorObj.data);
      }
    }

    console.dir(err, { depth: null });
    return err instanceof Error
      ? `Error: ${err.message}`
      : 'Error creating equity';
  }
}
