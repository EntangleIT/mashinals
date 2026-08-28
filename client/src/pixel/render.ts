import {
  PIXEL_SIZE,
  STYLE_COUNTS,
  clampPart,
  getPalette,
  resolveSlot,
  type CharacterSpec,
  type PixelPalette,
} from '@mashinals/shared';
import { BODIES, type PixelLayer } from './parts-body';
import { EYES, HAIRS, MOUTHS } from './parts-face';
import { ACCESSORIES, CLOTHES } from './parts-gear';

export { PIXEL_SIZE };

function pick<T>(arr: T[], index: number): T {
  return arr[clampPart(index, arr.length)]!;
}

/** Composite gene layers into a flat 32×32 slot-index buffer (0 = transparent). */
export function compositeSlots(spec: CharacterSpec): Uint8Array {
  const g = spec.genes;
  const layers: PixelLayer[] = [
    pick(BODIES, g.body),
    pick(CLOTHES, g.clothes),
    pick(HAIRS, g.hair),
    pick(EYES, g.eyes),
    pick(MOUTHS, g.mouth),
    pick(ACCESSORIES, g.accessory),
  ];

  const out = new Uint8Array(PIXEL_SIZE * PIXEL_SIZE);
  for (const layer of layers) {
    for (let i = 0; i < out.length; i++) {
      const slot = layer[i] ?? 0;
      if (slot > 0) out[i] = slot;
    }
  }
  return out;
}

export function slotsToRgba(slots: Uint8Array, palette: PixelPalette): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(PIXEL_SIZE * PIXEL_SIZE * 4);
  for (let i = 0; i < slots.length; i++) {
    const hex = resolveSlot(palette, slots[i]!);
    const o = i * 4;
    if (!hex) {
      rgba[o] = 0;
      rgba[o + 1] = 0;
      rgba[o + 2] = 0;
      rgba[o + 3] = 0;
      continue;
    }
    const n = hex.replace('#', '');
    rgba[o] = parseInt(n.slice(0, 2), 16);
    rgba[o + 1] = parseInt(n.slice(2, 4), 16);
    rgba[o + 2] = parseInt(n.slice(4, 6), 16);
    rgba[o + 3] = 255;
  }
  return rgba;
}

export function renderPixelRgba(spec: CharacterSpec): {
  rgba: Uint8ClampedArray;
  palette: PixelPalette;
  slots: Uint8Array;
} {
  const palette = getPalette(spec.genes.palette);
  const slots = compositeSlots(spec);
  return { rgba: slotsToRgba(slots, palette), palette, slots };
}

/** Draw onto a canvas with nearest-neighbor scaling. */
export function drawPixelCharacter(
  ctx: CanvasRenderingContext2D,
  spec: CharacterSpec,
  displaySize: number,
  clear = true,
): void {
  const { rgba } = renderPixelRgba(spec);
  const img = ctx.createImageData(PIXEL_SIZE, PIXEL_SIZE);
  img.data.set(rgba);

  const off = document.createElement('canvas');
  off.width = PIXEL_SIZE;
  off.height = PIXEL_SIZE;
  const offCtx = off.getContext('2d')!;
  offCtx.putImageData(img, 0, 0);

  if (clear) {
    ctx.clearRect(0, 0, displaySize, displaySize);
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, 0, 0, PIXEL_SIZE, PIXEL_SIZE, 0, 0, displaySize, displaySize);
}

/** Tiny PNG data URL (source 32×32). */
export function capturePngDataUrl(spec: CharacterSpec): string {
  const canvas = document.createElement('canvas');
  canvas.width = PIXEL_SIZE;
  canvas.height = PIXEL_SIZE;
  const ctx = canvas.getContext('2d')!;
  const { rgba } = renderPixelRgba(spec);
  const img = ctx.createImageData(PIXEL_SIZE, PIXEL_SIZE);
  img.data.set(rgba);
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

/** Scaled PNG preview for UI / share cards. */
export function capturePreviewPng(spec: CharacterSpec, scale = 8): string {
  const canvas = document.createElement('canvas');
  const size = PIXEL_SIZE * scale;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  // Opaque backdrop for share cards
  ctx.fillStyle = '#1a1030';
  ctx.fillRect(0, 0, size, size);
  drawPixelCharacter(ctx, spec, size, false);
  return canvas.toDataURL('image/png');
}

/**
 * Compact pixel-art SVG: a grid of 1×1 rects (crisp on-chain, not smooth vector chibis).
 * Prefer PNG for inscription size; SVG is available for composable tooling.
 */
export function capturePixelSvg(spec: CharacterSpec): string {
  const { rgba } = renderPixelRgba(spec);
  const rects: string[] = [];
  for (let y = 0; y < PIXEL_SIZE; y++) {
    for (let x = 0; x < PIXEL_SIZE; x++) {
      const i = (y * PIXEL_SIZE + x) * 4;
      const a = rgba[i + 3]!;
      if (a === 0) continue;
      const r = rgba[i]!;
      const g = rgba[i + 1]!;
      const b = rgba[i + 2]!;
      const hex = `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
      rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${hex}"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PIXEL_SIZE} ${PIXEL_SIZE}" shape-rendering="crispEdges" width="${PIXEL_SIZE}" height="${PIXEL_SIZE}">${rects.join('')}</svg>`;
}

/** Inscription payload: tiny PNG bytes as base64 (no data: prefix). */
export function capturePngBase64(spec: CharacterSpec): string {
  const dataUrl = capturePngDataUrl(spec);
  return dataUrl.split(',')[1] ?? '';
}

export async function hashPixels(spec: CharacterSpec): Promise<string> {
  const b64 = capturePngBase64(spec);
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/** Sanity: part kit lengths match STYLE_COUNTS. */
export function assertPartKitSync(): void {
  if (BODIES.length !== STYLE_COUNTS.body) throw new Error('body kit mismatch');
  if (HAIRS.length !== STYLE_COUNTS.hair) throw new Error('hair kit mismatch');
  if (EYES.length !== STYLE_COUNTS.eyes) throw new Error('eyes kit mismatch');
  if (MOUTHS.length !== STYLE_COUNTS.mouth) throw new Error('mouth kit mismatch');
  if (CLOTHES.length !== STYLE_COUNTS.clothes) throw new Error('clothes kit mismatch');
  if (ACCESSORIES.length !== STYLE_COUNTS.accessory) throw new Error('accessory kit mismatch');
}
