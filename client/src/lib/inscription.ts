import type { InscriptionMeta, MashinalRecord } from '@mashinals/shared';
import { capturePngBase64, hashPixels } from '../pixel/render';
import { getActiveContext, inscribeWithYours, metaToMap, wrapWalletError } from './yours';

export interface InscribeResult {
  demo: boolean;
  txid: string;
  origin: string;
  svgHash: string;
  message: string;
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
 * Inscribe a Mashinal as a 1SatOrdinal via Yours Wallet (@1sat/actions).
 * Client builds PNG + MAP; wallet signs & broadcasts. No hot keys in the app.
 */
export async function inscribeMashinal(record: MashinalRecord): Promise<InscribeResult> {
  if (!getActiveContext()) {
    throw new Error('Connect Yours Wallet before inscribing on-chain.');
  }

  const dataB64 = capturePngBase64(record.spec);
  const svgHash = await hashPixels(record.spec);
  const meta = buildMeta(record);

  try {
    const { txid, origin } = await inscribeWithYours({
      base64Content: dataB64,
      contentType: 'image/png',
      map: metaToMap(meta),
    });

    try {
      localStorage.setItem(
        `mashinals:inscribed:${record.id}`,
        JSON.stringify({ txid, origin, svgHash, meta, at: Date.now() }),
      );
    } catch {
      // ignore
    }

    return {
      demo: false,
      txid,
      origin,
      svgHash,
      message: `Inscribed on-chain via Yours Wallet. Origin ${origin}`,
    };
  } catch (err) {
    throw wrapWalletError(err, 'Inscribe');
  }
}

export function genesSummary(record: MashinalRecord): string {
  const g = record.spec.genes;
  return `b${g.body} h${g.hair} e${g.eyes} m${g.mouth} c${g.clothes} a${g.accessory} p${g.palette}`;
}
