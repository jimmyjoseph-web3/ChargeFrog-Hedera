import { useMutation } from '@tanstack/react-query';
import { SDKService } from '../../services/SDKService';
import type { WalletEvent } from '@hashgraph/asset-tokenization-sdk';
import {
  GetRolesForRequest,
  SupportedWallets,
} from '@hashgraph/asset-tokenization-sdk';
import { useWalletStore } from '../../stores/useWalletStores';
import { WalletStatus } from '../../utils/constants';
import { SDKService as sdk } from '../../services/SDKService';
import { SecurityRole } from '../../utils/SecurityRole';

export const useSDKInit = () =>
  useMutation({
    mutationFn: (walletEvents: Partial<WalletEvent>) =>
      SDKService.init(walletEvents),
    onSuccess: (data) => {
      console.log('✅ SDK initialized successfully:', data);
    },
    onError: (error) => {
      console.error('❌ SDK initialization failed:', error);
    },
  });

export const useSDKConnectToWallet = () => {
  const { setConnectionStatus, setAddress, reset, setIsAdmin } =
    useWalletStore();

  return useMutation({
    mutationFn: (wallet: SupportedWallets) => SDKService.connectWallet(wallet),
    onSuccess: async (data) => {
      setConnectionStatus(WalletStatus.connected);
      setAddress(data.account?.id?.toString() || '');

      const RolesReq = new GetRolesForRequest({
        securityId: import.meta.env.VITE_SECURITY_CONTRACT_ID ?? '',
        targetId: data.account?.id?.toString() || '',
        start: 0,
        end: 10,
      });

      const roles_res = await sdk.getRolesFor(RolesReq);

      const isAdmin =
        roles_res &&
        roles_res.some(
          (role: string) => role === SecurityRole._DEFAULT_ADMIN_ROLE,
        );

      setIsAdmin(Boolean(isAdmin));
    },
    onError: (error) => {
      console.error('❌ Error connecting to wallet:', error);
      reset();
    },
    onMutate: () => {
      setConnectionStatus(WalletStatus.connecting);
    },
  });
};

export const useSDKDisconnectFromMetamask = () => {
  const { reset } = useWalletStore();

  return useMutation({
    mutationFn: () => SDKService.disconnectWallet(),
    onSuccess: (data) => {
      console.log('🔌 Disconnected from wallet:', data);
      reset();
    },
    onError: (error) => {
      console.error('❌ Error disconnecting from wallet:', error);
      reset();
    },
  });
};
