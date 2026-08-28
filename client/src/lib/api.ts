import type { MashinalRecord, PublicFeedItem } from '@mashinals/shared';

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '/api';

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

export async function reportInscription(record: MashinalRecord, opts: {
  origin: string;
  txid: string;
  demo: boolean;
  svgHash: string;
}): Promise<boolean> {
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
