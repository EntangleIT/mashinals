import { useEffect, useState, type ReactNode } from 'react';
import { WalletProvider, useWallet } from '@1sat/react';
import { registerWalletControls, useYoursWallet } from '../lib/wallet-store';

function YoursBridge({ children }: { children: ReactNode }) {
  const { wallet, status, identityKey, providerType, connect, disconnect } = useWallet();
  const syncWallet = useYoursWallet((s) => s.syncWallet);

  useEffect(() => {
    // Match SatPress: drive connect/disconnect from the React provider.
    registerWalletControls(
      () => connect(),
      () => disconnect(),
    );
  }, [connect, disconnect]);

  useEffect(() => {
    // SatPress always passes hasProviders: true. Yours is often installed but
    // not listed in availableProviders until the user initiates connect
    // (popup / BRC-100 protocol) — treating an empty list as "missing" wrongly
    // sends people to the Chrome Web Store.
    void syncWallet({
      status,
      wallet,
      identityKey,
      providerType,
      hasProviders: true,
    });
  }, [status, wallet, identityKey, providerType, syncWallet]);

  useEffect(() => {
    function onEvent(e: Event) {
      const action = (e as CustomEvent<{ action?: string }>).detail?.action;
      if (action === 'signedOut') {
        void syncWallet({
          status: 'disconnected',
          wallet: null,
          identityKey: null,
          providerType: null,
          hasProviders: true,
        });
      }
    }
    window.addEventListener('YoursEmitEvent', onEvent);
    return () => window.removeEventListener('YoursEmitEvent', onEvent);
  }, [syncWallet]);

  return <>{children}</>;
}

/**
 * Mounts BRC-100 WalletProvider client-side only (touches browser APIs).
 * Same pattern as auxon/satpress `YoursProvider`.
 */
export function YoursProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <>{children}</>;
  return (
    <WalletProvider autoReconnect>
      <YoursBridge>{children}</YoursBridge>
    </WalletProvider>
  );
}
