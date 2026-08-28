import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MashinalRecord } from '@mashinals/shared';
import { useMashStore } from '../store';
import { useYoursWallet } from '../lib/wallet-store';
import { demoInscribe, inscribeMashinal } from '../lib/inscription';
import { reportInscription } from '../lib/api';
import { PixelSprite } from '../pixel/PixelSprite';
import {
  YOURS_SITE,
  getMintToAddress,
  isLikelyBsvAddress,
  onesatOriginUrl,
  setMintToAddress,
  whatsonchainUrl,
} from '../lib/yours';

interface Props {
  record: MashinalRecord;
}

export function InscribePanel({ record }: Props) {
  const markInscribed = useMashStore((s) => s.markInscribed);
  const { status, session, connect, disconnect, error: walletError } = useYoursWallet();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mintTo, setMintTo] = useState(() => getMintToAddress());

  useEffect(() => {
    setMintTo(getMintToAddress());
  }, [session?.addresses.ordAddress]);

  const alreadyOnChain = Boolean(record.origin);
  const hasDemo = Boolean(record.demoOrigin) && !alreadyOnChain;
  const connected = status === 'connected' && Boolean(session);

  function saveMintTo(next: string) {
    const trimmed = next.trim();
    setMintTo(trimmed);
    if (trimmed && !isLikelyBsvAddress(trimmed)) {
      setErr('Mint-to must be a mainnet BSV address starting with 1.');
      return;
    }
    setMintToAddress(trimmed);
    setErr(null);
    setMsg(
      trimmed
        ? `New mints will lock to ${trimmed}`
        : 'Mint-to cleared — will use the connected P1SAT ordinal deposit address.',
    );
  }

  async function onConnect() {
    setErr(null);
    setMsg(null);
    try {
      await connect();
      setMsg(
        'Connected. Set Mint to your Yours Ordinals receive address if it differs from the P1SAT deposit.',
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Connect failed');
    }
  }

  async function onDisconnect() {
    await disconnect();
    setMsg('Wallet disconnected');
  }

  async function onDemo() {
    setBusy(true);
    setErr(null);
    try {
      const result = await demoInscribe(record);
      markInscribed(record.id, {
        origin: result.origin,
        txid: result.txid,
        demo: true,
        svgHash: result.svgHash,
      });
      await reportInscription(record, {
        origin: result.origin,
        txid: result.txid,
        demo: true,
        svgHash: result.svgHash,
      });
      setMsg(result.message);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Demo inscribe failed');
    } finally {
      setBusy(false);
    }
  }

  async function onInscribe() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      if (mintTo.trim()) {
        if (!isLikelyBsvAddress(mintTo)) {
          throw new Error('Mint-to must be a mainnet BSV address starting with 1.');
        }
        setMintToAddress(mintTo.trim());
      }
      if (!connected) {
        await connect();
      }
      const result = await inscribeMashinal(record);
      markInscribed(record.id, {
        origin: result.origin,
        txid: result.txid,
        demo: false,
        svgHash: result.svgHash,
      });
      await reportInscription(record, {
        origin: result.origin,
        txid: result.txid,
        demo: false,
        svgHash: result.svgHash,
      });
      setMsg(result.message);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Inscribe failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel" style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="pixel-frame">
          <PixelSprite spec={record.spec} size={96} />
        </div>
        <div>
          <h3 style={{ margin: '0 0 0.35rem' }}>{record.name}</h3>
          <p className="muted" style={{ margin: 0 }}>
            {record.caption}
          </p>
          {record.parentAName && record.parentBName && (
            <p className="lineage" style={{ marginTop: '0.5rem' }}>
              {record.parentAName} + {record.parentBName} = {record.name}
            </p>
          )}
        </div>
      </div>

      {alreadyOnChain && (
        <div>
          <span className="badge">BROADCAST</span>
          <p className="muted" style={{ margin: '0.4rem 0 0', fontSize: '0.85rem' }}>
            origin{' '}
            <a href={whatsonchainUrl(record.origin!)} target="_blank" rel="noreferrer">
              {record.origin}
            </a>
            {' · '}
            <a href={onesatOriginUrl(record.origin!)} target="_blank" rel="noreferrer">
              1Sat explorer
            </a>
          </p>
          <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.8rem' }}>
            Earlier mints may have locked to a one-off key or a P1SAT deposit — not your legacy Yours
            Ordinals address. Set Mint to below, then mint a new character to land on that address.
          </p>
        </div>
      )}
      {hasDemo && (
        <div>
          <span className="badge demo">DEMO ONLY — NOT ON-CHAIN</span>
          <p className="muted" style={{ margin: '0.4rem 0 0', fontSize: '0.85rem' }}>
            {record.demoOrigin}
          </p>
        </div>
      )}

      {connected && (
        <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.85rem' }}>
          <span>
            Mint to (Yours Ordinals receive){' '}
            <span className="muted">— paste the address you use in Yours</span>
          </span>
          <input
            type="text"
            value={mintTo}
            placeholder={session?.addresses.ordAddress ?? '1…'}
            onChange={(e) => setMintTo(e.target.value)}
            onBlur={() => saveMintTo(mintTo)}
            spellCheck={false}
            autoComplete="off"
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.8rem',
              padding: '0.45rem 0.55rem',
              borderRadius: '6px',
              border: '1px solid var(--border, #333)',
              background: 'var(--panel, #12081c)',
              color: 'inherit',
            }}
          />
          <span className="muted" style={{ fontSize: '0.75rem' }}>
            Connected P1SAT deposit is {session?.addresses.ordAddress ?? '…'} — that is often not the
            legacy Ordinals address shown in Yours. Paste yours (e.g. 1DHBH…) so new mints lock there.
          </span>
        </label>
      )}

      <div className="cta-row">
        {!connected ? (
          <button
            type="button"
            className="btn btn-cyan"
            onClick={onConnect}
            disabled={busy || status === 'connecting' || status === 'detecting'}
          >
            {status === 'connecting' ? 'Connecting…' : 'Connect Yours Wallet'}
          </button>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={onDisconnect} disabled={busy}>
            Disconnect
          </button>
        )}
        <button
          type="button"
          className="btn"
          onClick={onInscribe}
          disabled={busy || alreadyOnChain || status === 'detecting'}
        >
          Inscribe 1Sat
        </button>
        <button type="button" className="btn btn-demo" onClick={onDemo} disabled={busy || alreadyOnChain}>
          Demo Inscribe
        </button>
        <Link className="btn btn-ghost" to={`/c/${record.id}`} style={{ textDecoration: 'none' }}>
          Open detail
        </Link>
      </div>

      {!connected && (
        <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
          Unlock the{' '}
          <a href={YOURS_SITE} target="_blank" rel="noreferrer">
            Yours
          </a>{' '}
          Chrome extension on this tab, then click Connect.
        </p>
      )}

      {connected && session && (
        <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
          Pay {session.addresses.bsvAddress.slice(0, 10)}…
          {session.balance ? ` · ${(session.balance.satoshis / 1e8).toFixed(4)} BSV` : ''}
        </p>
      )}

      {msg && <p style={{ margin: 0, color: 'var(--ok)' }}>{msg}</p>}
      {(err || walletError) && (
        <p style={{ margin: 0, color: 'var(--danger)' }}>{err ?? walletError}</p>
      )}
      <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
        Live mint uses{' '}
        <a href={YOURS_SITE} target="_blank" rel="noreferrer">
          Yours Wallet
        </a>{' '}
        to inscribe a 32×32 PNG + MAP. No private keys leave your wallet.
      </p>
    </div>
  );
}
