import { useEffect } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useMashStore } from './store';
import { assertPartKitSync } from './pixel/render';
import { WalletButton } from './components/WalletButton';
import { useYoursWallet } from './lib/wallet-store';

export function App() {
  const hydrateStarters = useMashStore((s) => s.hydrateStarters);
  const walletStatus = useYoursWallet((s) => s.status);

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
          <NavLink to="/market" className={({ isActive }) => (isActive ? 'active' : '')}>
            Market
          </NavLink>
          <NavLink to="/feed" className={({ isActive }) => (isActive ? 'active' : '')}>
            Feed
          </NavLink>
          <WalletButton />
          <span className="badge">{walletStatus === 'connected' ? 'YOURS' : 'PLAY'}</span>
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
