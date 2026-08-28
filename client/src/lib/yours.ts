/**
 * Yours Wallet client over the BRC-100 provider API (@1sat/actions).
 * Pattern matches auxon/satpress `src/lib/ord/yours.ts`.
 * Docs: https://yours-wallet.gitbook.io/provider-api
 */

import {
  createContext,
  deriveDepositAddresses,
  inscribe,
  mintCollection,
  mintCollectionItem,
  listOrdinals,
  sellOrdinal,
  buyOrdinal,
  sendOrdinals,
  cancelOrdinalListing,
  type OneSatContext,
} from '@1sat/actions';
import type { CollectionItemTrait } from '@1sat/types';
import { OneSatServices } from '@1sat/client';
import { readAssetIdTag } from '@1sat/types';
import type { WalletInterface, WalletOutput } from '@bsv/sdk';
import type { InscriptionMeta } from '@mashinals/shared';

export const YOURS_CHROME =
  'https://chromewebstore.google.com/detail/yours-wallet/mlbnicldlpdimbjdcncnklfempedeipj';
export const YOURS_SITE = 'https://yours.org';
export const WOC_TX = 'https://whatsonchain.com/tx';
/** 1Sat ordinal explorer (indexes after broadcast; may lag while in mempool). */
export const ONESAT_ORIGIN = 'https://ordinals.gorillapool.io/txo/origin';

/** Local preference helpers kept for older sessions; new mints ignore mint-to. */
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
 * Deploy the official Mashinals collection parent (once), same pattern as live
 * GatchaGo: `@1sat/actions` `mintCollection` → Yours ordinals basket.
 */
export async function mintCollectionWithYours(input: {
  base64Content: string;
  contentType: string;
  name?: string;
  description?: string;
  quantity?: number;
}): Promise<{ txid: string; collectionId: string }> {
  const ctx = requireContext();
  try {
    const result = await runWalletAction('Mint collection', 'Create inscription', () =>
      mintCollection.execute(ctx, {
        base64Content: input.base64Content,
        contentType: input.contentType,
        name: input.name ?? 'Mashinals',
        description:
          input.description ??
          'Official Mashinals collection — Infinite Craft–style pixel creatures inscribed as 1Sat Ordinals.',
        quantity: input.quantity ?? 1_000_000,
        app: 'mashinals',
      }),
    );
    if (result.error || !result.txid || !result.collectionId) {
      throw wrapWalletError(
        new Error(result.error ?? 'collection-mint-failed'),
        'Mint collection',
      );
    }
    return {
      txid: result.txid.toLowerCase(),
      collectionId: result.collectionId.replace('.', '_'),
    };
  } catch (err) {
    if (err instanceof WalletTimeoutError) throw err;
    throw wrapWalletError(err, 'Mint collection');
  }
}

/**
 * Mint a Mashinal as a 1Sat collection item into the Yours ordinals basket.
 * Matches live GatchaGo (`mintCollectionItem`) — tagged + customInstructions so
 * sell/transfer work without a bare P2PKH mint-to address.
 */
export async function mintCollectionItemWithYours(input: {
  base64Content: string;
  contentType: string;
  name: string;
  collectionId: string;
  mintNumber?: number;
  traits?: CollectionItemTrait[];
}): Promise<{ txid: string; origin: string }> {
  const ctx = requireContext();
  try {
    const result = await runWalletAction('Mint collection item', 'Create inscription', () =>
      mintCollectionItem.execute(ctx, {
        base64Content: input.base64Content,
        contentType: input.contentType,
        name: input.name.slice(0, 64) || 'Mashinal',
        collectionId: input.collectionId.replace('.', '_'),
        mintNumber: input.mintNumber,
        traits: input.traits,
        app: 'mashinals',
      }),
    );
    if (result.error || !result.txid) {
      throw wrapWalletError(new Error(result.error ?? 'no-txid'), 'Mint collection item');
    }
    const txid = result.txid.toLowerCase();
    return { txid, origin: `${txid}_0` };
  } catch (err) {
    if (err instanceof WalletTimeoutError) throw err;
    throw wrapWalletError(err, 'Mint collection item');
  }
}

/**
 * Plain inscribe fallback (non-collection). Prefer mintCollectionItemWithYours.
 * Always omits destination so the output lands in the Yours ordinals basket.
 */
export async function inscribeWithYours(input: {
  base64Content: string;
  contentType: string;
  map: Record<string, string>;
}): Promise<{ txid: string; origin: string; destination: string }> {
  const ctx = requireContext();
  try {
    const result = await runWalletAction('Inscribe', INSCRIBE_DESCRIPTION, () =>
      inscribe.execute(ctx, {
        base64Content: input.base64Content,
        contentType: input.contentType,
        map: input.map,
      }),
    );

    if (result.error || !result.txid) {
      throw wrapWalletError(new Error(result.error ?? 'no-txid'), 'Inscribe');
    }

    const txid = result.txid.toLowerCase();
    return {
      txid,
      origin: `${txid}_0`,
      destination: 'yours-ordinals-basket',
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
  const txid = txidOrOutpoint.split(/[_.]/)[0]!;
  return `${WOC_TX}/${txid}`;
}

export function onesatOriginUrl(origin: string): string {
  // Explorer uses txid_vout with underscore
  return `${ONESAT_ORIGIN}/${origin.replace('.', '_')}`;
}

export function toDotOutpoint(outpoint: string): string {
  return outpoint.replace('_', '.');
}

export function toUnderscoreOutpoint(outpoint: string): string {
  return outpoint.replace('.', '_');
}

export function contentUrl(origin: string): string {
  return `https://api.1sat.app/content/${toUnderscoreOutpoint(origin)}`;
}

export function formatSats(sats: number): string {
  if (sats >= 1e8) return `${(sats / 1e8).toFixed(4)} BSV`;
  if (sats >= 1e6) return `${(sats / 1e6).toFixed(2)} M sats`;
  return `${sats.toLocaleString()} sats`;
}

export type WalletOrdItem = {
  id: string;
  outpoint: string;
  origin: string | null;
  name: string | null;
  listed: boolean;
  output: WalletOutput;
};

function originFromTags(tags: string[] | undefined): string | null {
  if (!tags) return null;
  for (const t of tags) {
    if (t.startsWith('origin:') && t.length > 7) return toUnderscoreOutpoint(t.slice(7));
    if (t === 'origin') continue;
  }
  // listing outs still carry origin as a bare tag sometimes — fall back to outpoint
  return null;
}

function nameFromOutput(output: WalletOutput): string | null {
  const tags = output.tags ?? [];
  for (const t of tags) {
    if (t.startsWith('name:')) return t.slice(5);
  }
  if (output.customInstructions) {
    try {
      const ci = JSON.parse(output.customInstructions) as { name?: string };
      if (ci.name) return ci.name;
    } catch {
      // ignore
    }
  }
  return null;
}

/** Ordinals currently in the connected Yours basket. */
export async function listWalletOrdinals(limit = 100): Promise<WalletOrdItem[]> {
  const ctx = requireContext();
  const { outputs } = await listOrdinals.execute(ctx, {
    limit,
    includeTags: true,
    includeCustomInstructions: true,
  });
  const items: WalletOrdItem[] = [];
  for (const output of outputs) {
    const id = readAssetIdTag(output.tags);
    if (!id) continue;
    const listed = (output.tags ?? []).includes('ordlock');
    const origin = originFromTags(output.tags) ?? (listed ? null : toUnderscoreOutpoint(output.outpoint));
    items.push({
      id,
      outpoint: toUnderscoreOutpoint(output.outpoint),
      origin,
      name: nameFromOutput(output),
      listed,
      output,
    });
  }
  return items;
}

export async function sellOrdinalWithYours(input: {
  id: string;
  priceSats: number;
  payAddress?: string;
}): Promise<string> {
  if (!Number.isFinite(input.priceSats) || input.priceSats < 1) {
    throw new Error('Price must be at least 1 sat.');
  }
  const ctx = requireContext();
  const result = await runWalletAction('List', 'List ordinal', () =>
    sellOrdinal.execute(ctx, {
      id: input.id,
      price: Math.floor(input.priceSats),
      ...(input.payAddress ? { payAddress: input.payAddress } : {}),
      map: { app: 'mashinals', type: 'ord' },
    }),
  );
  if (result.error || !result.txid) {
    throw wrapWalletError(new Error(result.error ?? 'no-txid'), 'List');
  }
  return result.txid.toLowerCase();
}

export async function cancelListingWithYours(id: string): Promise<string> {
  const ctx = requireContext();
  const result = await runWalletAction('Cancel listing', 'Cancel', () =>
    cancelOrdinalListing.execute(ctx, { id }),
  );
  if (result.error || !result.txid) {
    throw wrapWalletError(new Error(result.error ?? 'no-txid'), 'Cancel listing');
  }
  return result.txid.toLowerCase();
}

export async function buyOrdinalWithYours(input: {
  outpoint: string;
  origin?: string;
  name?: string;
}): Promise<string> {
  const ctx = requireContext();
  const result = await runWalletAction('Buy', 'Buy ordinal', () =>
    buyOrdinal.execute(ctx, {
      outpoint: toDotOutpoint(input.outpoint),
      ...(input.origin ? { origin: toDotOutpoint(input.origin) } : {}),
      ...(input.name ? { name: input.name } : {}),
      contentType: 'image/png',
    }),
  );
  if (result.error || !result.txid) {
    throw wrapWalletError(new Error(result.error ?? 'no-txid'), 'Buy');
  }
  return result.txid.toLowerCase();
}

export async function transferOrdinalWithYours(input: {
  id: string;
  address: string;
}): Promise<string> {
  if (!isLikelyBsvAddress(input.address)) {
    throw new Error('Transfer needs a mainnet BSV address starting with 1.');
  }
  const ctx = requireContext();
  const result = await runWalletAction('Transfer', 'Transfer ', () =>
    sendOrdinals.execute(ctx, {
      transfers: [{ id: input.id, address: input.address.trim() }],
    }),
  );
  if (result.error || !result.txid) {
    throw wrapWalletError(new Error(result.error ?? 'no-txid'), 'Transfer');
  }
  return result.txid.toLowerCase();
}

/** Expose market client used by the market page. */
export function getOneSatServices(): OneSatServices {
  return services;
}
