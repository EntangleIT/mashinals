/**
 * Compact pixel-part encoding for 32×32 Mashinals sprites.
 *
 * . = transparent
 * O = outline   S = skin      D = skinShade
 * H = hair      R = hairShade E = eye       W = eyeWhite
 * M = mouth     C = clothes   K = clothesShade  A = clothesAccent
 * X = accessory Y = accessoryAccent  B = blush
 */

export const SLOT_CHARS: Record<string, number> = {
  '.': 0,
  O: 1,
  S: 2,
  D: 3,
  H: 4,
  R: 5,
  E: 6,
  W: 7,
  M: 8,
  C: 9,
  K: 10,
  A: 11,
  X: 12,
  Y: 13,
  B: 14,
};

export type PixelLayer = number[]; // length PIXEL_SIZE², row-major slot indices

export function parseLayer(rows: string[]): PixelLayer {
  const size = 32;
  const out = new Array<number>(size * size).fill(0);
  for (let y = 0; y < size; y++) {
    const row = rows[y] ?? '';
    for (let x = 0; x < size; x++) {
      const ch = row[x] ?? '.';
      out[y * size + x] = SLOT_CHARS[ch] ?? 0;
    }
  }
  return out;
}

function pad(rows: string[]): string[] {
  return rows.map((r) => r.padEnd(32, '.').slice(0, 32));
}

/** Body silhouettes — head + torso + stubby limbs. */
export const BODIES: PixelLayer[] = [
  // 0 classic chibi
  parseLayer(
    pad([
      '................................',
      '................................',
      '................................',
      '................................',
      '..........OOOOOOOO..............',
      '.........OSSSSSSSSO.............',
      '........OSSSSSSSSSSO............',
      '.......OSSSSSSSSSSSSO...........',
      '.......OSSSSSSSSSSSSO...........',
      '.......OSSSSSSSSSSSSO...........',
      '.......OSSSSSSSSSSSSO...........',
      '.......OSSSDDSSSSSSSO...........',
      '........OSSSSSSSSSSO............',
      '.........OSSSSSSSSO.............',
      '..........OOOOOOOO..............',
      '...........OSSDSSO..............',
      '.........OOSSSSSSSOO............',
      '........OSSSSSSSSSSO............',
      '.......OSSSSSSSSSSSSO...........',
      '......OOSSSSSSSSSSSSOO..........',
      '.....OSS.OSSSSSSSSO.SSO.........',
      '.....OS...OSSSSSSO...SO.........',
      '.....OO....OSSSSO....OO.........',
      '............OSSSO...............',
      '...........OSSSSSO..............',
      '..........OSSO.OSSO.............',
      '..........OSSO.OSSO.............',
      '..........ODDO.ODDO.............',
      '..........OOOO.OOOO.............',
      '................................',
      '................................',
      '................................',
    ]),
  ),
  // 1 taller slim
  parseLayer(
    pad([
      '................................',
      '................................',
      '................................',
      '...........OOOOOO...............',
      '..........OSSSSSSO..............',
      '.........OSSSSSSSSO.............',
      '........OSSSSSSSSSSO............',
      '........OSSSSSSSSSSO............',
      '........OSSSSSSSSSSO............',
      '........OSSSSSSSSSSO............',
      '........OSSSDDDSSSSO............',
      '.........OSSSSSSSSO.............',
      '..........OSSSSSSO..............',
      '...........OOOOOO...............',
      '...........OSSDSO...............',
      '..........OSSSSSSO..............',
      '.........OSSSSSSSSO.............',
      '........OSSSSSSSSSSO............',
      '.......OOSSSSSSSSSSOO...........',
      '......OS..OSSSSSSO..SO..........',
      '......OO...OSSSSO...OO..........',
      '............OSSSO...............',
      '............OSSSO...............',
      '...........OSSSSSO..............',
      '..........OSSO.OSSO.............',
      '..........OSSO.OSSO.............',
      '..........OSSO.OSSO.............',
      '..........ODDO.ODDO.............',
      '..........OOOO.OOOO.............',
      '................................',
      '................................',
      '................................',
    ]),
  ),
  // 2 round soft
  parseLayer(
    pad([
      '................................',
      '................................',
      '................................',
      '.........OOOOOOOOOO.............',
      '........OSSSSSSSSSSO............',
      '.......OSSSSSSSSSSSSO...........',
      '......OSSSSSSSSSSSSSSO..........',
      '......OSSSSSSSSSSSSSSO..........',
      '......OSSSSSSSSSSSSSSO..........',
      '......OSSSSSSSSSSSSSSO..........',
      '......OSSSSDDDDSSSSSSO..........',
      '.......OSSSSSSSSSSSSO...........',
      '........OSSSSSSSSSSO............',
      '.........OOOOOOOOOO.............',
      '..........OSSDSSSO..............',
      '........OOSSSSSSSSOO............',
      '.......OSSSSSSSSSSSSO...........',
      '......OSSSSSSSSSSSSSSO..........',
      '.....OOSSSSSSSSSSSSSSOO.........',
      '....OS..OSSSSSSSSSSO..SO........',
      '....OO...OSSSSSSSSO...OO........',
      '..........OSSSSSSO..............',
      '...........OSSSSO...............',
      '..........OSSSSSSO..............',
      '.........OSSO..OSSO.............',
      '.........OSSO..OSSO.............',
      '.........ODDO..ODDO.............',
      '.........OOOO..OOOO.............',
      '................................',
      '................................',
      '................................',
      '................................',
    ]),
  ),
  // 3 blocky glitch
  parseLayer(
    pad([
      '................................',
      '................................',
      '................................',
      '.........OOOOOOOOOO.............',
      '.........OSSSSSSSSO.............',
      '.........OSSSSSSSSO.............',
      '.........OSSSSSSSSO.............',
      '.........OSSSSSSSSO.............',
      '.........OSSSSSSSSO.............',
      '.........OSSSSSSSSO.............',
      '.........OSSDDDSSSO.............',
      '.........OSSSSSSSSO.............',
      '.........OOOOOOOOOO.............',
      '..........OSSSSSSO..............',
      '.........OSSSSSSSSO.............',
      '.........OSSSSSSSSO.............',
      '........OOSSSSSSSSOO............',
      '.......OS.OSSSSSSO.SO...........',
      '.......OO..OSSSSO..OO...........',
      '...........OSSSSO...............',
      '...........OSSSSO...............',
      '..........OSSSSSSO..............',
      '..........OSSO.OSSO.............',
      '..........OSSO.OSSO.............',
      '..........OSSO.OSSO.............',
      '..........OOOO.OOOO.............',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
    ]),
  ),
];
