import { loginAsAdmin, getAccessToken } from "../services/authService";
import {
  associateToken,
  getPolicies,
  associateTokenVCBlock,
} from "../services/policyService";

import { Client, PrivateKey, TokenInfoQuery } from "@hashgraph/sdk";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

// Validate environment variables
if (!process.env.OPERATOR_ID || !process.env.OPERATOR_KEY) {
  throw new Error(
    "OPERATOR_ID and OPERATOR_KEY environment variables are required"
  );
}

// Initialize the Hedera client
let client: Client;
try {
  client = Client.forTestnet().setOperator(
    process.env.OPERATOR_ID || "",
    PrivateKey.fromBytesED25519(
      Buffer.from(process.env.OPERATOR_KEY || "", "hex")
    )
  );
} catch (error) {
  console.error("Error initializing Hedera client:", error);
  throw new Error(
    "Failed to initialize Hedera client. Please check your OPERATOR_ID and OPERATOR_KEY."
  );
}

// Function to check if a token is associated with an account
export async function isTokenAssociatedWithAccount(
  tokenId: any,
  accountId: any
) {
  try {
    const tokenInfo = await new TokenInfoQuery()
      .setTokenId(tokenId)
      .execute(client);

    return tokenInfo?.treasuryAccountId?.toString() === accountId.toString();
  } catch (error) {
    console.error("Error checking token association:", error);
    return false;
  }
}

export async function associateTokenToNewHederaAccount() {
  //Get a refresh token from login
  const refreshToken = await loginAsAdmin();

  if (!refreshToken) {
    throw new Error("No refresh token received from login");
  }

  //Get an access token from the refresh token
  const accessToken = await getAccessToken(refreshToken);

  if (!accessToken) {
    throw new Error("No access token received from getAccessToken");
  }

  //Get the policy
  const policy = await getPolicies(accessToken);

  if (!policy) {
    throw new Error("No policy received from getPolicies");
  }

  const payload = { document: { field0: process.env.OPERATOR_ID || "" } };

  // This is extremely important, it ensures that there is VC document for the token association process, if not, the token association will fail
  const VCblockData = await associateTokenVCBlock(
    accessToken,
    process.env.associateTokenRequestVCBlock_policyId || "",
    process.env.associateTokenRequestVCBlock_blockUUID || "",
    payload
  );

  if (!VCblockData) {
    throw new Error("No block data received from associateTokenVCBlock");
  }

  // Associate Token to Account if not done yet
  const associateTokenToNewHederaAccount = await associateToken(
    accessToken,
    process.env.associateTokenRequest_policyId || "",
    process.env.associateTokenRequest_blockUUID || ""
  );
}
