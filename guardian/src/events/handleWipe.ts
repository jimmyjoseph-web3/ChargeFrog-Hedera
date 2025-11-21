import { getAccessToken, loginAsAdmin } from "../services/authService";
import { getPolicies, wipeToken } from "../services/policyService";
import dotenv from "dotenv";
import axios from "axios";
dotenv.config({ path: ".env" });

// Mirror Node base (testnet)
const MIRROR_BASE = "https://testnet.mirrornode.hedera.com";

async function fetchAllNftsForToken(tokenId: string): Promise<any[]> {
  const out: any[] = [];
  let url = `${MIRROR_BASE}/api/v1/tokens/${tokenId}/nfts?limit=100`;

  // Dynamic import replaced with direct axios call
  while (url) {
    // 👈 CHANGE: Use axios instead of fetch
    const r = await axios.get(url);
    const j: any = r.data;

    if (Array.isArray(j.nfts)) out.push(...j.nfts);

    // Pagination
    url = j.links?.next ? `${MIRROR_BASE}${j.links.next}` : "";
  }

  return out;
}

function groupContiguous(serials: number[]): string[] {
  if (!serials.length) return [];
  serials.sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = serials[0];
  let prev = serials[0];

  for (let i = 1; i < serials.length; i++) {
    const cur = serials[i];
    if (cur === prev + 1) {
      prev = cur;
      continue;
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = cur;
    prev = cur;
  }

  ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
  return ranges;
}

export async function wipeCarbonFrog(wipePayload?: any) {
  const refreshToken = await loginAsAdmin();
  if (!refreshToken) throw new Error("No refresh token received from login");

  const accessToken = await getAccessToken(refreshToken);
  if (!accessToken)
    throw new Error("No access token received from getAccessToken");

  const policy = await getPolicies(accessToken);
  if (!policy) throw new Error("No policy received from getPolicies");

  // field1 provided
  const field1 = wipePayload?.document?.field1 ?? "";
  if (field1.trim()) {
    if (field1.includes("-")) {
      const [aStr, bStr] = field1.split("-");
      const start = Number(aStr.trim());
      const end = Number(bStr.trim());
      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        throw new Error("Invalid field1 range format. Use e.g. '4-8'.");
      }
      const results: any[] = [];
      for (let n = Math.min(start, end); n <= Math.max(start, end); n++) {
        const perPayload = { document: { field1: String(n) } };
        const res = await wipeToken(
          accessToken,
          process.env.wipeTokenRequestVCBlock_policyID || "",
          process.env.wipeTokenRequestVCBlock_blockUUID || "",
          perPayload
        );
        if (!res) throw new Error(`No block data received for field1=${n}`);
        results.push({ serial: n, result: res });
      }
      return {
        ok: true,
        mode: "provided_range",
        count: results.length,
        results,
      };
    } else {
      const singlePayload = { document: { field1 } };
      const blockData = await wipeToken(
        accessToken,
        process.env.wipeTokenRequestVCBlock_policyID || "",
        process.env.wipeTokenRequestVCBlock_blockUUID || "",
        singlePayload
      );
      if (!blockData)
        throw new Error("No block data received from Wiping Token");
      return { ok: true, mode: "provided_single", result: blockData };
    }
  }

  // Auto-discovery path (field1 empty)
  const tokenId = process.env.tokenId || "0.0.7264176";
  const targetAccount = process.env.OPERATOR_ID || "0.0.7257818";

  const allNfts = await fetchAllNftsForToken(tokenId);

  const owned = allNfts.filter(
    (nft) => nft.account_id === targetAccount && !nft.deleted
  );
  if (!owned.length)
    return {
      ok: true,
      mode: "auto",
      message: "No owned NFTs to wipe",
      ownedCount: 0,
    };

  const serials = owned
    .map((n) => Number(n.serial_number))
    .filter(Number.isFinite);
  const wipeResults: any[] = [];

  for (const s of serials) {
    const perPayload = { document: { field1: String(s) } };
    const res = await wipeToken(
      accessToken,
      process.env.wipeTokenRequestVCBlock_policyID || "",
      process.env.wipeTokenRequestVCBlock_blockUUID || "",
      perPayload
    );
    wipeResults.push(
      res ? { serial: s, result: res } : { serial: s, error: "wipe failed" }
    );
  }

  return {
    ok: true,
    // mode: "auto",
    // wipedCount: wipeResults.length,
    // results: wipeResults,
  };
}
