import { YOURS_SITE } from '../lib/yours';
import { useYoursWallet } from '../lib/wallet-store';

function shortAddr(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 5)}…${addr.slice(-4)}`;
}

/**
 * Nav control for Yours Wallet (BRC-100) — mirrors SatPress WalletButton.
 * Always offers Connect (never a Chrome Web Store Install button). Yours is
 * detected during connect autoDetect, not by scanning availableProviders.
 */
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
    const label = session.addresses.ordAddress.startsWith('id:')
      ? 'Yours ✓'
      : shortAddr(session.addresses.ordAddress);
    return (
      <button
        type="button"
        className="btn btn-ghost"
        style={{ padding: '0.35rem 0.55rem', fontSize: '0.75rem' }}
        title={error ?? `Disconnect ${session.provider}`}
        onClick={() => void disconnect()}
      >
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="btn btn-cyan"
      style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
      disabled={status === 'connecting'}
      onClick={() => void onConnect()}
      title={error ?? `Connect Yours Wallet — ${YOURS_SITE}`}
    >
      {status === 'connecting' ? 'Connecting…' : 'Connect Yours'}
    </button>
  );
}
