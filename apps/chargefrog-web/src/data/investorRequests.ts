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
    if (!json || !json.success) return [];

    const investors: Record<
      string,
      Record<string, RawInvestorRecord>
    > = json.investors || {};
    const rows: Array<{
      id: number;
      walletAddr: string;
      station: string;
      shares: number;
      time: string;
    }> = [];

    let id = 1;
    for (const walletKey of Object.keys(investors)) {
      const walletObj = investors[walletKey] || {};
      // Convert underscore-style Hedera keys back to dotted form for display
      const walletAddr = walletKey.includes('_')
        ? walletKey.replace(/_/g, '.')
        : walletKey;

      for (const stationId of Object.keys(walletObj)) {
        const rec = walletObj[stationId] as RawInvestorRecord;
        const shares = rec?.requestedShares ?? 0;
        const ts = rec?.timestamp ? new Date(rec.timestamp) : new Date();
        const time = ts.toISOString().replace('T', ' ').slice(0, 19);
        const stationNames: Record<string, string> = {
          '1': 'Nottingham',
          '2': 'MajesticLabs',
          '3': 'Mount Austin',
          '4': 'EcoMajestic',
        };
        const stationLabel = stationNames[stationId] ?? `Station ${stationId}`;
        const station = `${stationId} - ${stationLabel}`;
        rows.push({ id: id++, walletAddr, station, shares, time });
      }
    }

    return rows;
  } catch (err) {
    console.error('Failed to fetch investor requests', err);
    return [];
  }
}
