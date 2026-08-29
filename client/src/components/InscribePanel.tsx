import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MashinalRecord } from '@mashinals/shared';
import { useMashStore } from '../store';
import { useYoursWallet } from '../lib/wallet-store';
import { demoInscribe, initializeMashinalsCollection, inscribeMashinal } from '../lib/inscription';
import { fetchOrdinalsConfig, reportInscription, type OrdinalsConfig } from '../lib/api';
import { PixelSprite } from '../pixel/PixelSprite';
import { YOURS_SITE, onesatOriginUrl, whatsonchainUrl } from '../lib/yours';

interface Props {
  record: MashinalRecord;
}

export function InscribePanel({ record }: Props) {
  const markInscribed = useMashStore((s) => s.markInscribed);
  const { status, session, connect, disconnect, error: walletError } = useYoursWallet();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [config, setConfig] = useState<OrdinalsConfig | null>(null);

  const alreadyOnChain = Boolean(record.origin);
  const hasDemo = Boolean(record.demoOrigin) && !alreadyOnChain;
  const connected = status === 'connected' && Boolean(session);

  useEffect(() => {
    let cancelled = false;
    void fetchOrdinalsConfig().then((c) => {
      if (!cancelled) setConfig(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onConnect() {
    setErr(null);
    setMsg(null);
    try {
      await connect();
      setMsg('Connected. Inscribe mints a 1Sat collection item into your Yours ordinals basket.');
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

  async function onInitCollection() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      if (!connected) await connect();
      const { collectionId, txid } = await initializeMashinalsCollection(record);
      const next = await fetchOrdinalsConfig();
      setConfig(next);
      setMsg(`Mashinals collection ready — ${collectionId} (tx ${txid.slice(0, 12)}…).`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Collection deploy failed');
      const next = await fetchOrdinalsConfig();
      setConfig(next);
    } finally {
      setBusy(false);
    }
  }

  async function onInscribe() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      if (!connected) await connect();
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
      const next = await fetchOrdinalsConfig();
      setConfig(next);
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

      {config && (
        <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
          {config.ready && config.collectionId
            ? `Collection ready · ${config.collectionId.slice(0, 18)}… · next #${config.nextMintNumber ?? '?'}`
            : 'Collection not initialized yet — first Inscribe (or Initialize) deploys the parent via Yours.'}
        </p>
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
          title="Mint as 1Sat Ordinal collection item into Yours"
        >
          {busy ? 'Inscribing…' : 'Inscribe 1Sat'}
        </button>
        {!config?.ready && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onInitCollection}
            disabled={busy || status === 'detecting'}
          >
            Initialize collection
          </button>
        )}
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
        Mints use the same plain basket path as live GatchaGo (no Sigma). Approve wallet prompts for
        protocol <code>onesat</code> and basket <code>1sat</code> — then the NFT shows under Yours →
        Ordinals right away.
      </p>
    </div>
  );
}
