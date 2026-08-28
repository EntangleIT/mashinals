import type { InscriptionMeta, MashinalRecord } from '@mashinals/shared';
import { capturePngBase64, hashPixels } from '../pixel/render';
import type { WalletSession } from './wallet';

export interface InscribeResult {
  demo: boolean;
  txid: string;
  origin: string;
  svgHash: string;
  message: string;
}

export interface BuiltInscription {
  dataB64: string;
  contentType: 'image/png';
  metaData: InscriptionMeta;
  ordinalAddress: string;
  paymentAddress: string | null;
  svgHash: string;
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

/** Build the 1Sat inscription payload (tiny PNG + MAP metadata). */
export async function buildInscriptionPayload(
  record: MashinalRecord,
  wallet: WalletSession,
): Promise<BuiltInscription> {
  if (!wallet.ordinalAddress) {
    throw new Error('Ordinal address required');
  }
  const dataB64 = capturePngBase64(record.spec);
  const svgHash = await hashPixels(record.spec);
  return {
    dataB64,
    contentType: 'image/png',
    metaData: buildMeta(record),
    ordinalAddress: wallet.ordinalAddress,
    paymentAddress: wallet.paymentAddress,
    svgHash,
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
      'Demo inscription saved locally (NOT on-chain). Pixel PNG + metadata are ready; connect a wallet to mint for real.',
  };
}

/**
 * Inscribe a Mashinal as a 1SatOrdinal.
 * Client builds the PNG payload and MAP metadata; wallet signs/broadcasts.
 * Never holds private keys on a worker.
 */
export async function inscribeMashinal(
  record: MashinalRecord,
  wallet: WalletSession,
): Promise<InscribeResult> {
  if (!wallet.connected || !wallet.ordinalAddress) {
    throw new Error('Connect a wallet before inscribing on-chain.');
  }

  const built = await buildInscriptionPayload(record, wallet);

  // 1) Provider-native inscribe (1sat.market / onesat extension)
  const onesat = (
    window as unknown as {
      onesat?: {
        inscribe?: (req: {
          dataB64: string;
          contentType: string;
          metaData: InscriptionMeta;
          address: string;
        }) => Promise<{ txid?: string; origin?: string }>;
      };
    }
  ).onesat;

  if (onesat?.inscribe) {
    const res = await onesat.inscribe({
      dataB64: built.dataB64,
      contentType: built.contentType,
      metaData: built.metaData,
      address: built.ordinalAddress,
    });
    const txid = res.txid ?? `pending_${Date.now().toString(16)}`;
    return {
      demo: false,
      txid,
      origin: res.origin ?? `${txid}_0`,
      svgHash: built.svgHash,
      message: 'Inscription broadcast via wallet provider.',
    };
  }

  // 2) Build createOrdinals config via js-1sat-ord (proves stack wiring).
  // Live broadcast still needs wallet-funded UTXOs + paymentPk from the wallet —
  // we never invent a hot key in the browser app.
  try {
    const mod = await import('js-1sat-ord');
    const createOrdinals = mod.createOrdinals as (config: unknown) => Promise<unknown>;
    const config = {
      utxos: [] as unknown[],
      destinations: [
        {
          address: built.ordinalAddress,
          inscription: {
            dataB64: built.dataB64,
            contentType: built.contentType,
          },
        },
      ],
      metaData: built.metaData,
      changeAddress: built.paymentAddress ?? built.ordinalAddress,
    };

    try {
      localStorage.setItem(
        `mashinals:pending-inscribe:${record.id}`,
        JSON.stringify({
          ...config,
          builtAt: Date.now(),
          svgHash: built.svgHash,
          library: 'js-1sat-ord',
        }),
      );
    } catch {
      // ignore
    }

    // Attempting createOrdinals without utxos/paymentPk will fail — that's expected
    // until the wallet supplies them. Keep the import live so bundlers include the lib.
    if (typeof createOrdinals === 'function') {
      // no-op call path documented for wallet integration
      void config;
    }
  } catch (err) {
    console.warn('js-1sat-ord import/build note', err);
  }

  throw new Error(
    'Inscription payload built (32×32 PNG + MAP: name, caption, parents, genes, app=mashinals). ' +
      'Your wallet did not expose inscribe() / UTXOs for createOrdinals. ' +
      'Use Demo Inscribe to preview the full UX, or complete signing in a 1Sat-compatible wallet.',
  );
}

export function genesSummary(record: MashinalRecord): string {
  const g = record.spec.genes;
  return `b${g.body} h${g.hair} e${g.eyes} m${g.mouth} c${g.clothes} a${g.accessory} p${g.palette}`;
}
