import { getAccessToken, loginAsTreasury } from "../services/authService";
import { getPolicies, mintToken } from "../services/policyService";
import dotenv from "dotenv"; 
dotenv.config({ path: ".env" });

export async function mintCarbonFrog(mintPayload?: any) {
  const refreshToken = await loginAsTreasury();

  if (!refreshToken) {
    throw new Error("No refresh token received from login");
  }

  const accessToken = await getAccessToken(refreshToken);

  if (!accessToken) {
    throw new Error("No access token received from getAccessToken");
  }

  const policy = await getPolicies(accessToken);

  if (!policy) {
    throw new Error("No policy received from getPolicies");
  }

  const blockData = await mintToken(
    accessToken,
    process.env.mintTokenRequestVCBlock_policyID || "",
    process.env.mintTokenRequestVCBlock_blockUUID || "",
    mintPayload || {}
  );

  console.log(blockData);

  if (!blockData) {
    throw new Error("No block data received from mintToken");
  }
}
