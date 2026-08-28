/** Pixel-art character genes — layered 32×32 sprites, not vector chibis. */

export const PIXEL_SIZE = 32;

/** Semantic color slots used by every pixel part. 0 = transparent. */
export const COLOR_SLOTS = [
  'transparent',
  'outline',
  'skin',
  'skinShade',
  'hair',
  'hairShade',
  'eye',
  'eyeWhite',
  'mouth',
  'clothes',
  'clothesShade',
  'clothesAccent',
  'accessory',
  'accessoryAccent',
  'blush',
] as const;

export type ColorSlotName = (typeof COLOR_SLOTS)[number];

export interface PixelPalette {
  id: string;
  outline: string;
  skin: string;
  skinShade: string;
  hair: string;
  hairShade: string;
  eye: string;
  eyeWhite: string;
  mouth: string;
  clothes: string;
  clothesShade: string;
  clothesAccent: string;
  accessory: string;
  accessoryAccent: string;
  blush: string;
}

export interface PixelGenes {
  body: number;
  hair: number;
  eyes: number;
  mouth: number;
  clothes: number;
  accessory: number; // 0 = none
  palette: number;
}

export interface CharacterSpec {
  genes: PixelGenes;
}

/** Part kit counts — keep in sync with client pixel sprites. */
export const STYLE_COUNTS = {
  body: 4,
  hair: 6,
  eyes: 5,
  mouth: 5,
  clothes: 5,
  accessory: 5, // 0 = none
  palette: 12,
} as const;

export const PALETTES: PixelPalette[] = [
  {
    id: 'spark',
    outline: '#2a1810',
    skin: '#ffd0b8',
    skinShade: '#e8a888',
    hair: '#ffcc33',
    hairShade: '#e89400',
    eye: '#ff8800',
    eyeWhite: '#fff8e8',
    mouth: '#c45a4a',
    clothes: '#ffee88',
    clothesShade: '#ff9900',
    clothesAccent: '#ffffff',
    accessory: '#ffee55',
    accessoryAccent: '#ff6600',
    blush: '#ffb0a0',
  },
  {
    id: 'tide',
    outline: '#0a2a30',
    skin: '#ffe0d1',
    skinShade: '#f0b8a0',
    hair: '#1fa2a0',
    hairShade: '#0d7377',
    eye: '#0077b6',
    eyeWhite: '#e8f8ff',
    mouth: '#c45a6a',
    clothes: '#7fdbda',
    clothesShade: '#0077b6',
    clothesAccent: '#ffffff',
    accessory: '#00b4d8',
    accessoryAccent: '#ffd93d',
    blush: '#ffb8c8',
  },
  {
    id: 'pebble',
    outline: '#2a2018',
    skin: '#e8b090',
    skinShade: '#c08a68',
    hair: '#6b5b4b',
    hairShade: '#4a3c30',
    eye: '#5a4838',
    eyeWhite: '#f5efe6',
    mouth: '#8b5040',
    clothes: '#d4c4a8',
    clothesShade: '#8b7355',
    clothesAccent: '#fff8e8',
    accessory: '#a89070',
    accessoryAccent: '#5c4a3a',
    blush: '#d49080',
  },
  {
    id: 'gust',
    outline: '#1a2838',
    skin: '#ffe8dc',
    skinShade: '#f0c4b0',
    hair: '#e9f5f5',
    hairShade: '#b8d4e3',
    eye: '#457b9d',
    eyeWhite: '#ffffff',
    mouth: '#c07080',
    clothes: '#f1faee',
    clothesShade: '#a8dadc',
    clothesAccent: '#1d3557',
    accessory: '#a8dadc',
    accessoryAccent: '#ffffff',
    blush: '#ffc0d0',
  },
  {
    id: 'pixel',
    outline: '#0a1a0a',
    skin: '#ffd0b8',
    skinShade: '#e0a080',
    hair: '#39ff14',
    hairShade: '#0a7a2f',
    eye: '#39ff14',
    eyeWhite: '#111111',
    mouth: '#ff00aa',
    clothes: '#111111',
    clothesShade: '#39ff14',
    clothesAccent: '#ff00aa',
    accessory: '#ff00aa',
    accessoryAccent: '#39ff14',
    blush: '#ff80c0',
  },
  {
    id: 'meme',
    outline: '#1a0810',
    skin: '#ffd8c8',
    skinShade: '#e8a898',
    hair: '#ff2d55',
    hairShade: '#cc1040',
    eye: '#ff2d55',
    eyeWhite: '#fff8e0',
    mouth: '#cc2040',
    clothes: '#ffffff',
    clothesShade: '#ff2d55',
    clothesAccent: '#ffcc00',
    accessory: '#ffcc00',
    accessoryAccent: '#ff2d55',
    blush: '#ff90a8',
  },
  {
    id: 'heart',
    outline: '#3a1828',
    skin: '#ffe0d1',
    skinShade: '#f0b0a8',
    hair: '#ff8fb8',
    hairShade: '#e86a9a',
    eye: '#ff6b9d',
    eyeWhite: '#fff0f5',
    mouth: '#e05070',
    clothes: '#ffe0ef',
    clothesShade: '#ff6b9d',
    clothesAccent: '#ffffff',
    accessory: '#ffb6c1',
    accessoryAccent: '#ffffff',
    blush: '#ff9aad',
  },
  {
    id: 'glitch',
    outline: '#0a0018',
    skin: '#e8d0ff',
    skinShade: '#c090e0',
    hair: '#bf00ff',
    hairShade: '#7000aa',
    eye: '#00f5ff',
    eyeWhite: '#1a0033',
    mouth: '#ff00cc',
    clothes: '#1a0033',
    clothesShade: '#bf00ff',
    clothesAccent: '#00f5ff',
    accessory: '#00f5ff',
    accessoryAccent: '#bf00ff',
    blush: '#ff80e0',
  },
  {
    id: 'lava',
    outline: '#1a0800',
    skin: '#ffc8a0',
    skinShade: '#d08060',
    hair: '#ff4400',
    hairShade: '#aa2000',
    eye: '#ffaa00',
    eyeWhite: '#fff0e0',
    mouth: '#aa3030',
    clothes: '#331100',
    clothesShade: '#ff6600',
    clothesAccent: '#ffcc00',
    accessory: '#ffaa00',
    accessoryAccent: '#ff4400',
    blush: '#ff8060',
  },
  {
    id: 'mint',
    outline: '#0a2018',
    skin: '#ffe8d8',
    skinShade: '#e0b8a0',
    hair: '#3dffa8',
    hairShade: '#10aa70',
    eye: '#10aa88',
    eyeWhite: '#f0fff8',
    mouth: '#c05060',
    clothes: '#d0ffe8',
    clothesShade: '#20c090',
    clothesAccent: '#ffffff',
    accessory: '#20c090',
    accessoryAccent: '#ffd93d',
    blush: '#ffb0c0',
  },
  {
    id: 'noir',
    outline: '#000000',
    skin: '#e8e0d8',
    skinShade: '#b0a898',
    hair: '#222222',
    hairShade: '#000000',
    eye: '#444444',
    eyeWhite: '#ffffff',
    mouth: '#663344',
    clothes: '#333333',
    clothesShade: '#111111',
    clothesAccent: '#cccccc',
    accessory: '#888888',
    accessoryAccent: '#ffffff',
    blush: '#c09090',
  },
  {
    id: 'candy',
    outline: '#2a1030',
    skin: '#ffe8f0',
    skinShade: '#f0b8c8',
    hair: '#ff66cc',
    hairShade: '#cc3399',
    eye: '#66ccff',
    eyeWhite: '#ffffff',
    mouth: '#ff4488',
    clothes: '#ff99dd',
    clothesShade: '#ff66cc',
    clothesAccent: '#ffff66',
    accessory: '#ffff66',
    accessoryAccent: '#66ccff',
    blush: '#ff99bb',
  },
];

export function clampPart(index: number, count: number): number {
  if (!Number.isFinite(index) || count <= 0) return 0;
  const n = Math.trunc(index);
  return ((n % count) + count) % count;
}

export function defaultGenes(): PixelGenes {
  return {
    body: 0,
    hair: 0,
    eyes: 0,
    mouth: 0,
    clothes: 0,
    accessory: 0,
    palette: 0,
  };
}

export function defaultCharacterSpec(): CharacterSpec {
  return { genes: defaultGenes() };
}

export function clampCharacterSpec(partial?: Partial<CharacterSpec> | null): CharacterSpec {
  const genes = { ...defaultGenes(), ...partial?.genes };
  const c = STYLE_COUNTS;
  return {
    genes: {
      body: clampPart(genes.body, c.body),
      hair: clampPart(genes.hair, c.hair),
      eyes: clampPart(genes.eyes, c.eyes),
      mouth: clampPart(genes.mouth, c.mouth),
      clothes: clampPart(genes.clothes, c.clothes),
      accessory: clampPart(genes.accessory, c.accessory),
      palette: clampPart(genes.palette, c.palette),
    },
  };
}

export function getPalette(index: number): PixelPalette {
  return PALETTES[clampPart(index, PALETTES.length)]!;
}

/** Resolve a palette slot name to a hex color. */
export function resolveSlot(palette: PixelPalette, slot: number): string | null {
  if (slot <= 0) return null;
  const map: Record<number, string> = {
    1: palette.outline,
    2: palette.skin,
    3: palette.skinShade,
    4: palette.hair,
    5: palette.hairShade,
    6: palette.eye,
    7: palette.eyeWhite,
    8: palette.mouth,
    9: palette.clothes,
    10: palette.clothesShade,
    11: palette.clothesAccent,
    12: palette.accessory,
    13: palette.accessoryAccent,
    14: palette.blush,
  };
  return map[slot] ?? null;
}

export function validateGenes(spec: CharacterSpec): boolean {
  const g = spec.genes;
  const c = STYLE_COUNTS;
  return (
    g.body >= 0 &&
    g.body < c.body &&
    g.hair >= 0 &&
    g.hair < c.hair &&
    g.eyes >= 0 &&
    g.eyes < c.eyes &&
    g.mouth >= 0 &&
    g.mouth < c.mouth &&
    g.clothes >= 0 &&
    g.clothes < c.clothes &&
    g.accessory >= 0 &&
    g.accessory < c.accessory &&
    g.palette >= 0 &&
    g.palette < c.palette
  );
}
