interface EthereumProvider {
  isMetaMask?: boolean;
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on?: (event: string, handler: (...args: any[]) => void) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
}

interface Window {
  ethereum?: EthereumProvider;
}

// Vite environment variables available on the client
declare interface ImportMetaEnv {
  readonly VITE_FETCH_ALL_INVESTORS_URL?: string;
  readonly VITE_SECURITY_CONTRACT_ID?: string;
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
