import { useEffect, useState } from 'react';
import type { PublicFeedItem } from '@mashinals/shared';
import { fetchFeed } from '../lib/api';
import { PixelSprite } from '../pixel/PixelSprite';
import { clampCharacterSpec } from '@mashinals/shared';

export function FeedPage() {
  const [items, setItems] = useState<PublicFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const data = await fetchFeed();
      if (!alive) return;
      setItems(data);
      setError(data.length === 0 ? null : null);
      setLoading(false);
    })().catch(() => {
      if (!alive) return;
      setError('Feed unreachable — worker may be offline. Local play still works.');
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Public feed</h1>
      <p className="muted">Recently inscribed Mashinals reported by clients after broadcast / demo.</p>
      {loading && <p>Loading feed…</p>}
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      {!loading && items.length === 0 && (
        <div className="panel">
          <p style={{ margin: 0 }}>
            No inscriptions indexed yet. Mash something, hit <strong>Demo Inscribe</strong>, and it
            will show up here when the worker is running.
          </p>
        </div>
      )}
      <div className="grid-chars" style={{ marginTop: '1rem' }}>
        {items.map((item) => {
          let spec;
          try {
            spec = clampCharacterSpec(JSON.parse(item.specJson));
          } catch {
            spec = clampCharacterSpec(null);
          }
          return (
            <div key={item.id + item.origin} className="char-tile" style={{ cursor: 'default' }}>
              <div className="pixel-frame" style={{ padding: 4 }}>
                <PixelSprite spec={spec} size={72} title={item.name} />
              </div>
              <div className="name">{item.name}</div>
              <div className="gen">gen {item.generation}</div>
              <div style={{ marginTop: 4 }}>
                <span className={`badge${item.demo ? ' demo' : ''}`}>
                  {item.demo ? 'DEMO' : '1SAT'}
                </span>
              </div>
              {item.parentAName && item.parentBName && (
                <p className="muted" style={{ fontSize: '0.7rem', margin: '0.35rem 0 0' }}>
                  {item.parentAName} × {item.parentBName}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
