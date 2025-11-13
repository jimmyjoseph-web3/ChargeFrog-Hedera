import { useState } from 'react';
import './App.css';
import {
  SupportedWallets,
  IssueRequest,
  CreateEquityRequest,
  ApplyRolesRequest,
  GetRolesForRequest,
  RoleRequest,
  TransferRequest,
  GetAccountBalanceRequest,
} from '@hashgraph/asset-tokenization-sdk';

import { useWalletConnection } from './hooks/connectToMetaMask';
import { useWalletStore } from './stores/useWalletStores';
import { SDKService as sdk } from './services/SDKService';
import { useSDKInit } from './hooks/queries/SDKConnection';

import { SecurityRole } from './utils/SecurityRole';

function App() {
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState<string>('idle');

  const { mutate: init } = useSDKInit();
  const { handleConnectWallet } = useWalletConnection();
  const { connectionStatus, address } = useWalletStore();

  // Define wallet event callbacks (simplified)
  const walletEvents = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    walletFound: (event: any) => console.log('SDK → Wallet found', event),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    walletPaired: (event: any) => console.log('SDK → Wallet paired', event),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    walletConnectionStatusChanged: (event: any) =>
      console.log('SDK → Wallet status changed', event),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    walletDisconnect: (event: any) =>
      console.log('SDK → Wallet disconnected', event),
  };

  // Step 1: Initialise Network
  async function initNetwork() {
    try {

      setStatus('initializing...');
      // Actually call the mutation, passing event handlers
      await init(walletEvents);
      setStatus('initialized ✅');
    } catch (err) {
      console.error('❌ Network init failed:', err);
      setStatus('error: ' + String(err));
    }
  }

  // Step 2: Connect to MetaMask
  async function connectToMetamask() {
    try {
      await handleConnectWallet(SupportedWallets.METAMASK);
    } catch (err) {
      console.error('❌ Failed to connect to MetaMask:', err);


    }
  }

  // Step 5: Apply Roles: Admin needs additional ISSUER and AGENT role.
  async function applyRolesHandler() {
    try {
      const roles = [SecurityRole._ISSUER_ROLE, SecurityRole._AGENT_ROLE];
      const target = ''; // admin account
      const security = ''; // security contract

      // --- APPLY ROLES REQUEST (for regulated flow) ---
      const admin_role_req = new ApplyRolesRequest({
        targetId: target,
        securityId: security,
        roles: roles,
        actives: [true, true],
      });

      const admin_req_res = await sdk.applyRoles(admin_role_req);
      if (admin_req_res) {
        console.log('✅ ApplyRolesRequest sent');
      }

      // --- GRANT EACH ROLE INDIVIDUALLY ---
      for (const role of roles) {
        const grant_role_req = new RoleRequest({
          targetId: target,
          securityId: security,
          role: role,
        });

        const res = await sdk.grantRole(grant_role_req);
        console.log(`✅ Granted role: ${role}`, res);
      }

      console.log('✅✅ All roles granted and applied');
      return true;
    } catch (err) {
      console.error('❌ Failed to apply roles:', err);
      return false;
    }
  }

  // Step 4: Get Roles for the Diamond Contract
  async function getRoles() {
    const RolesReq = new GetRolesForRequest({
      securityId: '',
      targetId: '',
      start: 0,
      end: 10,
    });
    const roles_res = await sdk.getRolesFor(RolesReq);

    console.log(roles_res);
  }

  // Step 6: Mint your Equity
  async function mintAssetHandler() {
    try {
      const RolesReq = new GetRolesForRequest({
        securityId: '',
        targetId: '',
        start: 0,
        end: 10,
      });
      const roles_res = await sdk.getRolesFor(RolesReq);

      console.log('Here are the roles for your admin:', roles_res);

      // Mint asset
      const req = new IssueRequest({
        securityId: '', // asset contract
        targetId: '', // admin needs to mint first
        amount: '',
      });

      console.log('🚀 Minting asset:', req);

      const result = await sdk.mint(req);

      if (result) {
        console.log('Mint successful, Here is the transaction:', result);
      }
    } catch (err) {
      console.error('❌ Mint failed:', err);
    }
  }

  // Step 3: Create an Equity
  async function createBoltEquity() {
    try {
      const regulationType = 1; // Reg S
      const regulationSubType = 0;
      const currencyHex = '0x' + Buffer.from('USD', 'ascii').toString('hex');

      const createReq = new CreateEquityRequest({
        name: '',
        symbol: '',
        isin: '',
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

        diamondOwnerAccount: '',

        votingRight: false,
        informationRight: true,
        liquidationRight: false,
        subscriptionRight: false,
        conversionRight: false,
        redemptionRight: false,
        putRight: false,
        dividendRight: 0,

        currency: currencyHex,
        numberOfShares: '',
        nominalValue: '',

        regulationType,
        regulationSubType,
        isCountryControlListWhiteList: false,
        countries: '',

        info: '',

        configId:
          '',
        configVersion: 0,

        complianceId: undefined,
        identityRegistryId: undefined,
        erc20VotesActivated: false,
      });
      // console.log(createReq);
      const result = await sdk.createEquity(createReq);

      if (result && result.security) {
        console.log('🎉 Equity created successfully:', result.security);
      } else {
        console.warn('⚠️ Equity creation returned no result:', result);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error('❌ Failed to create equity');

      // 1️⃣ — Try SDK-style structured errors
      if (err.name || err.errorCode || err.errorCategory) {
        console.error('SDK Error Info:', {
          name: err.name,
          message: err.message,
          code: err.errorCode,
          category: err.errorCategory,
        });
      }

      // 2️⃣ — Try to catch known internal causes
      if (err.reason || err.shortMessage) {
        console.error(
          'Contract/Transaction reason:',
          err.reason || err.shortMessage,
        );
      }

      // 3️⃣ — Check for inner error objects (like Viem or Hedera)
      if (err.cause) {
        console.error('Nested cause:', err.cause);
      }

      // 4️⃣ — Show any data payload (viem, ethers-style)
      if (err.data) {
        console.error('Error data payload:', err.data);
      }

      // 5️⃣ — Full object for debugging
      console.dir(err, { depth: null });
    }
  }

  async function transferEquity() {
    const trans_req = new TransferRequest({
      targetId: '',
      amount: '',
      securityId: '',
    });

    const res = await sdk.transfer(trans_req);

    if (res) {
      console.log('Transfer completed, Here is your transaction hash!', res);


    }
  }

  async function getBalanceOf() {
    const balance_req = new GetAccountBalanceRequest({
      securityId: '',
      targetId: '',
    });

    const balance_res = await sdk.getBalanceOf(balance_req); // Balance of tokenized asset

    if (balance_res) {
      console.log('The balance is:', balance_res);
    }
  }

  return (
    <>
      <h1>ChargeFrog Hedera Experimentation</h1>

      <div className="card">
        <button onClick={() => setCount((c) => c + 1)}>count is {count}</button>

        <button onClick={initNetwork} style={{ marginLeft: 12 }}>
          Init Network
        </button>

        <button onClick={connectToMetamask} style={{ marginLeft: 12 }}>
          Connect MetaMask
        </button>

        <button onClick={mintAssetHandler} style={{ marginLeft: 12 }}>
          Mint
        </button>

        <button onClick={applyRolesHandler} style={{ marginLeft: 12 }}>
          Apply Roles to Admin and Minter
        </button>

        <button onClick={createBoltEquity} style={{ marginLeft: 12 }}>
          Create BOLT Equity
        </button>

        <button onClick={getRoles} style={{ marginLeft: 12 }}>
          Get Roles
        </button>

        <button onClick={transferEquity} style={{ marginLeft: 12 }}>
          Transfer
        </button>

        <button onClick={getBalanceOf} style={{ marginLeft: 12 }}>
          Get Balance
        </button>
        <p>
          Status: <code>{status}</code>
        </p>
        <p>
          Wallet status: <code>{connectionStatus}</code>
        </p>
        {address && (
          <p>
            Connected as: <code>{address}</code>
          </p>
        )}
      </div>
    </>
  );
}

export default App;