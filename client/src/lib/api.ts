import type { MashinalRecord, PublicFeedItem } from '@mashinals/shared';

/** Same-origin API under /mashinals/api in prod; /api via Vite proxy in local client. */
const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') ||
  (import.meta.env.BASE_URL === '/mashinals/' ? '/mashinals/api' : '/api');

async function req<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchFeed(limit = 40): Promise<PublicFeedItem[]> {
  const data = await req<{ items: PublicFeedItem[] }>(`/feed?limit=${limit}`);
  return data?.items ?? [];
}

export async function reportInscription(
  record: MashinalRecord,
  opts: {
    origin: string;
    txid: string;
    demo: boolean;
    svgHash: string;
  },
): Promise<boolean> {
  const res = await req<{ ok: boolean }>('/inscriptions', {
    method: 'POST',
    body: JSON.stringify({
      id: record.id,
      name: record.name,
      caption: record.caption,
      generation: record.generation,
      parentAName: record.parentAName,
      parentBName: record.parentBName,
      parentAOrigin: record.parentAOrigin,
      parentBOrigin: record.parentBOrigin,
      recipeKey: record.recipeKey,
      origin: opts.origin,
      txid: opts.txid,
      demo: opts.demo,
      svgHash: opts.svgHash,
      spec: record.spec,
      genes: record.spec.genes,
    }),
  });
  return Boolean(res?.ok);
}

export async function reportRecipe(payload: {
  recipeKey: string;
  parentAId: string;
  parentBId: string;
  childId: string;
  childName: string;
}): Promise<void> {
  await req('/recipes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type OrdinalsConfig = {
  app: string;
  ready: boolean;
  collectionId: string | null;
  quantity: number;
  nextMintNumber?: number;
  coverTxid?: string | null;
};

export async function fetchOrdinalsConfig(): Promise<OrdinalsConfig> {
  const data = await req<OrdinalsConfig>('/ordinals/config');
  return (
    data ?? {
      app: 'mashinals',
      ready: false,
      collectionId: null,
      quantity: 1_000_000,
    }
  );
}

export async function registerCollection(input: {
  collectionId: string;
  quantity?: number;
  coverTxid?: string;
}): Promise<OrdinalsConfig & { ok?: boolean; error?: string }> {
  const res = await fetch(`${API_BASE}/ordinals/collection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => ({}))) as OrdinalsConfig & {
    ok?: boolean;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || `Failed to register collection (${res.status})`);
  }
  return data;
}

export async function nextMintNumber(): Promise<{
  mintNumber: number;
  collectionId: string;
  remaining: number;
}> {
  const res = await fetch(`${API_BASE}/ordinals/next-mint-number`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const data = (await res.json().catch(() => ({}))) as {
    mintNumber?: number;
    collectionId?: string;
    remaining?: number;
    error?: string;
  };
  if (!res.ok || data.mintNumber == null || !data.collectionId) {
    throw new Error(data.error || `Could not reserve mint number (${res.status})`);
  }
  return {
    mintNumber: data.mintNumber,
    collectionId: data.collectionId,
    remaining: data.remaining ?? 0,
  };
}
