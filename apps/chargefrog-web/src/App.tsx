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
import investorRequests from './data/investorRequests';
import { useDropdownSection, useDropdownRow } from './components/dropdown';
import StatusCard from './components/StatusCard';
import { getRoles } from './adapters/getRoles';
import { mintAssetHandler } from './adapters/mintAssetHandler';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { getBalanceOf } from './adapters/getBalanceOf';
import { useState } from 'react';

function App() {
  const [status, setStatus] = useState<string>('idle');
  const [balance, setBalance] = useState<string | null>(null); // State to store balance
  const [mintResults, setMintResults] = useState<string | null>(null); // State to store mint results
  const [roles, setRoles] = useState<string | null>(null); // State to store roles
  const [headerLoading, setHeaderLoading] = useState<boolean>(false); // Loading state for header button
  const { openSection, toggleSection } = useDropdownSection();
  const { expandedRows, toggleRow } = useDropdownRow(() => {
    setBalance(null); // Clear balance when toggling rows
    setMintResults(null); // Clear mint results when toggling rows
    setRoles(null); // Clear roles when toggling rows
  });

  const { mutate: init } = useSDKInit();
  const { handleConnectWallet } = useWalletConnection();
  const { connectionStatus, address, isAdmin } = useWalletStore();
  const isConnected = Boolean(address);
  const disconnectMutation = useSDKDisconnectFromMetamask();

  // Define wallet event callbacks (simplified)
  const walletEvents = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    walletFound: (event: any) => console.log('SDK → Wallet found', event),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    walletPaired: (event: any) => console.log('SDK → Wallet paired', event),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    walletConnectionStatusChanged: (event: any) =>
      console.log('SDK → Wallet status changed', event),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    walletDisconnect: (event: any) =>
      console.log('SDK → Wallet disconnected', event),
  };

  // Step 1: Initialise and Connect to MetaMask
  async function connectToMetamask() {
    try {
      setHeaderLoading(true);
      setStatus('initializing...');
      // Actually call the mutation, passing event handlers
      await init(walletEvents);
      setStatus('initialized');
    } catch (err) {
      console.error('❌ Network init failed:', err);
      setStatus('error: ' + String(err));
    }

    try {
      await handleConnectWallet(SupportedWallets.METAMASK);
    } catch (err) {
      console.error('❌ Failed to connect to MetaMask:', err);
    } finally {
      setHeaderLoading(false);
    }
  }

  // Disconnect handler: resets wallet store and clears UI state
  function handleDisconnect() {
    setHeaderLoading(true);
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
      .finally(() => setHeaderLoading(false));
  }

  const handleGetBalance = async () => {
    const balance_res = await getBalanceOf();
    console.log('Balance response:', balance_res); // Debugging log
    if (balance_res && typeof balance_res === 'string') {
      setBalance(balance_res); // Update state with balance
    }
  };

  const handleMintAsset = async () => {
    const mint_res = await mintAssetHandler();
    if (mint_res && typeof mint_res === 'string') {
      setMintResults(mint_res); // Update state with mint results
    }
  };

  const handleGetRoles = async () => {
    const roles_res = await getRoles();
    if (roles_res && typeof roles_res === 'string') {
      setRoles(roles_res); // Update state with roles
    }
  }; 

  return (
    <div style={styles.container}>
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
            onMouseEnter={(e) => {
              if (headerLoading) return;
              e.currentTarget.style.backgroundColor = isConnected
                ? '#e74c3c'
                : '#2ecc71';
            }}
            onMouseLeave={(e) => {
              if (headerLoading) return;
              e.currentTarget.style.backgroundColor = '';
            }}
          >
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
                        <td>{row.wallet}</td>
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
                                  <p>{mintResults}</p>
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
                                  <p>{roles}</p>
                                </div>
                              )}
                              <div style={styles.detailActions}>
                                <button
                                  className="app-button"
                                  style={styles.primaryBtn}
                                  onClick={handleMintAsset}
                                >
                                  Approve Mint and Transfer Tokens
                                </button>
                                <button
                                  className="app-button"
                                  style={styles.secondaryBtn}
                                  onClick={handleGetRoles}
                                >
                                  Get Roles
                                </button>
                                <button
                                  className="app-button"
                                  style={styles.secondaryBtn}
                                  onClick={handleGetBalance}
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