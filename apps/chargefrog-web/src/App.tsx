import { useState, useEffect } from 'react';
import './App.css';
import frogImg from '../assets/froggers.png';
import deniedImg from '../assets/admin-froggers.png';

import { SupportedWallets } from '@hashgraph/asset-tokenization-sdk';

import { useWalletConnection } from './hooks/connectToMetaMask';
import { useWalletStore } from './stores/useWalletStores';
import {
  useSDKInit,
  useSDKDisconnectFromMetamask,
} from './hooks/queries/SDKConnection';

import styles from './styles';
import { getInvestorRequests } from './data/investorRequests';
import { useDropdownSection, useDropdownRow } from './components/dropdown';
import StatusCard from './components/StatusCard';
import FullScreenSpinner from './components/FullScreenSpinner';
import { getRoles } from './adapters/getRoles';
import { mintAssetHandler } from './adapters/mintAssetHandler';
import { getBalanceOf } from './adapters/getBalanceOf';
import {
  createNottinghamEquity,
  createMajesticLabsEquity,
  createMountAustinEquity,
  createEcoMajesticEquity,
} from './adapters/createEquity.ts';

type InvestorRow = {
  id: number;
  walletAddr: string;
  stationId: number;
  station: string;
  shares: number;
  time: string;
};

function App() {
  const [status, setStatus] = useState<string>('idle');
  const [balance, setBalance] = useState<string | null>(null); // State to store balance
  const [mintResults, setMintResults] = useState<string | null>(null); // State to store mint results
  const [roles, setRoles] = useState<string | null>(null); // State to store roles
  const [headerLoading, setHeaderLoading] = useState<boolean>(false); // Loading state for header button
  const [investorRequests, setInvestorRequests] = useState<InvestorRow[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0); // Global pending counter for overlay
  const [pendingMessages, setPendingMessages] = useState<string[]>([]);
  const [equityResult, setEquityResult] = useState<string | null>(null);
  const beginPending = (message?: string) => {
    setPendingCount((c) => c + 1);
    if (message) setPendingMessages((arr) => [...arr, message]);
  };
  const endPending = () => {
    setPendingCount((c) => Math.max(0, c - 1));
    setPendingMessages((arr) => (arr.length ? arr.slice(0, -1) : arr));
  };
  const updateTopPendingMessage = (message: string) => {
    setPendingMessages((arr) => {
      if (arr.length === 0) return [message];
      const copy = arr.slice();
      copy[copy.length - 1] = message;
      return copy;
    });
  };
  const overlayVisible = pendingCount > 0;
  const { openSection, toggleSection } = useDropdownSection();
  const { expandedRows, toggleRow } = useDropdownRow(() => {
    setBalance(null); // Clear balance when toggling rows
    setMintResults(null); // Clear mint results when toggling rows
    setRoles(null); // Clear roles when toggling rows
  });
  // Separate dropdown state for Equity rows
  const { expandedRows: equityExpandedRows, toggleRow: toggleEquityRow } =
    useDropdownRow(() => {
      setEquityResult(null);
    });

  const { mutate: init } = useSDKInit();
  const { handleConnectWallet } = useWalletConnection();
  const { connectionStatus, address, isAdmin } = useWalletStore();
  const isConnected = Boolean(address);
  const currentPendingMessage =
    pendingMessages[pendingMessages.length - 1] ||
    (headerLoading
      ? isConnected
        ? 'Disconnecting...'
        : 'Connecting...'
      : 'Processing...');
  const disconnectMutation = useSDKDisconnectFromMetamask();

  // Fallback resolver in case some rows are missing stationId
  const resolveStationId = (row: InvestorRow): number => {
    if (Number.isFinite(row.stationId)) return row.stationId;
    const parsed = parseInt((row.station || '').split(' - ')[0], 10);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  // Load investor requests from API on mount
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      beginPending('Loading investor requests...');
      try {
        const rows = await getInvestorRequests();
        if (mounted) setInvestorRequests(rows);
      } catch (err) {
        console.error('Failed to load investor requests', err);
      } finally {
        endPending();
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  // Define wallet event callbacks (simplified)
  const walletEvents = {
    walletFound: () => {
      updateTopPendingMessage('Wallet found');
    },

    walletPaired: () => {
      updateTopPendingMessage('Wallet paired');
    },

    walletConnectionStatusChanged: () => {
      updateTopPendingMessage('Wallet status changed');
    },

    walletDisconnect: () => {
      updateTopPendingMessage('Wallet disconnected');
    },
  };

  // Step 1: Initialise and Connect to MetaMask
  async function connectToMetamask() {
    try {
      setHeaderLoading(true);
      beginPending('Initializing network...');
      setStatus('initializing...');
      // Actually call the mutation, passing event handlers
      await init(walletEvents);
      setStatus('initialized');
      updateTopPendingMessage('Connecting to MetaMask...');
    } catch (err) {
      console.error('❌ Network init failed:', err);
      setStatus('error: ' + String(err));
      updateTopPendingMessage('Initialization failed');
    }
    try {
      await handleConnectWallet(SupportedWallets.METAMASK);
    } catch (err) {
      console.error('❌ Failed to connect to MetaMask:', err);
      updateTopPendingMessage('Wallet connection failed');
    } finally {
      setHeaderLoading(false);
      endPending();
    }
  }

  // Disconnect handler: resets wallet store and clears UI state
  function handleDisconnect() {
    setHeaderLoading(true);
    beginPending('Disconnecting...');
    disconnectMutation
      .mutateAsync()
      .then(() => {
        // Clear local UI state (store reset is handled by the disconnect mutation)
        setRoles(null);
        setBalance(null);
        setMintResults(null);
        console.log('🔌 Disconnected and cleared state');
      })
      .catch((err) => {
        console.error('❌ Failed to disconnect:', err);
      })
      .finally(() => {
        setHeaderLoading(false);
        endPending();
      });
  }

  const handleGetBalance = async (wallet: string, stationId: number) => {
    beginPending(`Fetching balance for ${wallet} (station ${stationId})...`);
    try {
      const balance_res = await getBalanceOf(wallet, stationId);
      if (balance_res && typeof balance_res === 'string') {
        setBalance(balance_res); // Update state with balance
      }
    } finally {
      endPending();
    }
  };

  const handleMintAsset = async (
    wallet: string,
    shares: number,
    stationId: number,
  ) => {
    beginPending(`Minting for ${wallet} (station ${stationId})...`);
    try {
      const mint_res = await mintAssetHandler(wallet, stationId, {
        onProgress: (msg) => updateTopPendingMessage(msg),
        transferAmount: shares,
        receiverId: wallet,
      });
      if (mint_res && typeof mint_res === 'string') {
        // Format so that each comma is followed by a newline for readability
        setMintResults(mint_res.replace(/,/g, ',\n'));
      }
    } finally {
      endPending();
    }
  };

  const handleGetRoles = async (wallet: string, stationId: number) => {
    beginPending(`Fetching roles for ${wallet} (station ${stationId})...`);
    try {
      const roles_res = await getRoles(wallet, stationId);
      if (roles_res && typeof roles_res === 'string') {
        // Insert a newline after every comma for readability
        setRoles(roles_res.replace(/,/g, ',\n')); // Update state with roles
      }
    } finally {
      endPending();
    }
  };

  // Config for equity creation rows
  const equityRows: Array<{
    id: number;
    label: string;
    description: string;
    onClick: () => Promise<string | null>;
  }> = [
    {
      id: 1001,
      label: 'Nottingham',
      description: 'ChargeFrog-Notts equity token for Nottingham station',
      onClick: createNottinghamEquity,
    },
    {
      id: 1002,
      label: 'MajesticLabs',
      description:
        'ChargeFrog-MajesticLabs equity token for MajesticLabs station',
      onClick: createMajesticLabsEquity,
    },
    {
      id: 1003,
      label: 'Mount Austin',
      description:
        'ChargeFrog-MountAustin equity token for Mount Austin station',
      onClick: createMountAustinEquity,
    },
    {
      id: 1004,
      label: 'EcoMajestic',
      description:
        'ChargeFrog-EcoMajestic equity token for EcoMajestic station',
      onClick: createEcoMajesticEquity,
    },
  ];

  const handleCreateEquity = async (row: {
    id: number;
    label: string;
    description: string;
    onClick: () => Promise<string | null>;
  }) => {
    beginPending(`Creating ${row.label} equity...`);
    try {
      const res = await row.onClick();
      if (typeof res === 'string') {
        setEquityResult(res);
      } else {
        setEquityResult('No result returned.');
      }
    } finally {
      endPending();
    }
  };

  return (
    <div style={styles.container}>
      <FullScreenSpinner
        visible={overlayVisible}
        message={currentPendingMessage}
      />
      <div
        style={{
          background: '#fff',
          padding: '10px 20px',
          borderBottom: '1px solid #ddd',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h1 style={styles.title}>
            ChargeFrog Asset Tokenization Admin Panel
          </h1>
          <button
            onClick={isConnected ? handleDisconnect : connectToMetamask}
            className="connect-button"
            disabled={headerLoading}
            style={{
              opacity: headerLoading ? 0.7 : 1,
              cursor: headerLoading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s ease',
            }}
            aria-busy={headerLoading}
          >
            {headerLoading && (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                style={{ marginRight: 8, verticalAlign: 'text-bottom' }}
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  opacity="0.25"
                />
                <path
                  d="M22 12a10 10 0 0 1-10 10"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                />
                <animateTransform
                  attributeName="transform"
                  attributeType="XML"
                  type="rotate"
                  from="0 12 12"
                  to="360 12 12"
                  dur="1s"
                  repeatCount="indefinite"
                />
              </svg>
            )}
            {headerLoading
              ? isConnected
                ? 'Disconnecting...'
                : 'Connecting...'
              : isConnected
                ? 'Disconnect'
                : 'Connect MetaMask'}
          </button>
        </div>
      </div>

      <div style={styles.content}>
        {/* LEFT SIDE — Control Panel */}
        <div style={styles.leftPane}>
          <div style={styles.listContainer}>
            <div className="section">
              <div
                className="section-header"
                onClick={() => toggleSection('admin')}
              >
                <span
                  className={`arrow ${openSection === 'admin' ? 'open' : ''}`}
                >
                  &gt;
                </span>
                <span>Investor</span>
              </div>
              {openSection === 'admin' && (
                <div className="section-body">
                  <div
                    onClick={() => toggleSection('')}
                    style={{
                      cursor: 'pointer',
                      padding: '10px 15px',
                      borderRadius: '5px',
                      backgroundColor: '#f0f0f0',
                      color: '#333',
                      fontWeight: 'bold',
                      display: 'inline-block',
                      transition: 'background-color 0.3s ease',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = '#e0e0e0')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = '#f0f0f0')
                    }
                  >
                    Requests
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT SIDE — Investor Table (admin only) */}
        {isAdmin ? (
          <div style={{ display: 'flex', flexDirection: 'row', gap: '20px' }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ marginBottom: 12 }}>Investor Requests</h2>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ width: 120 }}>Actions</th>
                    <th>Wallet Address</th>
                    <th>Station Id - Station Name</th>
                    <th>Requested Shares</th>
                    <th>Time Requested</th>
                  </tr>
                </thead>
                <tbody>
                  {investorRequests.map((row) => (
                    <>
                      <tr key={row.id}>
                        <td style={styles.actionsCell}>
                          <button
                            onClick={() => toggleRow(row.id)}
                            style={styles.dropdownButton}
                          >
                            <span
                              style={{
                                display: 'inline-block',
                                transform: expandedRows[row.id]
                                  ? 'rotate(90deg)'
                                  : 'rotate(0deg)',
                                transition: 'transform 0.15s ease',
                                marginRight: 8,
                              }}
                            >
                              ▶
                            </span>
                            {expandedRows[row.id] ? 'Hide' : 'Details'}
                          </button>
                        </td>
                        <td>{row.walletAddr}</td>
                        <td>{row.station}</td>
                        <td>{row.shares}</td>
                        <td>{row.time}</td>
                      </tr>
                      {expandedRows[row.id] && (
                        <tr key={`${row.id}-details`}>
                          <td colSpan={5} style={{ padding: 0 }}>
                            <div style={styles.detailCard}>
                              {balance && (
                                <div
                                  style={{
                                    border: '1px solid #ddd',
                                    padding: '10px',
                                    marginBottom: '10px',
                                    borderRadius: '5px',
                                    backgroundColor: '#f9f9f9',
                                  }}
                                >
                                  <h3>Balance</h3>
                                  <p>{balance}</p>
                                </div>
                              )}
                              {mintResults && (
                                <div
                                  style={{
                                    border: '1px solid #ddd',
                                    padding: '10px',
                                    marginBottom: '10px',
                                    borderRadius: '5px',
                                    backgroundColor: '#f9f9f9',
                                  }}
                                >
                                  <h3>Mint Results</h3>
                                  <pre
                                    style={{
                                      whiteSpace: 'pre-wrap',
                                      margin: 0,
                                    }}
                                  >
                                    {mintResults}
                                  </pre>
                                </div>
                              )}
                              {roles && (
                                <div
                                  style={{
                                    border: '1px solid #ddd',
                                    padding: '10px',
                                    marginBottom: '10px',
                                    borderRadius: '5px',
                                    backgroundColor: '#f9f9f9',
                                  }}
                                >
                                  <h3>Roles</h3>
                                  <pre
                                    style={{
                                      whiteSpace: 'pre-wrap',
                                      margin: 0,
                                    }}
                                  >
                                    {roles}
                                  </pre>
                                </div>
                              )}
                              <div style={styles.detailActions}>
                                <button
                                  className="app-button"
                                  style={styles.primaryBtn}
                                  onClick={() =>
                                    handleMintAsset(
                                      row.walletAddr,
                                      row.shares,
                                      resolveStationId(row),
                                    )
                                  }
                                >
                                  Approve Mint and Transfer Tokens
                                </button>
                                <button
                                  className="app-button"
                                  style={styles.secondaryBtn}
                                  onClick={() =>
                                    handleGetRoles(
                                      row.walletAddr,
                                      resolveStationId(row),
                                    )
                                  }
                                >
                                  Get Roles
                                </button>
                                <button
                                  className="app-button"
                                  style={styles.secondaryBtn}
                                  onClick={() =>
                                    handleGetBalance(
                                      row.walletAddr,
                                      resolveStationId(row),
                                    )
                                  }
                                >
                                  Get Balance
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
              {/* Equity Creation — Dropdown Table */}
              <div style={{ marginTop: 40 }}>
                <h2 style={{ marginBottom: 12 }}>Create Equity Tokens</h2>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ width: 120 }}>Actions</th>
                      <th>Station Name</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equityRows.map((row) => (
                      <>
                        <tr key={row.id}>
                          <td style={styles.actionsCell}>
                            <button
                              onClick={() => toggleEquityRow(row.id)}
                              style={styles.dropdownButton}
                            >
                              <span
                                style={{
                                  display: 'inline-block',
                                  transform: equityExpandedRows[row.id]
                                    ? 'rotate(90deg)'
                                    : 'rotate(0deg)',
                                  transition: 'transform 0.15s ease',
                                  marginRight: 8,
                                }}
                              >
                                ▶
                              </span>
                              {equityExpandedRows[row.id] ? 'Hide' : 'Details'}
                            </button>
                          </td>
                          <td>{row.label}</td>
                          <td>{row.description}</td>
                        </tr>
                        {equityExpandedRows[row.id] && (
                          <tr key={`${row.id}-details`}>
                            <td colSpan={3} style={{ padding: 0 }}>
                              <div style={styles.detailCard}>
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 12,
                                  }}
                                >
                                  {equityResult && (
                                    <div
                                      style={{
                                        border: '1px solid #ddd',
                                        padding: '10px',
                                        borderRadius: '5px',
                                        backgroundColor: '#f9f9f9',
                                      }}
                                    >
                                      <h3 style={{ marginTop: 0 }}>Result</h3>
                                      <pre
                                        style={{
                                          whiteSpace: 'pre-wrap',
                                          margin: 0,
                                        }}
                                      >
                                        {equityResult}
                                      </pre>
                                    </div>
                                  )}
                                  <button
                                    className="app-button"
                                    style={styles.secondaryBtn}
                                    onClick={() => handleCreateEquity(row)}
                                  >
                                    Create {row.label} Equity
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div
              style={{
                width: '260px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              <img src={frogImg} alt="ChargeFrog" style={styles.image} />
              <StatusCard
                status={status}
                connectionStatus={connectionStatus}
                address={address}
              />
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '40px',
            }}
          >
            <img
              src={deniedImg}
              alt="Access Denied"
              style={{ maxWidth: '1080px', width: '100%', opacity: 0.9 }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
