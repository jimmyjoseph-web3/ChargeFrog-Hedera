type Props = {
  visible: boolean;
  message?: string;
};

export default function FullScreenSpinner({ visible, message }: Props) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          padding: 24,
          borderRadius: 12,
          background: 'rgba(255,255,255,0.9)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          style={{ animation: 'spin 1s linear infinite' }}
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="#ccc"
            strokeWidth="4"
            fill="none"
          />
          <path
            d="M22 12a10 10 0 0 1-10 10"
            stroke="#2ecc71"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
        <div style={{ color: '#333', fontWeight: 600 }}>
          {message ?? 'Working...'}
        </div>
      </div>
      <style>
        {`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}
      </style>
    </div>
  );
}
