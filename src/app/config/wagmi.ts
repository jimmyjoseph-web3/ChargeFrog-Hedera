import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { hederaTestnet } from "@wagmi/core/chains";

export const config = getDefaultConfig({
  appName: "ChargeFrog on Hedera",
  projectId: "0d96c994eeaf761d2d2ac3a07192d980",
  chains: [hederaTestnet],
  ssr: true,
});
