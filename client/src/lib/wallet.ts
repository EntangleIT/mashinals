/** Browser wallet connect for BSV / 1SatOrdinals (no hot keys). */

export interface WalletSession {
  connected: boolean;
  paymentAddress: string | null;
  ordinalAddress: string | null;
  provider: string | null;
}

declare global {
  interface Window {
    onesat?: {
      connect?: () => Promise<{
        paymentAddress?: string;
        ordinalAddress?: string;
        addresses?: { payment?: string; ordinal?: string };
      }>;
      disconnect?: () => Promise<void>;
      isConnected?: () => Promise<boolean>;
    };
    yours?: {
      isReady?: boolean;
      connect?: () => Promise<{
        paymail?: string;
        paymentAddress?: string;
        ordinalsAddress?: string;
      }>;
      disconnect?: () => Promise<void>;
    };
  }
}

export async function detectWalletProvider(): Promise<'onesat' | 'yours' | null> {
  if (typeof window === 'undefined') return null;
  if (window.onesat?.connect) return 'onesat';
  if (window.yours?.connect) return 'yours';
  return null;
}

export async function connectWallet(): Promise<WalletSession> {
  const provider = await detectWalletProvider();
  if (!provider) {
    throw new Error(
      'No BSV / 1Sat wallet found. Install a 1sat.market or Yours-compatible wallet, or use Demo Inscribe.',
    );
  }

  if (provider === 'onesat' && window.onesat?.connect) {
    const res = await window.onesat.connect();
    const paymentAddress = res.paymentAddress ?? res.addresses?.payment ?? null;
    const ordinalAddress = res.ordinalAddress ?? res.addresses?.ordinal ?? paymentAddress;
    if (!paymentAddress) throw new Error('Wallet connected but no payment address returned.');
    return {
      connected: true,
      paymentAddress,
      ordinalAddress: ordinalAddress ?? paymentAddress,
      provider: 'onesat',
    };
  }

  if (provider === 'yours' && window.yours?.connect) {
    const res = await window.yours.connect();
    const paymentAddress = res.paymentAddress ?? null;
    const ordinalAddress = res.ordinalsAddress ?? paymentAddress;
    if (!paymentAddress) throw new Error('Wallet connected but no payment address returned.');
    return {
      connected: true,
      paymentAddress,
      ordinalAddress: ordinalAddress ?? paymentAddress,
      provider: 'yours',
    };
  }

  throw new Error('Wallet provider is present but connect() is unavailable.');
}

export async function disconnectWallet(provider: string | null): Promise<void> {
  try {
    if (provider === 'onesat') await window.onesat?.disconnect?.();
    if (provider === 'yours') await window.yours?.disconnect?.();
  } catch {
    // ignore
  }
}
