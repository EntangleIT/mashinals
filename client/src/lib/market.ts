/**
 * Mashinals market — browse 1Sat orderbook listings + helpers.
 * Listings live on the global 1Sat orderbook (api.1sat.app); we filter to Mashinals.
 */

import { fetchFeed } from './api';
import {
  contentUrl,
  formatSats,
  getOneSatServices,
  toDotOutpoint,
  toUnderscoreOutpoint,
} from './yours';

export type MashListing = {
  /** Listing (OrdLock) outpoint — use this for buy */
  listingOutpoint: string;
  /** Origin inscription outpoint */
  origin: string;
  name: string;
  priceSats: number;
  seller: string | null;
  contentType: string;
  imageUrl: string;
  score?: number;
};

type OrdlockData = {
  content_type?: string;
  name?: string;
  origin?: string;
  price?: number;
  seller?: string;
};

type ListingRow = {
  outpoint?: string;
  score?: number;
  data?: { ordlock?: OrdlockData; list?: { price?: number }; map?: { app?: string; name?: string } };
  origin?: { outpoint?: string; data?: { map?: { app?: string; name?: string } } };
};

function asListing(row: ListingRow, fallbackOrigin?: string): MashListing | null {
  const lock = row.data?.ordlock;
  const originRaw = lock?.origin ?? row.origin?.outpoint ?? fallbackOrigin;
  if (!originRaw || !row.outpoint) return null;
  const price = lock?.price ?? row.data?.list?.price;
  if (typeof price !== 'number' || price < 1) return null;
  const name =
    lock?.name ??
    row.data?.map?.name ??
    row.origin?.data?.map?.name ??
    'Mashinal';
  const origin = toUnderscoreOutpoint(originRaw);
  return {
    listingOutpoint: toUnderscoreOutpoint(row.outpoint),
    origin,
    name,
    priceSats: price,
    seller: lock?.seller ?? null,
    contentType: lock?.content_type ?? 'image/png',
    imageUrl: contentUrl(origin),
    score: row.score,
  };
}

function isMashinalRow(row: ListingRow, mashOrigins: Set<string>): boolean {
  const app =
    row.data?.map?.app ??
    row.origin?.data?.map?.app ??
    null;
  if (app === 'mashinals') return true;
  const origin = row.data?.ordlock?.origin ?? row.origin?.outpoint;
  if (!origin) return false;
  return mashOrigins.has(toUnderscoreOutpoint(origin));
}

/** Active Mashinal listings from the global orderbook. */
export async function fetchMashinalListings(limit = 60): Promise<MashListing[]> {
  const services = getOneSatServices();
  const feed = await fetchFeed(100);
  const live = feed.filter((i) => i.origin && !i.demo);
  const mashOrigins = new Set(live.map((i) => toUnderscoreOutpoint(i.origin!)));
  const nameByOrigin = new Map(live.map((i) => [toUnderscoreOutpoint(i.origin!), i.name]));

  const byOrigin: MashListing[] = [];
  if (live.length) {
    try {
      const dots = live.map((i) => toDotOutpoint(i.origin!));
      const map = (await services.market.getListingsByOrigins(dots)) as Record<
        string,
        ListingRow | null | undefined
      >;
      for (const [key, row] of Object.entries(map)) {
        if (!row) continue;
        const listing = asListing(row, key);
        if (!listing) continue;
        if (!listing.name || listing.name === 'Mashinal') {
          listing.name = nameByOrigin.get(listing.origin) ?? listing.name;
        }
        byOrigin.push(listing);
      }
    } catch (err) {
      console.warn('[market] getListingsByOrigins failed', err);
    }
  }

  // Also scan recent image listings and keep Mashinals (by app or known origin).
  let scanned: MashListing[] = [];
  try {
    const rows = (await services.market.searchListings({
      status: 'active',
      type: 'image/png',
      limit,
      rev: true,
    })) as ListingRow[];
    scanned = rows
      .filter((r) => isMashinalRow(r, mashOrigins))
      .map((r) => asListing(r))
      .filter((x): x is MashListing => Boolean(x));
  } catch (err) {
    console.warn('[market] searchListings failed', err);
  }

  const merged = new Map<string, MashListing>();
  for (const item of [...byOrigin, ...scanned]) {
    merged.set(item.origin, item);
  }
  return [...merged.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

export { formatSats, contentUrl };
