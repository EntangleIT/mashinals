/**
 * Mint Mashinals into the Yours `1sat` ordinals basket and verify they stick.
 *
 * Plain mintCollectionItem can broadcast while the extension fails to retain
 * basket metadata — then Yours Ordinals stays empty. We mint with a known
 * keyID/CI and internalize into basket `1sat` if listOrdinals misses the outpoint.
 */

import {
  appendSigmaPlaceholder,
  buildOrdinalCustomInstructions,
  executeTrackedAction,
  listOrdinals,
  prepareP1SatArgs,
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
  const txid = m[1]!;
  const vout = Number(m[2]);
  const txidBytes = Utils.toArray(txid, 'hex').reverse();
  const writer = new Utils.Writer();
  writer.write(txidBytes);
  writer.writeUInt32LE(vout);
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

async function outpointInBasket(ctx: OneSatContext, txid: string): Promise<boolean> {
  const dot = `${txid}.0`;
  const under = `${txid}_0`;
  const { outputs } = await listOrdinals.execute(ctx, {
    limit: 500,
    includeTags: true,
    includeCustomInstructions: true,
  });
  return outputs.some((o) => o.outpoint === dot || o.outpoint === under || o.outpoint?.startsWith(txid));
}

async function beefAtomicForTxid(ctx: OneSatContext, txid: string, tx?: number[]): Promise<number[]> {
  if (tx?.length) {
    try {
      const beef = Beef.fromBinary(tx);
      if (beef.findTxid(txid)) return Array.from(beef.toBinaryAtomic(txid));
    } catch {
      // fall through to network fetch
    }
  }
  if (!ctx.services?.getBeefForTxid) {
    throw new Error('Cannot import mint into Yours — wallet services unavailable.');
  }
  const beef = await ctx.services.getBeefForTxid(txid);
  return Array.from(beef.toBinaryAtomic(txid));
}

/**
 * Force the inscription into the Yours `1sat` basket so Ordinals UI / sell work.
 */
export async function ensureMintInYoursBasket(input: {
  txid: string;
  tags: string[];
  customInstructions: string;
  tx?: number[];
  name?: string;
}): Promise<{ inBasket: boolean; internalized: boolean }> {
  const ctx = requireCtx();
  const txid = input.txid.toLowerCase();

  for (let i = 0; i < 6; i++) {
    if (await outpointInBasket(ctx, txid)) return { inBasket: true, internalized: false };
    await sleep(400);
  }

  const actionId = randomActionId();
  const tags = [
    ...input.tags.filter((t) => !t.startsWith('id:')),
    `id:${actionId}_0`,
  ];
  if (input.name && !tags.some((t) => t.startsWith('name:'))) {
    tags.push(`name:${input.name.slice(0, 64)}`);
  }

  const atomic = await beefAtomicForTxid(ctx, txid, input.tx);
  await ctx.wallet.internalizeAction({
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

  for (let i = 0; i < 8; i++) {
    if (await outpointInBasket(ctx, txid)) return { inBasket: true, internalized: true };
    await sleep(400);
  }
  return { inBasket: false, internalized: true };
}

async function mintWithBasketTracking(
  ctx: OneSatContext,
  opts: {
    description: string;
    outputDescription: string;
    lockingScript: Script;
    tags: string[];
    customInstructions: string;
  },
): Promise<{ txid: string; tx?: number[] }> {
  const placeholderScript = await appendSigmaPlaceholder(ctx, opts.lockingScript);
  const args = await prepareP1SatArgs(ctx, {
    description: opts.description,
    outputs: [
      {
        lockingScript: placeholderScript.toHex(),
        satoshis: 1,
        outputDescription: opts.outputDescription,
        basket: ORDINALS_BASKET,
        tags: opts.tags,
        customInstructions: opts.customInstructions,
      },
    ],
    options: {
      acceptDelayedBroadcast: false,
      randomizeOutputs: false,
    },
  });

  const result = await executeTrackedAction(ctx.wallet, args, undefined, undefined, undefined, {
    spends: [],
    usePermissionModule: false,
    permissionScheme: '1sat',
  });

  if (!result.txid) {
    throw new Error(result.error ?? 'no-txid-returned');
  }
  return {
    txid: result.txid.toLowerCase(),
    tx: result.tx,
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
  const name = input.name ?? 'Mashinals';
  const quantity = input.quantity ?? 1_000_000;
  const keyID = `${Date.now()}`;
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
  const tags = [typeTag(input.contentType), 'origin', 'subType:collection', 'app:mashinals'];
  const customInstructions = buildOrdinalCustomInstructions({
    protocolID: P1SAT_PROTOCOL,
    keyID,
    tags,
    name: name.slice(0, 64),
  });

  try {
    const { txid, tx } = await mintWithBasketTracking(ctx, {
      description: `Create collection: ${name}`,
      outputDescription: 'Collection inscription',
      lockingScript,
      tags,
      customInstructions,
    });
    const ensured = await ensureMintInYoursBasket({
      txid,
      tx,
      tags,
      customInstructions,
      name,
    });
    if (!ensured.inBasket) {
      console.warn('[mint] collection broadcast but not yet visible in Yours 1sat basket', txid);
    }
    return { txid, collectionId: `${txid}_0`, inBasket: ensured.inBasket };
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
  const parentBytes = collectionIdToParentBytes(collectionId);
  const keyID = `${Date.now()}`;
  const { publicKey } = await ctx.wallet.getPublicKey({
    protocolID: P1SAT_PROTOCOL,
    keyID,
    counterparty: 'self',
    forSelf: true,
  });
  const address = PublicKey.fromString(publicKey).toAddress();
  const displayName = input.name.slice(0, 64) || 'Mashinal';
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
    'subType:collectionItem',
    `collection:${collectionId}`,
    'app:mashinals',
    `name:${displayName}`,
  ];
  const customInstructions = buildOrdinalCustomInstructions({
    protocolID: P1SAT_PROTOCOL,
    keyID,
    tags,
    name: displayName,
  });

  try {
    const { txid, tx } = await mintWithBasketTracking(ctx, {
      description: `Create collection item: ${displayName}`,
      outputDescription: 'Collection item inscription',
      lockingScript,
      tags,
      customInstructions,
    });
    const ensured = await ensureMintInYoursBasket({
      txid,
      tx,
      tags,
      customInstructions,
      name: displayName,
    });
    if (!ensured.inBasket) {
      throw new Error(
        'Mint broadcast, but Yours did not keep it in the ordinals basket. ' +
          'In Yours → Permissions, allow basket access for "1sat" on entangleit.com, then use Market → Sync wallet.',
      );
    }
    return { txid, origin: `${txid}_0`, inBasket: true };
  } catch (err) {
    throw wrapWalletError(err, 'Mint collection item');
  }
}
