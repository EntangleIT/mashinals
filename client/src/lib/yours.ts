/**
 * Yours Wallet client over the BRC-100 provider API (@1sat/actions).
 * Pattern matches auxon/satpress `src/lib/ord/yours.ts`.
 * Docs: https://yours-wallet.gitbook.io/provider-api
 */

import {
  createContext,
  deriveDepositAddresses,
  inscribe,
  type OneSatContext,
} from '@1sat/actions';
import { OneSatServices } from '@1sat/client';
import type { WalletInterface } from '@bsv/sdk';
import type { InscriptionMeta } from '@mashinals/shared';

export const YOURS_CHROME =
  'https://chromewebstore.google.com/detail/yours-wallet/mlbnicldlpdimbjdcncnklfempedeipj';
export const YOURS_SITE = 'https://yours.org';
export const WOC_TX = 'https://whatsonchain.com/tx';
/** 1Sat ordinal explorer (indexes after broadcast; may lag while in mempool). */
export const ONESAT_ORIGIN = 'https://ordinals.gorillapool.io/txo/origin';

/** Local preference: lock new inscriptions to this P2PKH (Yours legacy ord receive). */
const MINT_TO_KEY = 'mashinals:mint-to-address';

export function getMintToAddress(): string {
  try {
    return (localStorage.getItem(MINT_TO_KEY) ?? '').trim();
  } catch {
    return '';
  }
}

export function setMintToAddress(address: string): void {
  const next = address.trim();
  try {
    if (!next) localStorage.removeItem(MINT_TO_KEY);
    else localStorage.setItem(MINT_TO_KEY, next);
  } catch {
    // ignore
  }
}

/** Loose mainnet P2PKH check (1… Base58). */
export function isLikelyBsvAddress(value: string): boolean {
  const v = value.trim();
  return /^1[1-9A-HJ-NP-Za-km-z]{24,33}$/.test(v);
}

export type YoursAddresses = {
  bsvAddress: string;
  ordAddress: string;
  identityAddress?: string;
};

export type YoursBalance = {
  bsv: number;
  satoshis: number;
};

export type YoursSession = {
  provider: string;
  addresses: YoursAddresses;
  balance: YoursBalance | null;
  identity?: string;
};

let activeCtx: OneSatContext | null = null;
const services = new OneSatServices('main');

export function setActiveContext(ctx: OneSatContext | null): void {
  activeCtx = ctx;
}

export function getActiveContext(): OneSatContext | null {
  return activeCtx;
}

export function requireContext(): OneSatContext {
  if (!activeCtx) {
    throw new Error('Connect Yours Wallet first — live inscription needs a connected BRC-100 wallet.');
  }
  return activeCtx;
}

/**
 * Extension wallets are dApp-style (isBaseWallet false). Same as SatPress —
 * approval UI comes from the wallet's createAction/signAction handling.
 */
export function buildContext(wallet: WalletInterface): OneSatContext {
  return createContext(wallet, { chain: 'main', services, isBaseWallet: false });
}

/** Derive display addresses + spendable balance for the connected identity. */
export async function buildSession(
  identityKey: string,
  providerType: string | null,
): Promise<YoursSession> {
  const ctx = requireContext();
  const derivations = await deriveDepositAddresses.execute(ctx, { startIndex: 0, count: 2 });
  const bsvAddress = derivations.derivations[0]?.address ?? '';
  const ordAddress = derivations.derivations[1]?.address ?? bsvAddress;
  if (!bsvAddress) {
    throw new Error('Yours Wallet did not return a deposit address. Unlock the extension and try again.');
  }

  let balance: YoursBalance | null = null;
  try {
    const outputs = await ctx.wallet.listOutputs({ basket: 'default', limit: 500 });
    const sats = outputs.outputs.reduce((sum, o) => sum + (o.spendable ? o.satoshis : 0), 0);
    balance = { satoshis: sats, bsv: sats / 1e8 };
  } catch {
    balance = null;
  }

  return {
    provider: providerType ?? 'yours-wallet',
    addresses: { bsvAddress, ordAddress, identityAddress: identityKey || undefined },
    balance,
    identity: identityKey || undefined,
  };
}

/** MAP values must be strings. */
export function metaToMap(meta: InscriptionMeta): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (v === undefined || v === null) continue;
    map[k] = String(v);
  }
  return map;
}

// ── Hang / missing-txid recovery (from SatPress) ─────────────────────────────
// Yours can approve + broadcast but return without a txid (permission-module
// path) or hang on ordinals.1sat.app proof fetches. Recover from listActions.

const WALLET_CALL_TIMEOUT_MS = 180_000;
const INSCRIBE_DESCRIPTION = 'Create inscription';

class WalletTimeoutError extends Error {
  constructor(readonly stage: string) {
    super(`wallet-timeout:${stage}`);
    this.name = 'WalletTimeoutError';
  }
}

function withTimeout<T>(p: Promise<T>, stage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new WalletTimeoutError(stage)), WALLET_CALL_TIMEOUT_MS);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

async function recoverTxidFromActions(descriptionPrefix: string): Promise<string | null> {
  try {
    const wallet = activeCtx?.wallet;
    if (!wallet?.listActions) return null;
    const { actions } = await wallet.listActions({ labels: [], limit: 10 });
    const match = (actions ?? []).find(
      (a) =>
        a.isOutgoing &&
        typeof a.description === 'string' &&
        a.description.startsWith(descriptionPrefix) &&
        (a.status === 'completed' || a.status === 'unproven'),
    );
    return match?.txid ? match.txid.toLowerCase() : null;
  } catch {
    return null;
  }
}

async function runWalletAction<T extends { txid?: string; error?: string }>(
  stage: string,
  descriptionPrefix: string,
  run: () => Promise<T>,
): Promise<T> {
  console.info(`[yours] ${stage}…`);
  try {
    const result = await withTimeout(run(), stage);
    if (result.txid) {
      console.info(`[yours] ${stage} done`, result.txid);
      return result;
    }
    // createAction finished without txid — often still broadcast. Recover.
    console.warn(`[yours] ${stage} returned without txid (${result.error ?? 'empty'}) — recovering`);
    const recovered = await recoverTxidFromActions(descriptionPrefix);
    if (recovered) {
      console.warn(`[yours] recovered txid: ${recovered}`);
      return { ...result, txid: recovered, error: undefined };
    }
    return result;
  } catch (err) {
    if (!(err instanceof WalletTimeoutError)) throw err;
    console.warn(`[yours] ${stage} timed out — attempting txid recovery`);
    const recovered = await recoverTxidFromActions(descriptionPrefix);
    if (recovered) {
      console.warn(`[yours] recovered txid after timeout: ${recovered}`);
      return { txid: recovered } as T;
    }
    throw new Error(
      `${stage}: Yours Wallet did not respond within ${Math.round(WALLET_CALL_TIMEOUT_MS / 1000)}s. ` +
        'The transaction may still have broadcast — check the wallet activity before retrying.',
    );
  }
}

/**
 * Address that new inscriptions lock to, or `null` for default self (ordinals basket).
 *
 * Prefer `null` (omit destination) so Yours stores customInstructions and can
 * list/sell on 1sat.market. A bare P2PKH mint-to address often shows on explorers
 * but fails `sellOrdinal` with missing-custom-instructions.
 */
export async function resolveMintDestination(
  override?: string,
): Promise<string | null> {
  const preferred = (override ?? getMintToAddress()).trim();
  if (!preferred) return null;
  if (!isLikelyBsvAddress(preferred)) {
    throw new Error('Mint-to address must be a mainnet BSV address starting with 1.');
  }
  return preferred;
}

/**
 * Inscribe a PNG (or other) payload via Yours / BRC-100 wallet.
 * Default: lock to self in the ordinals basket (listable on 1sat.market).
 * Optional mint-to address: locks to that P2PKH (explorer-visible) but Yours
 * may not be able to list it.
 */
export async function inscribeWithYours(input: {
  base64Content: string;
  contentType: string;
  map: Record<string, string>;
  destinationAddress?: string;
}): Promise<{ txid: string; origin: string; destination: string }> {
  const ctx = requireContext();
  const destination = await resolveMintDestination(input.destinationAddress);
  try {
    const result = await runWalletAction('Inscribe', INSCRIBE_DESCRIPTION, () =>
      inscribe.execute(ctx, {
        base64Content: input.base64Content,
        contentType: input.contentType,
        map: input.map,
        ...(destination ? { destination: { address: destination } } : {}),
      }),
    );

    if (result.error || !result.txid) {
      throw wrapWalletError(new Error(result.error ?? 'no-txid'), 'Inscribe');
    }

    const txid = result.txid.toLowerCase();
    return {
      txid,
      origin: `${txid}_0`,
      destination: destination ?? 'yours-ordinals-basket',
    };
  } catch (err) {
    if (err instanceof WalletTimeoutError) throw err;
    throw wrapWalletError(err, 'Inscribe');
  }
}

export function wrapWalletError(err: unknown, verb: string): Error {
  const raw = err instanceof Error ? err.message : String(err ?? 'Unknown error');
  const lower = raw.toLowerCase();
  if (
    lower.includes('user-rejected') ||
    lower.includes('reject') ||
    lower.includes('denied') ||
    lower.includes('cancel') ||
    lower.includes('closed')
  ) {
    return new Error(`${verb} was rejected in Yours Wallet.`);
  }
  if (
    lower.includes('insufficient-funds') ||
    lower.includes('insufficient') ||
    lower.includes('not enough')
  ) {
    return new Error('Yours Wallet does not have enough BSV to broadcast this inscription.');
  }
  if (lower.includes('storage-payment-failed') || lower.includes('storage')) {
    return new Error('Yours Wallet remote storage needs a top-up before broadcasting.');
  }
  if (lower.includes('not-connected') || lower.includes('locked')) {
    return new Error('Unlock Yours Wallet and connect it to Mashinals.');
  }
  if (
    lower.includes('no-txid') ||
    lower.includes('module-left-signable') ||
    lower.includes('txid-returned')
  ) {
    return new Error(
      `${verb} finished but Yours did not return a txid. Check the extension's activity — ` +
        'the mint may already be on-chain. Avoid retrying until you confirm.',
    );
  }
  return new Error(raw || `${verb} failed in Yours Wallet.`);
}

export function whatsonchainUrl(txidOrOutpoint: string): string {
  const txid = txidOrOutpoint.split('_')[0]!;
  return `${WOC_TX}/${txid}`;
}

export function onesatOriginUrl(origin: string): string {
  // Explorer uses txid_vout with underscore
  return `${ONESAT_ORIGIN}/${origin.replace('.', '_')}`;
}
