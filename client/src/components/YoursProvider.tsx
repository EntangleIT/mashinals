import { useEffect, useState, type ReactNode } from 'react';
import { WalletProvider, useWallet } from '@1sat/react';
import { registerWalletControls, useYoursWallet } from '../lib/wallet-store';

function YoursBridge({ children }: { children: ReactNode }) {
  const { wallet, status, identityKey, providerType, availableProviders, connect, disconnect } =
    useWallet();
  const syncWallet = useYoursWallet((s) => s.syncWallet);

  useEffect(() => {
    registerWalletControls(
      (provider) => connect(provider),
      () => disconnect(),
    );
  }, [connect, disconnect]);

  useEffect(() => {
    void syncWallet({
      status,
      wallet,
      identityKey,
      providerType,
      hasProviders: availableProviders.length > 0 || status === 'connected',
    });
  }, [status, wallet, identityKey, providerType, availableProviders.length, syncWallet]);

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
 * Children can still render before mount; wallet state lives in the zustand store.
 */
export function YoursProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <>{children}</>;
  return (
    <WalletProvider autoReconnect autoDetect>
      <YoursBridge>{children}</YoursBridge>
    </WalletProvider>
  );
}
