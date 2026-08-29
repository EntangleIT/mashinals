/**
 * Mint the way live GatchaGo does (from its deployed onesat bundle):
 * - basket: "p 1sat ordinals"  (legacy — what GatchaGo writes; Yours migrates → 1sat)
 * - protocolID: [0, "p 1sat"]
 * - plain inscription (NO Sigma)
 * - tags: type / origin / name / subType / collectionId
 * - CI: { protocolID, keyID, name }
 *
 * Also mirrors into modern basket "1sat" so current Yours Ordinals UI sees them.
 */

import {
  executeTrackedAction,
  listOrdinals,
  migrateLegacyP1SatBaskets,
  randomActionId,
  ORDINALS_BASKET,
  type OneSatContext,
} from '@1sat/actions';
import type { CollectionItemTrait } from '@1sat/types';
import { Inscription, MAP as MAPTemplate } from '@1sat/templates';
import { Beef, P2PKH, PublicKey, Script, Utils } from '@bsv/sdk';
import { getActiveContext, wrapWalletError } from './yours';

/** Exact basket string from live GatchaGo onesat bundle (`Br="p 1sat ordinals"`). */
export const GATCHAGO_ORDINALS_BASKET = 'p 1sat ordinals';
/** Exact protocol from live GatchaGo (`qe=[0,"p 1sat"]`). */
export const GATCHAGO_PROTOCOL = [0, 'p 1sat'] as [0, string];

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

async function listBasket(
  ctx: OneSatContext,
  basket: string,
): Promise<{ outpoint: string; tags?: string[]; customInstructions?: string }[]> {
  try {
    const { outputs } = await ctx.wallet.listOutputs({
      basket,
      includeTags: true,
      includeCustomInstructions: true,
      limit: 500,
    });
    return outputs;
  } catch (err) {
    console.warn(`[mint] listOutputs(${basket}) failed`, err);
    return [];
  }
}

async function outpointInAnyBasket(ctx: OneSatContext, txid: string): Promise<boolean> {
  const match = (o: { outpoint: string }) =>
    o.outpoint === `${txid}.0` ||
    o.outpoint === `${txid}_0` ||
    (typeof o.outpoint === 'string' && o.outpoint.startsWith(txid));

  for (const basket of [GATCHAGO_ORDINALS_BASKET, ORDINALS_BASKET]) {
    const outs = await listBasket(ctx, basket);
    if (outs.some(match)) return true;
  }
  try {
    const { outputs } = await listOrdinals.execute(ctx, { limit: 500, includeTags: true });
    if (outputs.some(match)) return true;
  } catch {
    // ignore
  }
  return false;
}

async function beefAtomicForTxid(ctx: OneSatContext, txid: string, tx?: number[]): Promise<number[]> {
  if (tx?.length) {
    try {
      const beef = Beef.fromBinary(tx);
      if (beef.findTxid(txid)) return Array.from(beef.toBinaryAtomic(txid));
    } catch {
      // network
    }
  }
  if (!ctx.services?.getBeefForTxid) {
    throw new Error('Cannot import mint into Yours — wallet services unavailable.');
  }
  const beef = await ctx.services.getBeefForTxid(txid);
  return Array.from(beef.toBinaryAtomic(txid));
}

async function internalizeToBasket(input: {
  ctx: OneSatContext;
  txid: string;
  basket: string;
  tags: string[];
  customInstructions: string;
  tx?: number[];
}): Promise<void> {
  const actionId = randomActionId();
  const tags = [...input.tags.filter((t) => !t.startsWith('id:')), `id:${actionId}_0`];
  const atomic = await beefAtomicForTxid(input.ctx, input.txid, input.tx);
  await input.ctx.wallet.internalizeAction({
    tx: atomic,
    outputs: [
      {
        outputIndex: 0,
        protocol: 'basket insertion',
        insertionRemittance: {
          basket: input.basket,
          tags,
          customInstructions: input.customInstructions,
        },
      },
    ],
    description: `Import Mashinal into ${input.basket}`,
  });
}

async function ensureVisibleInYours(input: {
  ctx: OneSatContext;
  txid: string;
  tags: string[];
  customInstructions: string;
  tx?: number[];
}): Promise<boolean> {
  const txid = input.txid.toLowerCase();

  for (let i = 0; i < 5; i++) {
    if (await outpointInAnyBasket(input.ctx, txid)) {
      // Prefer modern 1sat basket for current Yours Ordinals tab.
      try {
        await migrateLegacyP1SatBaskets(input.ctx.wallet);
      } catch (err) {
        console.warn('[mint] migrateLegacyP1SatBaskets', err);
      }
      return true;
    }
    await sleep(300);
  }

  // Force into the same basket GatchaGo uses, then modern 1sat.
  for (const basket of [GATCHAGO_ORDINALS_BASKET, ORDINALS_BASKET]) {
    try {
      await internalizeToBasket({ ...input, txid, basket });
    } catch (err) {
      console.warn(`[mint] internalize → ${basket} failed`, err);
    }
  }

  try {
    await migrateLegacyP1SatBaskets(input.ctx.wallet);
  } catch (err) {
    console.warn('[mint] migrateLegacyP1SatBaskets', err);
  }

  for (let i = 0; i < 8; i++) {
    if (await outpointInAnyBasket(input.ctx, txid)) return true;
    await sleep(300);
  }
  return false;
}

/** GatchaGo mint: createAction into `p 1sat ordinals`, no Sigma. */
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
    protocolID: GATCHAGO_PROTOCOL,
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
          basket: GATCHAGO_ORDINALS_BASKET,
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
      usePermissionModule: false,
      bypassP1Sat: true, // skip modern onesat Sigma/apply — exact GatchaGo createAction shape
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
      protocolID: GATCHAGO_PROTOCOL,
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
    const inBasket = await ensureVisibleInYours({
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
      protocolID: GATCHAGO_PROTOCOL,
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
    const inBasket = await ensureVisibleInYours({
      ctx,
      txid: minted.txid,
      tags: minted.tags,
      customInstructions: minted.customInstructions,
      tx: minted.tx,
    });
    if (!inBasket) {
      throw new Error(
        'Mint broadcast but Yours did not list it in Ordinals. Approve basket access for "p 1sat ordinals" and "1sat", then reopen Yours → Ordinals.',
      );
    }
    return { txid: minted.txid, origin: `${minted.txid}_0`, inBasket: true };
  } catch (err) {
    throw wrapWalletError(err, 'Mint collection item');
  }
}
