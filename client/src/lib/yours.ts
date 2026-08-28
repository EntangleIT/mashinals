/**
 * Yours Wallet client over the BRC-100 provider API (@1sat/actions).
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

/** Build OneSat context for the connected extension wallet. */
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

/**
 * Inscribe a PNG (or other) payload via Yours / BRC-100 wallet.
 * Returns origin outpoint (txid_0).
 */
export async function inscribeWithYours(input: {
  base64Content: string;
  contentType: string;
  map: Record<string, string>;
}): Promise<{ txid: string; origin: string }> {
  const ctx = requireContext();
  const result = await inscribe.execute(ctx, {
    base64Content: input.base64Content,
    contentType: input.contentType,
    map: input.map,
    // Route through the wallet permission module so Yours shows its approval popup
    usePermissionModule: true,
  });

  if (result.error || !result.txid) {
    throw wrapWalletError(new Error(result.error ?? 'no-txid'), 'Inscribe');
  }

  const txid = result.txid.toLowerCase();
  return { txid, origin: `${txid}_0` };
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
  return new Error(raw || `${verb} failed in Yours Wallet.`);
}

export function whatsonchainUrl(txidOrOutpoint: string): string {
  const txid = txidOrOutpoint.split('_')[0]!;
  return `${WOC_TX}/${txid}`;
}
