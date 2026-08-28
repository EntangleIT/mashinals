import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMashinalListings, type MashListing } from '../lib/market';
import { useYoursWallet } from '../lib/wallet-store';
import {
  buyOrdinalWithYours,
  cancelListingWithYours,
  formatSats,
  isLikelyBsvAddress,
  listWalletOrdinals,
  sellOrdinalWithYours,
  transferOrdinalWithYours,
  whatsonchainUrl,
  type WalletOrdItem,
} from '../lib/yours';

type Tab = 'sale' | 'mine';

export function MarketPage() {
  const { status, session, connect } = useYoursWallet();
  const connected = status === 'connected' && Boolean(session);
  const [tab, setTab] = useState<Tab>('sale');
  const [listings, setListings] = useState<MashListing[]>([]);
  const [mine, setMine] = useState<WalletOrdItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [transfers, setTransfers] = useState<Record<string, string>>({});

  const refreshListings = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const items = await fetchMashinalListings(80);
      setListings(items);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load listings');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshMine = useCallback(async () => {
    if (!connected) {
      setMine([]);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const items = await listWalletOrdinals(100);
      setMine(items);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not read Yours ordinals basket');
    } finally {
      setLoading(false);
    }
  }, [connected]);

  useEffect(() => {
    void refreshListings();
  }, [refreshListings]);

  useEffect(() => {
    if (tab === 'mine') void refreshMine();
  }, [tab, refreshMine]);

  async function ensureConnected() {
    if (!connected) await connect();
  }

  async function onBuy(listing: MashListing) {
    setBusyId(listing.listingOutpoint);
    setErr(null);
    setMsg(null);
    try {
      await ensureConnected();
      const txid = await buyOrdinalWithYours({
        outpoint: listing.listingOutpoint,
        origin: listing.origin,
        name: listing.name,
      });
      setMsg(`Purchased ${listing.name}. Tx ${txid.slice(0, 12)}…`);
      await refreshListings();
      if (tab === 'mine') await refreshMine();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Buy failed');
    } finally {
      setBusyId(null);
    }
  }

  async function onSell(item: WalletOrdItem) {
    const raw = prices[item.id] ?? '';
    const bsv = Number(raw);
    if (!Number.isFinite(bsv) || bsv <= 0) {
      setErr('Enter a price in BSV (e.g. 0.1)');
      return;
    }
    const priceSats = Math.round(bsv * 1e8);
    setBusyId(item.id);
    setErr(null);
    setMsg(null);
    try {
      const txid = await sellOrdinalWithYours({ id: item.id, priceSats });
      setMsg(`Listed ${item.name ?? 'ordinal'} for ${formatSats(priceSats)}. Tx ${txid.slice(0, 12)}…`);
      await refreshMine();
      await refreshListings();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'List failed');
    } finally {
      setBusyId(null);
    }
  }

  async function onCancel(item: WalletOrdItem) {
    setBusyId(item.id);
    setErr(null);
    setMsg(null);
    try {
      const txid = await cancelListingWithYours(item.id);
      setMsg(`Listing cancelled. Tx ${txid.slice(0, 12)}…`);
      await refreshMine();
      await refreshListings();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setBusyId(null);
    }
  }

  async function onTransfer(item: WalletOrdItem) {
    const address = (transfers[item.id] ?? '').trim();
    if (!isLikelyBsvAddress(address)) {
      setErr('Enter a mainnet BSV address starting with 1');
      return;
    }
    setBusyId(item.id);
    setErr(null);
    setMsg(null);
    try {
      const txid = await transferOrdinalWithYours({ id: item.id, address });
      setMsg(`Transferred ${item.name ?? 'ordinal'}. Tx ${txid.slice(0, 12)}…`);
      await refreshMine();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Transfer failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Market</h1>
      <p className="muted">
        Buy, sell, and transfer Mashinals on the 1Sat orderbook via Yours Wallet. Listings need
        basket-minted ordinals (leave Mint to blank when inscribing).
      </p>

      <div className="cta-row" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className={`btn ${tab === 'sale' ? '' : 'btn-ghost'}`}
          onClick={() => setTab('sale')}
        >
          For sale
        </button>
        <button
          type="button"
          className={`btn ${tab === 'mine' ? '' : 'btn-ghost'}`}
          onClick={() => setTab('mine')}
        >
          My Mashinals
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void (tab === 'sale' ? refreshListings() : refreshMine())}
          disabled={loading}
        >
          Refresh
        </button>
        {!connected && (
          <button type="button" className="btn btn-cyan" onClick={() => void connect()}>
            Connect Yours
          </button>
        )}
      </div>

      {msg && <p style={{ color: 'var(--ok)' }}>{msg}</p>}
      {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}
      {loading && <p className="muted">Loading…</p>}

      {tab === 'sale' && !loading && listings.length === 0 && (
        <div className="panel">
          <p style={{ margin: 0 }}>
            No Mashinals listed yet. Mint into your Yours ordinals basket (empty Mint to), open{' '}
            <strong>My Mashinals</strong>, set a BSV price, and hit List.
          </p>
        </div>
      )}

      {tab === 'sale' && (
        <div className="grid-chars" style={{ marginTop: '0.5rem' }}>
          {listings.map((listing) => (
            <div key={listing.listingOutpoint} className="char-tile market-tile">
              <div className="pixel-frame" style={{ padding: 4 }}>
                <img
                  src={listing.imageUrl}
                  alt={listing.name}
                  width={72}
                  height={72}
                  style={{ imageRendering: 'pixelated', display: 'block', width: 72, height: 72 }}
                />
              </div>
              <div className="name">{listing.name}</div>
              <div className="gen">{formatSats(listing.priceSats)}</div>
              <div className="cta-row" style={{ marginTop: 8, justifyContent: 'center' }}>
                <button
                  type="button"
                  className="btn btn-cyan"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.55rem' }}
                  disabled={busyId === listing.listingOutpoint}
                  onClick={() => void onBuy(listing)}
                >
                  {busyId === listing.listingOutpoint ? 'Buying…' : 'Buy'}
                </button>
                <a
                  className="btn btn-ghost"
                  style={{ fontSize: '0.7rem', padding: '0.35rem 0.45rem', textDecoration: 'none' }}
                  href={whatsonchainUrl(listing.listingOutpoint)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Tx
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'mine' && !connected && (
        <div className="panel">
          <p style={{ margin: 0 }}>Connect Yours Wallet to manage ordinals in your basket.</p>
        </div>
      )}

      {tab === 'mine' && connected && !loading && mine.length === 0 && (
        <div className="panel">
          <p style={{ margin: 0 }}>
            No ordinals in the Yours basket. Inscribe from{' '}
            <Link to="/play">Play</Link> with <strong>Mint to</strong> left blank so Yours can list
            and transfer them.
          </p>
        </div>
      )}

      {tab === 'mine' && connected && (
        <div className="market-mine" style={{ display: 'grid', gap: '0.85rem', marginTop: '0.5rem' }}>
          {mine.map((item) => (
            <div key={item.id} className="panel" style={{ display: 'grid', gap: '0.55rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="pixel-frame" style={{ padding: 4 }}>
                  <img
                    src={`https://api.1sat.app/content/${item.origin ?? item.outpoint}`}
                    alt={item.name ?? 'ordinal'}
                    width={64}
                    height={64}
                    style={{ imageRendering: 'pixelated', display: 'block' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.opacity = '0.3';
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: 700 }}>{item.name ?? 'Ordinal'}</div>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>
                    {item.listed ? 'LISTED' : 'OWNED'} · {item.origin ?? item.outpoint}
                  </div>
                </div>
                <span className={`badge${item.listed ? '' : ' demo'}`}>
                  {item.listed ? 'FOR SALE' : 'BASKET'}
                </span>
              </div>

              {item.listed ? (
                <div className="cta-row">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busyId === item.id}
                    onClick={() => void onCancel(item)}
                  >
                    {busyId === item.id ? 'Cancelling…' : 'Cancel listing'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="cta-row" style={{ alignItems: 'center' }}>
                    <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.85rem' }}>
                      Price (BSV)
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        placeholder="0.1"
                        value={prices[item.id] ?? ''}
                        onChange={(e) => setPrices((p) => ({ ...p, [item.id]: e.target.value }))}
                        style={{
                          width: '6.5rem',
                          padding: '0.35rem 0.45rem',
                          borderRadius: 6,
                          border: '1px solid var(--glass-border)',
                          background: 'var(--bg1)',
                          color: 'inherit',
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn btn-yellow"
                      disabled={busyId === item.id}
                      onClick={() => void onSell(item)}
                    >
                      {busyId === item.id ? 'Listing…' : 'List for sale'}
                    </button>
                  </div>
                  <div className="cta-row" style={{ alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Transfer to address (1…)"
                      value={transfers[item.id] ?? ''}
                      onChange={(e) => setTransfers((t) => ({ ...t, [item.id]: e.target.value }))}
                      spellCheck={false}
                      style={{
                        flex: 1,
                        minWidth: '12rem',
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: '0.8rem',
                        padding: '0.4rem 0.5rem',
                        borderRadius: 6,
                        border: '1px solid var(--glass-border)',
                        background: 'var(--bg1)',
                        color: 'inherit',
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busyId === item.id}
                      onClick={() => void onTransfer(item)}
                    >
                      Transfer
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
