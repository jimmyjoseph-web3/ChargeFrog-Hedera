import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import "@nomicfoundation/hardhat-ethers";
import { configVariable, defineConfig } from "hardhat/config";
import "dotenv/config";

export default defineConfig({
  // Register plugin explicitly to ensure test runner is detected
  plugins: [hardhatToolboxMochaEthersPlugin],
  paths: {
    // Compile Solidity sources from the scripts/ folder
    sources: "contracts",
  },
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    testnet: {
      type: "http",
      url: configVariable("HEDERA_RPC_URL"),
      accounts: [
        configVariable("HEDERA_PRIVATE_KEY"),
        configVariable("INVESTOR_PRIVATE_KEY"),
        configVariable("SPENDER_PRIVATE_KEY"),
      ],
    },
  },
});
