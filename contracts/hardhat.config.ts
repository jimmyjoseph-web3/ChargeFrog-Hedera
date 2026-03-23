import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable } from "hardhat/config";
import "dotenv/config";

export default {
  // Register plugin explicitly to ensure test runner is detected
  plugins: [hardhatToolboxMochaEthersPlugin],
  paths: {
    sources: "logic",
  },
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
    },
  },
  networks: {
    testnet: {
      type: "http",
      url: configVariable("HEDERA_RPC_URL"),
      accounts: [
        configVariable("CHARGEFROG_ADMIN_KEY"),
        configVariable("INVESTOR_PRIVATE_KEY"),
        configVariable("SPENDER_PRIVATE_KEY"),
      ],
    },
  },
};
