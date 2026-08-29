/**
 * GatchaGo-compatible mint into Yours:
 * - basket: "p 1sat ordinals"
 * - protocolID: [0, "p 1sat"]
 * - plain inscription (NO Sigma)
 *
 * Deliberately does NOT call migrateLegacyP1SatBaskets — that rewrote the user's
 * whole ordinal inventory and correlated with missing legacy assets + sweep
 * WERR_REVIEW_ACTIONS ("Undelayed createAction or signAction results require review").
 */

import {
  executeTrackedAction,
  randomActionId,
  type OneSatContext,
} from '@1sat/actions';
import type { CollectionItemTrait } from '@1sat/types';
import { Inscription, MAP as MAPTemplate } from '@1sat/templates';
import { P2PKH, PublicKey, Script, Utils } from '@bsv/sdk';
import { getActiveContext, wrapWalletError } from './yours';

/** Live GatchaGo onesat bundle: Br="p 1sat ordinals" */
export const GATCHAGO_ORDINALS_BASKET = 'p 1sat ordinals';
/** Live GatchaGo: qe=[0,"p 1sat"] */
export const GATCHAGO_PROTOCOL = [0, 'p 1sat'] as [0, string];

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

async function mintPlainOrdinal(input: {
  ctx: OneSatContext;
  description: string;
  outputDescription: string;
  lockingScript: Script;
  tags: string[];
  keyID: string;
  name: string;
}): Promise<{ txid: string; origin: string }> {
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
        // Delayed broadcast avoids WERR_REVIEW_ACTIONS on transient broadcast issues.
        acceptDelayedBroadcast: true,
        randomizeOutputs: false,
      },
    },
    undefined,
    undefined,
    undefined,
    {
      spends: [],
      usePermissionModule: false,
      bypassP1Sat: true,
    },
  );

  if (!result.txid) {
    throw new Error(result.error ?? 'no-txid-returned');
  }
  const txid = result.txid.toLowerCase();
  return { txid, origin: `${txid}_0` };
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

    const { txid } = await mintPlainOrdinal({
      ctx,
      description: `Create collection: ${name}`,
      outputDescription: 'Collection inscription',
      lockingScript,
      tags,
      keyID,
      name,
    });
    return { txid, collectionId: `${txid}_0`, inBasket: true };
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

    const { txid, origin } = await mintPlainOrdinal({
      ctx,
      description: `Create collection item: ${displayName}`,
      outputDescription: 'Collection item inscription',
      lockingScript,
      tags,
      keyID,
      name: displayName,
    });
    return { txid, origin, inBasket: true };
  } catch (err) {
    throw wrapWalletError(err, 'Mint collection item');
  }
}
