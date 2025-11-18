import React from 'react';
import styles from '../styles';

interface StatusCardProps {
  status: string;
  connectionStatus: string;
  address?: string;
}

const StatusCard: React.FC<StatusCardProps> = ({
  status,
  connectionStatus,
  address,
}) => {
  return (
    <div style={styles.statusBox}>
      <p>
        Status: <code>{status}</code>
      </p>
      <p>
        Wallet status: <code>{connectionStatus}</code>
      </p>
      {address && (
        <p>
          Connected as: <code>{address}</code>
        </p>
      )}
    </div>
  );
};

export default StatusCard;