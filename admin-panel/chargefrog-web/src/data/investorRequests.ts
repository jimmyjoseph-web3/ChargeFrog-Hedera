/**
 * Resolves a Hedera account ID (0.0.x) from an EVM address using the Hedera mirror node REST API.
 * Returns the Hedera account ID string if found, otherwise returns the original address.
 */
async function resolveHederaId(evmAddress: string): Promise<string> {
  if (!evmAddress.startsWith('0x')) return evmAddress;
  try {
    const mirrorUrl = `https://testnet.mirrornode.hedera.com/api/v1/accounts/${evmAddress}`;
    const res = await fetch(mirrorUrl);
    if (!res.ok) return evmAddress;
    const data = await res.json();
    return data?.account ?? evmAddress;
  } catch {
    return evmAddress;
  }
}
// Fetch investor requests from the admin API and normalize into the
// same list shape that the UI expects.
// The URL can be configured via Vite env: VITE_FETCH_ALL_INVESTORS_URL
const API = import.meta.env.VITE_FETCH_ALL_INVESTORS_URL ?? '';

type RawInvestorRecord = {
  requestedShares?: number;
  hadClaimed?: boolean;
  isValidInvestor?: boolean;
  timestamp?: number;
};

export async function getInvestorRequests() {
  try {
    const res = await fetch(API, {
      headers: { 'Content-Type': 'application/json' },
    });
    const json = await res.json();
    // Log the raw API response before any mapping/normalization
    console.log('[Investors] Raw JSON response:', json);
    if (!json || !json.success) return [];

    // Support both legacy object-map shape and new array-based shape per wallet
    const investors: Record<string, unknown> = json.investors || {};

    const rows: Array<{
      id: number;
      walletAddr: string;
      stationId: number;
      station: string;
      shares: number;
      time: string;
    }> = [];

    let id = 1;
    for (const walletKey of Object.keys(investors)) {
      const walletEntry = investors[walletKey];
      // Prefer resolved Hedera ID for EVM addresses, else normalize underscores
      let walletAddr = walletKey;
      walletAddr = await resolveHederaId(walletAddr);

      if (Array.isArray(walletEntry)) {
        // New shape: array where index is stationId, and entries can be null or an object
        walletEntry.forEach((rec: unknown, idx: number) => {
          if (!rec) return;
          const record = rec as RawInvestorRecord;
          const shares = Number(record?.requestedShares);
          const ts = record?.timestamp
            ? new Date(record.timestamp)
            : new Date();
          const time = ts.toISOString().replace('T', ' ').slice(0, 19);
          const stationId = String(idx);
          const stationNames: Record<string, string> = {
            '1': 'Nottingham',
            '2': 'MajesticLabs',
            '3': 'Mount Austin',
            '4': 'EcoMajestic',
          };
          const stationLabel =
            stationNames[stationId] ?? `Station ${stationId}`;
          if (!Number.isFinite(shares) || shares <= 0) {
            console.log('[Investors] Skipping entry without positive shares', {
              wallet: walletKey,
              stationId,
              record,
            });
            return;
          }
          const station = `${stationId} - ${stationLabel}`;
          rows.push({
            id: id++,
            walletAddr,
            stationId: Number(stationId),
            station,
            shares,
            time,
          });
        });
      } else if (walletEntry && typeof walletEntry === 'object') {
        // Legacy shape: object keyed by stationId
        const walletObj = walletEntry as Record<
          string,
          RawInvestorRecord | undefined
        >;
        for (const stationId of Object.keys(walletObj)) {
          const rec = walletObj[stationId];
          if (!rec) continue;
          const shares = Number(rec?.requestedShares);
          if (!Number.isFinite(shares) || shares <= 0) {
            console.log('[Investors] Skipping entry without positive shares', {
              wallet: walletKey,
              stationId,
              rec,
            });
            continue;
          }
          const ts = rec?.timestamp ? new Date(rec.timestamp) : new Date();
          const time = ts.toISOString().replace('T', ' ').slice(0, 19);
          const stationNames: Record<string, string> = {
            '1': 'Nottingham',
            '2': 'MajesticLabs',
            '3': 'Mount Austin',
            '4': 'EcoMajestic',
          };
          const stationLabel =
            stationNames[stationId] ?? `Station ${stationId}`;
          const station = `${stationId} - ${stationLabel}`;
          rows.push({
            id: id++,
            walletAddr,
            stationId: Number(stationId),
            station,
            shares,
            time,
          });
        }
      } else {
        console.warn('[Investors] Unexpected wallet entry shape, skipping', {
          wallet: walletKey,
          entryType: typeof walletEntry,
        });
      }
    }

    return rows;
  } catch (err) {
    console.error('Failed to fetch investor requests', err);
    return [];
  }
}
