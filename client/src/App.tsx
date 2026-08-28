import { useEffect } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useMashStore } from './store';
import { assertPartKitSync } from './pixel/render';

export function App() {
  const hydrateStarters = useMashStore((s) => s.hydrateStarters);
  const wallet = useMashStore((s) => s.wallet);

  useEffect(() => {
    hydrateStarters();
    try {
      assertPartKitSync();
    } catch (e) {
      console.error(e);
    }
  }, [hydrateStarters]);

  return (
    <div className="app-shell">
      <header className="topnav">
        <Link to="/" className="brand">
          MASHINALS
        </Link>
        <nav className="nav-links">
          <NavLink to="/play" className={({ isActive }) => (isActive ? 'active' : '')}>
            Play
          </NavLink>
          <NavLink to="/gallery" className={({ isActive }) => (isActive ? 'active' : '')}>
            Gallery
          </NavLink>
          <NavLink to="/feed" className={({ isActive }) => (isActive ? 'active' : '')}>
            Feed
          </NavLink>
          <span className="badge" title={wallet.paymentAddress ?? ''}>
            {wallet.connected ? 'WALLET' : 'PLAY'}
          </span>
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
