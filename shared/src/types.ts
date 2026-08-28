import type { CharacterSpec } from './character.js';

export interface MashinalRecord {
  id: string;
  name: string;
  caption: string;
  generation: number;
  parentAId: string | null;
  parentBId: string | null;
  parentAName: string | null;
  parentBName: string | null;
  parentAOrigin: string | null;
  parentBOrigin: string | null;
  recipeKey: string;
  spec: CharacterSpec;
  discoveredAt: number;
  /** On-chain origin outpoint (txid_vout) when inscribed */
  origin: string | null;
  txid: string | null;
  /** Demo / local preview inscription (not on-chain) */
  demoOrigin: string | null;
  /** Content hash of inscribed pixel art */
  svgHash: string | null;
  isStarter: boolean;
  isDiscovery: boolean;
}

export interface Recipe {
  recipeKey: string;
  parentAId: string;
  parentBId: string;
  childId: string;
  childName: string;
  firstDiscoveredAt: number;
  discoveryCount: number;
}

export interface InscriptionMeta {
  app: 'mashinals';
  type: 'ord';
  name: string;
  caption: string;
  recipe: string;
  generation: string;
  genes: string;
  parentA?: string;
  parentB?: string;
  parentAOrigin?: string;
  parentBOrigin?: string;
}

export interface PublicFeedItem {
  id: string;
  name: string;
  caption: string;
  generation: number;
  parentAName: string | null;
  parentBName: string | null;
  origin: string | null;
  txid: string | null;
  demo: boolean;
  inscribedAt: number;
  svgHash: string | null;
  specJson: string;
}

export const APP_ID = 'mashinals' as const;
