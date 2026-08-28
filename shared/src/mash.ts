import {
  STYLE_COUNTS,
  clampCharacterSpec,
  clampPart,
  type CharacterSpec,
  type PixelGenes,
} from './character.js';

/** Stable recipe key — order-independent so A+B === B+A. */
export function recipeKey(idA: string, idB: string): string {
  return [idA, idB].sort().join('::');
}

/** Deterministic 32-bit hash (FNV-1a style). */
export function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export class SeededRng {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0x100000000;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]!;
  }
  bool(p = 0.5): boolean {
    return this.next() < p;
  }
  int(max: number): number {
    return Math.floor(this.next() * max);
  }
}

function pickParent<T>(a: T, b: T, rng: SeededRng): T {
  return rng.bool() ? a : b;
}

function mixStyle(a: number, b: number, count: number, rng: SeededRng, mutateP = 0.08): number {
  if (rng.next() < mutateP) return clampPart(rng.int(count), count);
  return clampPart(pickParent(a, b, rng), count);
}

/** Deterministic genetic mix of two parent pixel gene sets. */
export function mashGenes(parentA: CharacterSpec, parentB: CharacterSpec, seed: number): CharacterSpec {
  const rng = new SeededRng(seed);
  const a = clampCharacterSpec(parentA).genes;
  const b = clampCharacterSpec(parentB).genes;
  const c = STYLE_COUNTS;

  const genes: PixelGenes = {
    body: mixStyle(a.body, b.body, c.body, rng),
    hair: mixStyle(a.hair, b.hair, c.hair, rng),
    eyes: mixStyle(a.eyes, b.eyes, c.eyes, rng),
    mouth: mixStyle(a.mouth, b.mouth, c.mouth, rng),
    clothes: mixStyle(a.clothes, b.clothes, c.clothes, rng),
    accessory: mixStyle(a.accessory, b.accessory, c.accessory, rng, 0.1),
    palette: mixStyle(a.palette, b.palette, c.palette, rng, 0.12),
  };

  // Soft spice: sometimes grow an accessory if both parents lacked one
  if (genes.accessory === 0 && rng.next() < 0.15) {
    genes.accessory = clampPart(1 + rng.int(c.accessory - 1), c.accessory);
  }

  return clampCharacterSpec({ genes });
}

const SUFFIXES = ['core', 'wave', 'bit', 'pop', 'zap', 'ling', 'nox', 'bloom', 'kit', 'verse'];
const CAPTION_TEMPLATES = [
  '{name} just dropped. The timeline will never recover.',
  'Nobody asked for {name}. Everybody needed {name}.',
  '{a} + {b} = pure chaos. Meet {name}.',
  'Certified viral specimen: {name}. Handle with memes.',
  '{name} entered the chat and left the building.',
  'Lineage unlocked: {a} × {b} → {name}.',
  'This is fine. This is {name}. This is forever.',
  'Inscribe {name} or it didn’t happen.',
  '{name} hits different at block height forever.',
  'Soft launch, hard vibes: {name}.',
];

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Deterministic name mash from two parent names. */
export function mashName(nameA: string, nameB: string, seed: number): string {
  const rng = new SeededRng(seed ^ 0xabcdef);
  const a = nameA.replace(/[^a-zA-Z]/g, '') || 'Thing';
  const b = nameB.replace(/[^a-zA-Z]/g, '') || 'Thing';
  const mode = rng.int(5);
  let raw: string;
  if (mode === 0) {
    const cut = Math.max(2, Math.ceil(a.length * 0.55));
    raw = a.slice(0, cut) + b.slice(Math.floor(b.length * 0.4));
  } else if (mode === 1) {
    const cut = Math.max(2, Math.ceil(b.length * 0.55));
    raw = b.slice(0, cut) + a.slice(Math.floor(a.length * 0.4));
  } else if (mode === 2) {
    raw = a.slice(0, Math.max(2, Math.ceil(a.length / 2))) + b;
  } else if (mode === 3) {
    raw = a + rng.pick(SUFFIXES);
  } else {
    raw = a.slice(0, 3) + b.slice(0, 3) + rng.pick(['o', 'i', 'y', '']);
  }
  raw = raw.replace(/(.)\1{2,}/g, '$1$1').slice(0, 16);
  return titleCase(raw);
}

export function mashCaption(name: string, parentA: string, parentB: string, seed: number): string {
  const rng = new SeededRng(seed ^ 0x123456);
  const tpl = CAPTION_TEMPLATES[rng.int(CAPTION_TEMPLATES.length)]!;
  return tpl.replaceAll('{name}', name).replaceAll('{a}', parentA).replaceAll('{b}', parentB);
}

export interface MashParents {
  id: string;
  name: string;
  generation: number;
  spec: CharacterSpec;
  origin?: string | null;
}

export interface MashResult {
  recipeKey: string;
  name: string;
  caption: string;
  generation: number;
  spec: CharacterSpec;
  parentAId: string;
  parentBId: string;
  parentAName: string;
  parentBName: string;
  parentAOrigin: string | null;
  parentBOrigin: string | null;
  seed: number;
}

/** Same parents always yield the same child (Infinite Craft recipes). */
export function mashCharacters(a: MashParents, b: MashParents): MashResult {
  const key = recipeKey(a.id, b.id);
  const seed = hash32(key);
  const [left, right] = a.id <= b.id ? [a, b] : [b, a];
  const spec = mashGenes(left.spec, right.spec, seed);
  const name = mashName(left.name, right.name, seed);
  const caption = mashCaption(name, left.name, right.name, seed);
  return {
    recipeKey: key,
    name,
    caption,
    generation: Math.max(left.generation, right.generation) + 1,
    spec,
    parentAId: left.id,
    parentBId: right.id,
    parentAName: left.name,
    parentBName: right.name,
    parentAOrigin: left.origin ?? null,
    parentBOrigin: right.origin ?? null,
    seed,
  };
}

export function childIdFromRecipe(recipeKeyStr: string): string {
  return `mash_${hash32(recipeKeyStr).toString(16)}`;
}
