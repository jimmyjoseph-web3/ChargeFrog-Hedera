import { CreateEquityRequest } from '@hashgraph/asset-tokenization-sdk';
import { SDKService as sdk } from '../services/SDKService';

/**
 * Creates a new equity token.
 */
export async function createBoltEquity() {
  try {
    const regulationType = 1; // Reg S
    const regulationSubType = 0;
    const currencyHex = '0x' + Buffer.from('USD', 'ascii').toString('hex');

    const createReq = new CreateEquityRequest({
      name: 'BOLT',
      symbol: 'BLT',
      isin: 'MYQ2HHCMDLR9',
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

      diamondOwnerAccount: '0.0.7106098',

      votingRight: false,
      informationRight: true,
      liquidationRight: false,
      subscriptionRight: false,
      conversionRight: false,
      redemptionRight: false,
      putRight: false,
      dividendRight: 0,

      currency: currencyHex,
      numberOfShares: '100000000000',
      nominalValue: '1',

      regulationType,
      regulationSubType,
      isCountryControlListWhiteList: false,
      countries: '',

      info: 'BOLT equity token for ChargeFrog — testnet',

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
    } else {
      console.warn('⚠️ Equity creation returned no result:', result);
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
  }
}