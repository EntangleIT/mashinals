import { create } from 'zustand';
import type { WalletInterface } from '@bsv/sdk';
import {
  buildContext,
  buildSession,
  setActiveContext,
  type YoursSession,
} from './yours';

/**
 * App-facing wallet status.
 *
 * Important: do NOT treat an empty `availableProviders` list as "missing".
 * `@1sat/connect` only lists providers you configure via the `providers` prop;
 * Yours (BRC-100 chrome extension) is found during `connectWallet({ autoDetect })`,
 * not via that list. SatPress always passes `hasProviders: true` for the same reason.
 */
export type AppWalletStatus =
  | 'detecting'
  | 'available'
  | 'connecting'
  | 'connected';

type BridgeStatus = 'disconnected' | 'detecting' | 'selecting' | 'connecting' | 'connected';

type WalletState = {
  status: AppWalletStatus;
  session: YoursSession | null;
  error: string | null;
  hydrated: boolean;
  syncWallet: (input: {
    status: BridgeStatus;
    wallet: WalletInterface | null;
    identityKey: string | null;
    providerType: string | null;
  }) => Promise<void>;
  connect: () => Promise<YoursSession>;
  disconnect: () => Promise<void>;
};

let connector: (() => Promise<void>) | null = null;
let disconnector: (() => void) | null = null;

export function registerWalletControls(
  connectFn: () => Promise<void>,
  disconnectFn: () => void,
): void {
  connector = connectFn;
  disconnector = disconnectFn;
}

/** Serialize syncs but never drop the latest payload (SatPress used a hard skip lock). */
let syncChain: Promise<void> = Promise.resolve();

export const useYoursWallet = create<WalletState>((set, get) => ({
  status: 'detecting',
  session: null,
  error: null,
  hydrated: false,

  syncWallet: async (input) => {
    const run = async () => {
      const { status, wallet, identityKey, providerType } = input;
      if (status !== 'connected') {
        setActiveContext(null);
        set((prev) => ({
          status:
            status === 'connecting'
              ? 'connecting'
              : status === 'detecting'
                ? prev.hydrated
                  ? prev.status
                  : 'detecting'
                : // disconnected | selecting → always offer Connect (never Chrome Store)
                  'available',
          session: null,
          hydrated: true,
          error:
            status === 'selecting'
              ? 'Unlock Yours Wallet in Chrome, then click Connect again.'
              : prev.error,
        }));
        return;
      }
      if (!wallet) return;
      setActiveContext(buildContext(wallet));
      try {
        const session = await buildSession(identityKey ?? '', providerType);
        set({ status: 'connected', session, error: null, hydrated: true });
      } catch (err) {
        set({
          status: 'available',
          session: null,
          error: err instanceof Error ? err.message : 'Could not read wallet addresses.',
          hydrated: true,
        });
      }
    };

    const next = syncChain.then(run, run);
    syncChain = next.then(
      () => undefined,
      () => undefined,
    );
    await next;
  },

  connect: async () => {
    if (!connector) {
      throw new Error(
        'Yours Wallet bridge is not ready yet. Wait a moment and try again, or reload the page.',
      );
    }
    set({ status: 'connecting', error: null });
    try {
      await connector();
      for (let i = 0; i < 80 && get().status !== 'connected'; i++) {
        await new Promise((r) => setTimeout(r, 100));
        // Fail fast once the BRC-100 race finishes without a wallet
        if (get().status === 'available' && get().error) break;
      }
      const session = get().session;
      if (get().status !== 'connected' || !session) {
        throw new Error(
          get().error ??
            'Could not reach Yours Wallet. Unlock the extension on this tab, then try Connect again.',
        );
      }
      return session;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not connect Yours Wallet.';
      // Stay available so the user can retry Connect — never bounce to Install.
      set({
        status: 'available',
        error: message,
        hydrated: true,
      });
      throw err instanceof Error ? err : new Error(message);
    }
  },

  disconnect: async () => {
    disconnector?.();
    setActiveContext(null);
    set({ status: 'available', session: null, error: null });
  },
}));
