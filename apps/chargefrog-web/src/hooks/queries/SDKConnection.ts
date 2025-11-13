import { useMutation } from "@tanstack/react-query";
import { SDKService } from "../../services/SDKService";
import type { WalletEvent } from "@hashgraph/asset-tokenization-sdk";
import { SupportedWallets } from "@hashgraph/asset-tokenization-sdk";
import { useWalletStore } from "../../stores/useWalletStores";
import { WalletStatus } from "../../utils/constants";

export const useSDKInit = () =>
  useMutation({
    mutationFn: (walletEvents: Partial<WalletEvent>) =>
      SDKService.init(walletEvents),
    onSuccess: (data) => {
      console.log("✅ SDK initialized successfully:", data);
    },
    onError: (error) => {
      console.error("❌ SDK initialization failed:", error);
    },
  });

export const useSDKConnectToWallet = () => {
  const { setConnectionStatus, reset } = useWalletStore();


  return useMutation({
    mutationFn: (wallet: SupportedWallets) => SDKService.connectWallet(wallet),
    onSuccess: (data) => {
      console.log("✅ Connected to wallet:", data);

      setConnectionStatus(WalletStatus.connected);
    },
    onError: (error) => {
      console.error("❌ Error connecting to wallet:", error);
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
      console.log("🔌 Disconnected from wallet:", data);
      reset();
    },
    onError: (error) => {
      console.error("❌ Error disconnecting from wallet:", error);
      reset();
    },
  });
};