import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMashStore } from '../store';
import { CharacterTile } from '../components/CharacterTile';

export function GalleryPage() {
  const discovered = useMashStore((s) => s.discovered);
  const list = useMemo(
    () =>
      Object.values(discovered).sort((a, b) => {
        if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;
        return b.generation - a.generation || b.discoveredAt - a.discoveredAt;
      }),
    [discovered],
  );

  const discoveries = list.filter((c) => !c.isStarter);
  const inscribed = list.filter((c) => c.origin || c.demoOrigin);

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Gallery</h1>
      <p className="muted">
        {list.length} characters · {discoveries.length} mash discoveries · {inscribed.length}{' '}
        inscribed (incl. demos)
      </p>
      <div className="grid-chars">
        {list.map((c) => (
          <Link key={c.id} to={`/c/${c.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <CharacterTile record={c} />
          </Link>
        ))}
      </div>
    </div>
  );
}
