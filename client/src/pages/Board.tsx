import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useMashStore } from '../store';
import { CharacterTile } from '../components/CharacterTile';
import { InscribePanel } from '../components/InscribePanel';
import { PixelSprite } from '../pixel/PixelSprite';
import { reportRecipe } from '../lib/api';

export function BoardPage() {
  const discovered = useMashStore((s) => s.discovered);
  const slotA = useMashStore((s) => s.slotA);
  const slotB = useMashStore((s) => s.slotB);
  const lastResultId = useMashStore((s) => s.lastResultId);
  const lastWasNew = useMashStore((s) => s.lastWasNew);
  const selectForSlot = useMashStore((s) => s.selectForSlot);
  const setSlot = useMashStore((s) => s.setSlot);
  const clearSlots = useMashStore((s) => s.clearSlots);
  const mash = useMashStore((s) => s.mash);
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    const items = Object.values(discovered).sort((a, b) => {
      if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;
      return b.discoveredAt - a.discoveredAt;
    });
    if (!query.trim()) return items;
    const q = query.trim().toLowerCase();
    return items.filter((c) => c.name.toLowerCase().includes(q));
  }, [discovered, query]);

  const a = slotA ? discovered[slotA] : null;
  const b = slotB ? discovered[slotB] : null;
  const result = lastResultId ? discovered[lastResultId] : null;

  function doMash() {
    const child = mash();
    if (!child) return;
    void reportRecipe({
      recipeKey: child.recipeKey,
      parentAId: child.parentAId ?? '',
      parentBId: child.parentBId ?? '',
      childId: child.id,
      childName: child.name,
    });
  }

  function onDropChar(id: string) {
    selectForSlot(id);
    // Auto-combine when both slots fill
    const state = useMashStore.getState();
    const nextA = state.slotA;
    const nextB = state.slotB;
    if (nextA && nextB) {
      // slight defer so UI paints both slots
      requestAnimationFrame(() => doMash());
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ marginTop: 0 }}>Mash board</h1>
          <p className="muted" style={{ marginTop: 0 }}>
            Click two pixel pals, hit Mash — or fill both slots to auto-combine. Same recipe =
            same child.
          </p>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter discoveries…"
          style={{
            background: 'rgba(0,0,0,0.35)',
            border: '2px solid var(--glass-border)',
            color: 'var(--text)',
            padding: '0.55rem 0.75rem',
            minWidth: 200,
          }}
        />
      </div>

      <div className="mash-row">
        <div className={`slot${a ? ' filled' : ''}`}>
          {a ? (
            <>
              <PixelSprite spec={a.spec} size={96} />
              <strong>{a.name}</strong>
              <button type="button" className="btn btn-ghost" onClick={() => setSlot('A', null)}>
                Clear
              </button>
            </>
          ) : (
            <span className="muted">Slot A</span>
          )}
        </div>
        <div className="plus">+</div>
        <div className={`slot${b ? ' filled' : ''}`}>
          {b ? (
            <>
              <PixelSprite spec={b.spec} size={96} />
              <strong>{b.name}</strong>
              <button type="button" className="btn btn-ghost" onClick={() => setSlot('B', null)}>
                Clear
              </button>
            </>
          ) : (
            <span className="muted">Slot B</span>
          )}
        </div>
        <div className="equals">=</div>
        <div className="slot filled" style={{ borderColor: 'var(--pink)' }}>
          {result ? (
            <>
              <PixelSprite spec={result.spec} size={96} />
              <strong>{result.name}</strong>
              {lastWasNew && <span className="badge new">NEW</span>}
            </>
          ) : (
            <span className="muted">Result</span>
          )}
        </div>
      </div>

      <div className="cta-row" style={{ marginBottom: '1rem' }}>
        <button type="button" className="btn btn-yellow" onClick={doMash} disabled={!a || !b}>
          Mash!
        </button>
        <button type="button" className="btn btn-ghost" onClick={clearSlots}>
          Clear slots
        </button>
        <span className="muted" style={{ alignSelf: 'center' }}>
          {Object.keys(discovered).length} discovered
        </span>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            className="result-burst"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <h2 style={{ marginTop: 0 }}>
              {lastWasNew ? 'Discovery!' : 'Known recipe'} · {result.name}
            </h2>
            <p style={{ marginTop: 0 }}>{result.caption}</p>
            {result.parentAName && result.parentBName && (
              <p className="lineage">
                {result.parentAName} + {result.parentBName} = {result.name}
              </p>
            )}
            <div style={{ marginTop: '1rem' }}>
              <InscribePanel record={result} />
            </div>
            <div className="cta-row" style={{ marginTop: '0.75rem', justifyContent: 'center' }}>
              <Link className="btn btn-ghost" to={`/c/${result.id}`} style={{ textDecoration: 'none' }}>
                Character page
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <h2>Your characters</h2>
      <div className="grid-chars">
        {list.map((c) => (
          <CharacterTile
            key={c.id}
            record={c}
            selected={c.id === slotA || c.id === slotB}
            onClick={() => onDropChar(c.id)}
            onDoubleClick={() => {
              // open detail via navigation hint — board stays; user can use gallery
              selectForSlot(c.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}
