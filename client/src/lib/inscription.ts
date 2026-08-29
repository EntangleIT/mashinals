import type { InscriptionMeta, MashinalRecord } from '@mashinals/shared';
import type { CollectionItemTrait } from '@1sat/types';
import { capturePngBase64, hashPixels } from '../pixel/render';
import {
  fetchOrdinalsConfig,
  nextMintNumber,
  registerCollection,
} from './api';
import {
  getActiveContext,
  mintCollectionItemWithYours,
  mintCollectionWithYours,
  wrapWalletError,
} from './yours';

export interface InscribeResult {
  demo: boolean;
  txid: string;
  origin: string;
  svgHash: string;
  message: string;
  mintNumber?: number;
  collectionId?: string;
  destination?: string;
}

function buildMeta(record: MashinalRecord): InscriptionMeta {
  return {
    app: 'mashinals',
    type: 'ord',
    name: record.name,
    caption: record.caption,
    recipe:
      record.parentAName && record.parentBName
        ? `${record.parentAName} + ${record.parentBName} = ${record.name}`
        : record.name,
    generation: String(record.generation),
    genes: JSON.stringify(record.spec.genes),
    ...(record.parentAName ? { parentA: record.parentAName } : {}),
    ...(record.parentBName ? { parentB: record.parentBName } : {}),
    ...(record.parentAOrigin ? { parentAOrigin: record.parentAOrigin } : {}),
    ...(record.parentBOrigin ? { parentBOrigin: record.parentBOrigin } : {}),
  };
}

function mashTraits(record: MashinalRecord): CollectionItemTrait[] {
  const g = record.spec.genes;
  const traits: CollectionItemTrait[] = [
    { name: 'body', value: String(g.body) },
    { name: 'hair', value: String(g.hair) },
    { name: 'eyes', value: String(g.eyes) },
    { name: 'mouth', value: String(g.mouth) },
    { name: 'clothes', value: String(g.clothes) },
    { name: 'accessory', value: String(g.accessory) },
    { name: 'palette', value: String(g.palette) },
    { name: 'generation', value: String(record.generation) },
  ];
  if (record.parentAName) traits.push({ name: 'parentA', value: record.parentAName });
  if (record.parentBName) traits.push({ name: 'parentB', value: record.parentBName });
  if (record.caption) traits.push({ name: 'caption', value: record.caption.slice(0, 120) });
  return traits;
}

/** Local preview ordinal — clearly not on-chain. */
export async function demoInscribe(record: MashinalRecord): Promise<InscribeResult> {
  const svgHash = await hashPixels(record.spec);
  const id = `demo_${Date.now().toString(16)}_${svgHash.slice(0, 8)}`;
  const payload = {
    contentType: 'image/png',
    metaData: buildMeta(record),
    svgHash,
    note: 'DEMO ONLY — NOT ON-CHAIN',
  };
  try {
    localStorage.setItem(`mashinals:demo-ord:${id}`, JSON.stringify(payload));
  } catch {
    // ignore
  }
  return {
    demo: true,
    txid: id,
    origin: `${id}_0`,
    svgHash,
    message:
      'Demo inscription saved locally (NOT on-chain). Pixel PNG + metadata are ready; connect Yours Wallet to mint for real.',
  };
}

/**
 * Deploy the Mashinals collection parent once (GatchaGo-style), then register it
 * with the Worker so item mints can attach via collectionId.
 */
export async function initializeMashinalsCollection(coverRecord: MashinalRecord): Promise<{
  txid: string;
  collectionId: string;
}> {
  if (!getActiveContext()) {
    throw new Error('Connect Yours Wallet before deploying the Mashinals collection.');
  }
  const existing = await fetchOrdinalsConfig();
  if (existing.ready && existing.collectionId) {
    return {
      txid: existing.coverTxid ?? existing.collectionId.split('_')[0]!,
      collectionId: existing.collectionId,
    };
  }

  const dataB64 = capturePngBase64(coverRecord.spec);
  const { txid, collectionId } = await mintCollectionWithYours({
    base64Content: dataB64,
    contentType: 'image/png',
    name: 'Mashinals',
    quantity: 1_000_000,
  });
  try {
    await registerCollection({ collectionId, quantity: 1_000_000, coverTxid: txid });
  } catch (err) {
    // Another client may have won the race — use whatever the Worker has.
    const again = await fetchOrdinalsConfig();
    if (again.ready && again.collectionId) {
      return {
        txid: again.coverTxid ?? again.collectionId.split('_')[0]!,
        collectionId: again.collectionId,
      };
    }
    throw err;
  }
  return { txid, collectionId };
}

/**
 * Inscribe a Mashinal as a 1Sat collection item via Yours — same path as live
 * GatchaGo (`mintCollectionItem` into the ordinals basket).
 */
export async function inscribeMashinal(record: MashinalRecord): Promise<InscribeResult> {
  if (!getActiveContext()) {
    throw new Error('Connect Yours Wallet before inscribing on-chain.');
  }

  const dataB64 = capturePngBase64(record.spec);
  const svgHash = await hashPixels(record.spec);

  try {
    let config = await fetchOrdinalsConfig();
    if (!config.ready || !config.collectionId) {
      const deployed = await initializeMashinalsCollection(record);
      config = {
        app: 'mashinals',
        ready: true,
        collectionId: deployed.collectionId,
        quantity: 1_000_000,
      };
    }

    const { mintNumber, collectionId } = await nextMintNumber();
    const { txid, origin } = await mintCollectionItemWithYours({
      base64Content: dataB64,
      contentType: 'image/png',
      name: record.name,
      collectionId,
      mintNumber,
      traits: mashTraits(record),
    });

    try {
      localStorage.setItem(
        `mashinals:inscribed:${record.id}`,
        JSON.stringify({
          txid,
          origin,
          collectionId,
          mintNumber,
          svgHash,
          meta: buildMeta(record),
          at: Date.now(),
        }),
      );
    } catch {
      // ignore
    }

    return {
      demo: false,
      txid,
      origin,
      svgHash,
      mintNumber,
      collectionId,
      destination: 'yours-ordinals-basket',
      message: `Inscribed #${mintNumber} — origin ${origin}. It should now show under Yours → Ordinals (basket 1sat). Do not mint again.`,
    };
  } catch (err) {
    throw wrapWalletError(err, 'Inscribe');
  }
}

export function genesSummary(record: MashinalRecord): string {
  const g = record.spec.genes;
  return `b${g.body} h${g.hair} e${g.eyes} m${g.mouth} c${g.clothes} a${g.accessory} p${g.palette}`;
}
