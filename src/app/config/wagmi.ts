import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { hederaTestnet } from "@wagmi/core/chains";

export const config = getDefaultConfig({
  appName: "ChargeFrog on Hedera",
  projectId: "",
  chains: [hederaTestnet],
  ssr: true,
});
