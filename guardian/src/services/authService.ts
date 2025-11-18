import axios from "axios";
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

export const BASE_URL = process.env.URL || "";

export async function loginAsAdmin() {
  try {
    const response = await axios.post(`${BASE_URL}/accounts/login`, {
      username: process.env.ADMIN_USERNAME,
      password: process.env.ADMIN_PASSWORD,
    });
    return response.data.refreshToken;
  } catch (error) {
    console.error("Error logging in as admin:", error);
    throw new Error("Failed to log in as admin");
  }
}

export async function loginAsTreasury() {
  try {
    const response = await axios.post(`${BASE_URL}/accounts/login`, {
      username: process.env.TREASURY_USERNAME,
      password: process.env.TREASURY_PASSWORD,
    });
    return response.data.refreshToken;
  } catch (error) {
    console.error("Error logging in as treasury:", error);
    throw new Error("Failed to log in as treasury");
  }
}

export async function getAccessToken(refreshToken: any) {
  try {
    const response = await axios.post(`${BASE_URL}/accounts/access-token`, {
      refreshToken,
    });
    return response.data.accessToken;
  } catch (error) {
    console.error("Error getting access token:", error);
    throw new Error("Failed to get access token");
  }
}

export async function getAccountSession(accessToken: any) {
  try {
    const response = await axios.get(`${BASE_URL}/accounts/session`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error getting account session:", error);
    throw new Error("Failed to get account session");
  }
}
