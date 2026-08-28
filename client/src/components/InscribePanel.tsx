import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { MashinalRecord } from '@mashinals/shared';
import { useMashStore } from '../store';
import { connectWallet, disconnectWallet } from '../lib/wallet';
import { demoInscribe, inscribeMashinal } from '../lib/inscription';
import { reportInscription } from '../lib/api';
import { PixelSprite } from '../pixel/PixelSprite';

interface Props {
  record: MashinalRecord;
}

export function InscribePanel({ record }: Props) {
  const wallet = useMashStore((s) => s.wallet);
  const setWallet = useMashStore((s) => s.setWallet);
  const disconnect = useMashStore((s) => s.disconnectWallet);
  const markInscribed = useMashStore((s) => s.markInscribed);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const alreadyOnChain = Boolean(record.origin);
  const hasDemo = Boolean(record.demoOrigin) && !alreadyOnChain;

  async function onConnect() {
    setErr(null);
    setMsg(null);
    try {
      const session = await connectWallet();
      setWallet(session);
      setMsg(`Connected ${session.provider}: ${session.ordinalAddress?.slice(0, 10)}…`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Connect failed');
    }
  }

  async function onDisconnect() {
    await disconnectWallet(wallet.provider);
    disconnect();
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
    try {
      const result = await inscribeMashinal(record, wallet);
      markInscribed(record.id, {
        origin: result.origin,
        txid: result.txid,
        demo: result.demo,
        svgHash: result.svgHash,
      });
      await reportInscription(record, {
        origin: result.origin,
        txid: result.txid,
        demo: result.demo,
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
          <span className="badge">ON-CHAIN</span>
          <p className="muted" style={{ margin: '0.4rem 0 0', fontSize: '0.85rem' }}>
            origin {record.origin}
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

      <div className="cta-row">
        {!wallet.connected ? (
          <button type="button" className="btn btn-cyan" onClick={onConnect} disabled={busy}>
            Connect wallet
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
          disabled={busy || !wallet.connected || alreadyOnChain}
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

      {msg && <p style={{ margin: 0, color: 'var(--ok)' }}>{msg}</p>}
      {err && <p style={{ margin: 0, color: 'var(--danger)' }}>{err}</p>}
      <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
        Inscribes a tiny 32×32 PNG pixel sprite + MAP metadata (name, caption, parents, genes). No
        private keys leave your wallet. Demo mode stores a local preview ordinal only.
      </p>
    </div>
  );
}
