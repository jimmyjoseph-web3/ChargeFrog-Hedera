import dotenv from "dotenv";
dotenv.config({ path: ".env" });

export const BASE_URL = process.env.URL || "";
// Function to get policy configuration by ID
async function getPolicies(accessToken: string, pageIndex = 0, pageSize = 2) {
  try {
    const url = new URL(`${BASE_URL}/policies`);
    url.searchParams.set("pageIndex", pageIndex.toString());
    url.searchParams.set("pageSize", pageSize.toString());

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    const contentType = response.headers.get("content-type");

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "❌ Failed to get policy config:",
        response.status,
        errorText
      );
      return;
    }

    if (!contentType || !contentType.includes("application/json")) {
      const rawText = await response.text();
      throw new Error(
        `Expected JSON but got: ${contentType}\nResponse:\n${rawText}`
      );
    }

    const totalCount = response.headers.get("x-total-count");
    const data = await response.json();

    console.log(`✅ Fetched ${data.length} policies (Total: ${totalCount})`);
    return { policies: data, totalCount: Number(totalCount) };
  } catch (err) {
    console.error("🚨 Error fetching policy config:", err);
  }
}

async function getBlock(
  accessToken: string,
  policyId: string,
  blockUUID: string
) {
  try {
    const url = new URL(`${BASE_URL}/policies/${policyId}/blocks/${blockUUID}`);
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "*/*",
      },
    });

    const contentType = response.headers.get("content-type");

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Failed to get block data:", response.status, errorText);
      return;
    }

    if (!contentType?.includes("application/json")) {
      const rawText = await response.text();
      throw new Error(
        `Expected JSON but got: ${contentType}\nResponse:\n${rawText}`
      );
    }

    const block = await response.json();
    console.log(`✅ Fetched block ${blockUUID} from policy ${policyId}`);
    return block;
  } catch (err) {
    console.error("🚨 Error fetching block data:", err);
  }
}

async function getBlockByPolicyId(accessToken: string, policyId: string) {
  try {
    const url = new URL(`${BASE_URL}/policies/${policyId}/blocks`);
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "*/*",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Failed to get block data:", response.status, errorText);
      return;
    }

    const contentType = response.headers.get("content-type");

    if (!contentType?.includes("application/json")) {
      const rawText = await response.text();
      throw new Error(
        `Expected JSON but got: ${contentType}\nResponse:\n${rawText}`
      );
    }

    const data = await response.json();
    console.log(`✅ Fetched ${data.length} blocks from policy ${policyId}`);
    return data;
  } catch (err) {
    console.error("🚨 Error fetching block data:", err);
  }
}

async function mintToken(
  accessToken: string,
  policyId: string,
  blockUUID: string,
  data: object
) {
  try {
    const url = new URL(`${BASE_URL}/policies/${policyId}/blocks/${blockUUID}`);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "*/*", // <- Required by the API
      },
      body: JSON.stringify(data),
    });

    const contentType = response.headers.get("content-type");

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "❌ Failed to send block data:",
        response.status,
        errorText
      );
      return;
    }

    if (!contentType?.includes("application/json")) {
      const rawText = await response.text();
      throw new Error(
        `Expected JSON but got: ${contentType}\nResponse:\n${rawText}`
      );
    }

    const result = await response.json();
    console.log(`✅ Successfully sent data to block ${blockUUID}`);
    return result;
  } catch (err) {
    console.error("🚨 Error sending block data:", err);
  }
}

async function wipeToken(
  accessToken: string,
  policyId: string,
  blockUUID: string,
  data: object
) {
  try {
    const url = new URL(`${BASE_URL}/policies/${policyId}/blocks/${blockUUID}`);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "*/*", // <- Required by the API
      },
      body: JSON.stringify(data),
    });

    const contentType = response.headers.get("content-type");

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "❌ Failed to send block data:",
        response.status,
        errorText
      );
      return;
    }

    if (!contentType?.includes("application/json")) {
      const rawText = await response.text();
      throw new Error(
        `Expected JSON but got: ${contentType}\nResponse:\n${rawText}`
      );
    }

    const result = await response.json();
    console.log(`✅ Successfully sent data to block ${blockUUID}`);
    return result;
  } catch (err) {
    console.error("🚨 Error sending block data:", err);
  }
}

async function associateTokenVCBlock(
  accessToken: string,
  policyId: string,
  blockUUID: string,
  data: object
) {
  try {
    const url = new URL(`${BASE_URL}/policies/${policyId}/blocks/${blockUUID}`);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "*/*", // <- Required by the API
      },
      body: JSON.stringify(data),
    });

    const contentType = response.headers.get("content-type");

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "❌ Failed to send block data:",
        response.status,
        errorText
      );
      return;
    }

    if (!contentType?.includes("application/json")) {
      const rawText = await response.text();
      throw new Error(
        `Expected JSON but got: ${contentType}\nResponse:\n${rawText}`
      );
    }

    const result = await response.json();
    console.log(`✅ Successfully sent data to block ${blockUUID}`);
    return result;
  } catch (err) {
    console.error("🚨 Error sending block data:", err);
  }
}

async function associateToken(
  accessToken: string,
  policyId: string,
  blockUUID: string
) {
  try {
    const url = new URL(`${BASE_URL}/policies/${policyId}/blocks/${blockUUID}`);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "confirm",
        hederaAccountKey: process.env.OPERATOR_KEY,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Failed to trigger block:", response.status, errorText);
      return;
    }

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      const rawText = await response.text();
      throw new Error(
        `Expected JSON but got: ${contentType}\nResponse:\n${rawText}`
      );
    }

    let result = await response.json();
    console.log("✅ Block triggered successfully:", result);
    return result;
  } catch (err) {
    console.error("🚨 Error triggering block:", err);
  }
}

export {
  getPolicies,
  getBlock,
  getBlockByPolicyId,
  mintToken,
  wipeToken,
  associateToken,
  associateTokenVCBlock,
};
