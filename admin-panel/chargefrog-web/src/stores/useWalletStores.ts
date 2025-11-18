import { create } from 'zustand';
import { WalletStatus } from '../utils/constants';
import type { InitializationData } from '@hashgraph/asset-tokenization-sdk';
import type { NetworkData } from '@hashgraph/asset-tokenization-sdk';

type WalletStoreStatus =
  | WalletStatus.disconnected
  | WalletStatus.connected
  | WalletStatus.connecting
  | WalletStatus.uninstalled;

interface WalletStore {
  address: string;
  isAdmin: boolean;
  setIsAdmin: (isAdmin: boolean) => void;
  setAddress: (address: string) => void;
  connectionStatus: WalletStoreStatus;
  setConnectionStatus: (status: WalletStoreStatus) => void;
  reset: () => void;
  data: InitializationData | null;
  network: NetworkData | null;
  setPairedWallet: (data: InitializationData, network: NetworkData) => void;
}

export const useWalletStore = create<WalletStore>((set) => ({
  address: '',
  isAdmin: false,
  setAddress: (address: string) =>
    set((state: WalletStore) => ({
      ...state,
      address,
      connectionStatus: WalletStatus.connected,
    })),
  setIsAdmin: (isAdmin: boolean) =>
    set((state: WalletStore) => ({ ...state, isAdmin })),
  connectionStatus: WalletStatus.disconnected,
  setConnectionStatus: (status: WalletStoreStatus) =>
    set((state: WalletStore) => ({ ...state, connectionStatus: status })),
  reset: () =>
    set((state: WalletStore) => ({
      ...state,
      address: '',
      isAdmin: false,
      data: null,
      network: null,
      connectionStatus: WalletStatus.disconnected,
    })),
  data: null,
  network: null,
  setPairedWallet: (data: InitializationData, network: NetworkData) =>
    set((state: WalletStore) => ({
      ...state,
      data,
      network,
      address: data.account?.id.value,
      connectionStatus: WalletStatus.connected,
    })),
}));