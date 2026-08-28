import { YOURS_CHROME, YOURS_SITE } from '../lib/yours';
import { useYoursWallet } from '../lib/wallet-store';

function shortAddr(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 5)}…${addr.slice(-4)}`;
}

/** Nav / header control for Yours Wallet (BRC-100) — mirrors SatPress WalletButton. */
export function WalletButton() {
  const { status, session, connect, disconnect, error } = useYoursWallet();

  async function onConnect() {
    try {
      await connect();
    } catch {
      // error stays on the store for tooltip / inscribe panel
    }
  }

  if (status === 'detecting') {
    return <span className="badge">…</span>;
  }

  if (status === 'connected' && session) {
    return (
      <button
        type="button"
        className="btn btn-ghost"
        style={{ padding: '0.35rem 0.55rem', fontSize: '0.75rem' }}
        title={`Disconnect ${session.provider}`}
        onClick={() => void disconnect()}
      >
        {shortAddr(session.addresses.ordAddress)}
      </button>
    );
  }

  // Default: Connect (Yours is usually installed). Install is a secondary link only.
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
      <button
        type="button"
        className="btn btn-cyan"
        style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
        disabled={status === 'connecting'}
        onClick={() => void onConnect()}
        title={error ?? 'Connect Yours Wallet'}
      >
        {status === 'connecting' ? 'Connecting…' : 'Connect Yours'}
      </button>
      {status === 'missing' && (
        <a
          className="muted"
          style={{ fontSize: '0.7rem' }}
          href={YOURS_CHROME}
          target="_blank"
          rel="noreferrer"
          title={`Install Yours Wallet — ${YOURS_SITE}`}
        >
          Install
        </a>
      )}
    </span>
  );
}
