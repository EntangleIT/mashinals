/**
 * Mint into Yours `1sat` basket the way live GatchaGo does it:
 * plain inscription (no Sigma), basket + tags + CI on createAction.
 *
 * Current @1sat mintCollectionItem always seals with Sigma, which first creates
 * a `sigma` basket anchor — users see a basket appear but Ordinals stays empty.
 */

import {
  executeTrackedAction,
  listOrdinals,
  randomActionId,
  ORDINALS_BASKET,
  P1SAT_PROTOCOL,
  type OneSatContext,
} from '@1sat/actions';
import type { CollectionItemTrait } from '@1sat/types';
import { Inscription, MAP as MAPTemplate } from '@1sat/templates';
import { Beef, P2PKH, PublicKey, Script, Utils } from '@bsv/sdk';
import { getActiveContext, wrapWalletError } from './yours';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function requireCtx(): OneSatContext {
  const ctx = getActiveContext();
  if (!ctx) {
    throw new Error('Connect Yours Wallet first — live inscription needs a connected BRC-100 wallet.');
  }
  return ctx;
}

function typeTag(contentType: string): string {
  const base = contentType.split(';')[0]?.trim() || contentType;
  return `type:${base}`;
}

function collectionIdToParentBytes(collectionId: string): Uint8Array {
  const normalized = collectionId.trim().replace('.', '_');
  const m = /^([a-fA-F0-9]{64})_(\d+)$/.exec(normalized);
  if (!m) throw new Error(`Invalid collectionId format: ${collectionId}`);
  const txidBytes = Utils.toArray(m[1]!, 'hex').reverse();
  const writer = new Utils.Writer();
  writer.write(txidBytes);
  writer.writeUInt32LE(Number(m[2]));
  return new Uint8Array(writer.toArray());
}

/** Plain inscription + MAP + P2PKH (GatchaGo-style — no Sigma tape). */
function buildInscriptionScript(
  address: string,
  base64Content: string,
  contentType: string,
  map: Record<string, string>,
  parent?: Uint8Array,
): Script {
  const content = Utils.toArray(base64Content, 'base64');
  const p2pkhScript = new P2PKH().lock(address);
  const suffix = new Script();
  for (const chunk of p2pkhScript.chunks) suffix.chunks.push(chunk);
  const mapScript = MAPTemplate.set(map);
  for (const chunk of mapScript.chunks) suffix.chunks.push(chunk);
  const inscription = Inscription.create(new Uint8Array(content), contentType, {
    scriptSuffix: suffix,
    parent,
  });
  return new Script(inscription.lock().chunks);
}

async function outpointInBasket(ctx: OneSatContext, txid: string): Promise<boolean> {
  const { outputs } = await listOrdinals.execute(ctx, {
    limit: 500,
    includeTags: true,
    includeCustomInstructions: true,
  });
  return outputs.some(
    (o) =>
      o.outpoint === `${txid}.0` ||
      o.outpoint === `${txid}_0` ||
      (typeof o.outpoint === 'string' && o.outpoint.startsWith(txid)),
  );
}

async function beefAtomicForTxid(ctx: OneSatContext, txid: string, tx?: number[]): Promise<number[]> {
  if (tx?.length) {
    try {
      const beef = Beef.fromBinary(tx);
      if (beef.findTxid(txid)) return Array.from(beef.toBinaryAtomic(txid));
    } catch {
      // network fallback
    }
  }
  if (!ctx.services?.getBeefForTxid) {
    throw new Error('Cannot import mint into Yours — wallet services unavailable.');
  }
  const beef = await ctx.services.getBeefForTxid(txid);
  return Array.from(beef.toBinaryAtomic(txid));
}

async function ensureInBasket(input: {
  ctx: OneSatContext;
  txid: string;
  tags: string[];
  customInstructions: string;
  tx?: number[];
}): Promise<boolean> {
  const txid = input.txid.toLowerCase();
  for (let i = 0; i < 5; i++) {
    if (await outpointInBasket(input.ctx, txid)) return true;
    await sleep(300);
  }

  try {
    const actionId = randomActionId();
    const tags = [...input.tags.filter((t) => !t.startsWith('id:')), `id:${actionId}_0`];
    const atomic = await beefAtomicForTxid(input.ctx, txid, input.tx);
    await input.ctx.wallet.internalizeAction({
      tx: atomic,
      outputs: [
        {
          outputIndex: 0,
          protocol: 'basket insertion',
          insertionRemittance: {
            basket: ORDINALS_BASKET,
            tags,
            customInstructions: input.customInstructions,
          },
        },
      ],
      description: 'Import Mashinal into Yours ordinals basket',
    });
  } catch (err) {
    console.warn('[mint] internalize failed', err);
  }

  for (let i = 0; i < 8; i++) {
    if (await outpointInBasket(input.ctx, txid)) return true;
    await sleep(300);
  }
  return false;
}

/**
 * GatchaGo-style mint: one createAction into basket `1sat`, no Sigma.
 */
async function mintPlainOrdinal(input: {
  ctx: OneSatContext;
  description: string;
  outputDescription: string;
  lockingScript: Script;
  tags: string[];
  keyID: string;
  name: string;
}): Promise<{ txid: string; tx?: number[]; tags: string[]; customInstructions: string }> {
  const actionId = randomActionId();
  const tags = [...input.tags.filter((t) => !t.startsWith('id:')), `id:${actionId}_0`];
  const customInstructions = JSON.stringify({
    protocolID: P1SAT_PROTOCOL,
    keyID: input.keyID,
    name: input.name.slice(0, 64),
  });

  const result = await executeTrackedAction(
    input.ctx.wallet,
    {
      description: input.description,
      outputs: [
        {
          lockingScript: input.lockingScript.toHex(),
          satoshis: 1,
          outputDescription: input.outputDescription,
          basket: ORDINALS_BASKET,
          tags,
          customInstructions,
        },
      ],
      options: {
        acceptDelayedBroadcast: false,
        randomizeOutputs: false,
      },
    },
    undefined,
    undefined,
    undefined,
    {
      spends: [],
      // Local pipeline (same as GatchaGo mint-item). Do NOT use Sigma / permission-module.
      usePermissionModule: false,
    },
  );

  if (!result.txid) {
    throw new Error(result.error ?? 'no-txid-returned');
  }
  return {
    txid: result.txid.toLowerCase(),
    tx: result.tx,
    tags,
    customInstructions,
  };
}

export async function mintCollectionIntoBasket(input: {
  base64Content: string;
  contentType: string;
  name?: string;
  description?: string;
  quantity?: number;
}): Promise<{ txid: string; collectionId: string; inBasket: boolean }> {
  const ctx = requireCtx();
  const name = (input.name ?? 'Mashinals').slice(0, 64);
  const quantity = input.quantity ?? 1_000_000;
  const keyID = Date.now().toString();

  try {
    const { publicKey } = await ctx.wallet.getPublicKey({
      protocolID: P1SAT_PROTOCOL,
      keyID,
      counterparty: 'self',
      forSelf: true,
    });
    const address = PublicKey.fromString(publicKey).toAddress();
    const map: Record<string, string> = {
      app: 'mashinals',
      type: 'ord',
      name,
      subType: 'collection',
      subTypeData: JSON.stringify({
        description:
          input.description ??
          'Official Mashinals collection — Infinite Craft–style pixel creatures inscribed as 1Sat Ordinals.',
        quantity,
        rarityLabels: [],
        traits: {},
      }),
    };
    const lockingScript = buildInscriptionScript(address, input.base64Content, input.contentType, map);
    const tags = [
      typeTag(input.contentType),
      'origin',
      `name:${name}`,
      'subType:collection',
      'app:mashinals',
    ];

    const minted = await mintPlainOrdinal({
      ctx,
      description: `Create collection: ${name}`,
      outputDescription: 'Collection inscription',
      lockingScript,
      tags,
      keyID,
      name,
    });
    const inBasket = await ensureInBasket({
      ctx,
      txid: minted.txid,
      tags: minted.tags,
      customInstructions: minted.customInstructions,
      tx: minted.tx,
    });
    return { txid: minted.txid, collectionId: `${minted.txid}_0`, inBasket };
  } catch (err) {
    throw wrapWalletError(err, 'Mint collection');
  }
}

export async function mintCollectionItemIntoBasket(input: {
  base64Content: string;
  contentType: string;
  name: string;
  collectionId: string;
  mintNumber?: number;
  traits?: CollectionItemTrait[];
}): Promise<{ txid: string; origin: string; inBasket: boolean }> {
  const ctx = requireCtx();
  const collectionId = input.collectionId.replace('.', '_');
  const displayName = input.name.slice(0, 64) || 'Mashinal';
  const keyID = Date.now().toString();

  try {
    const parentBytes = collectionIdToParentBytes(collectionId);
    const { publicKey } = await ctx.wallet.getPublicKey({
      protocolID: P1SAT_PROTOCOL,
      keyID,
      counterparty: 'self',
      forSelf: true,
    });
    const address = PublicKey.fromString(publicKey).toAddress();
    const subTypeData: Record<string, unknown> = {
      collectionId,
      ...(input.mintNumber !== undefined && { mintNumber: input.mintNumber }),
      ...(input.traits && input.traits.length > 0 && { traits: input.traits }),
    };
    const map: Record<string, string> = {
      app: 'mashinals',
      type: 'ord',
      name: displayName,
      subType: 'collectionItem',
      subTypeData: JSON.stringify(subTypeData),
    };
    const lockingScript = buildInscriptionScript(
      address,
      input.base64Content,
      input.contentType,
      map,
      parentBytes,
    );
    // Tag shape matches live GatchaGo mint-item (name + collectionId).
    const tags = [
      typeTag(input.contentType),
      'origin',
      `name:${displayName}`,
      'subType:collectionItem',
      `collectionId:${collectionId}`,
      'app:mashinals',
    ];

    const minted = await mintPlainOrdinal({
      ctx,
      description: `Create collection item: ${displayName}`,
      outputDescription: 'Collection item inscription',
      lockingScript,
      tags,
      keyID,
      name: displayName,
    });
    const inBasket = await ensureInBasket({
      ctx,
      txid: minted.txid,
      tags: minted.tags,
      customInstructions: minted.customInstructions,
      tx: minted.tx,
    });
    if (!inBasket) {
      throw new Error(
        'Mint broadcast but Yours Ordinals did not list it. In Yours → Permissions, allow basket "1sat" for this site, reopen Ordinals, and try again.',
      );
    }
    return { txid: minted.txid, origin: `${minted.txid}_0`, inBasket: true };
  } catch (err) {
    throw wrapWalletError(err, 'Mint collection item');
  }
}
