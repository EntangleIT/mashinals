import { useEffect, useRef } from 'react';
import type { CharacterSpec } from '@mashinals/shared';
import { drawPixelCharacter, PIXEL_SIZE } from './render';

interface Props {
  spec: CharacterSpec;
  size?: number;
  className?: string;
  title?: string;
}

/** Nearest-neighbor scaled pixel sprite — the only character representation. */
export function PixelSprite({ spec, size = 96, className, title }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = size;
    canvas.height = size;
    drawPixelCharacter(ctx, spec, size, true);
  }, [spec, size]);

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      className={className}
      title={title}
      style={{
        width: size,
        height: size,
        imageRendering: 'pixelated',
        display: 'block',
      }}
      aria-label={title ?? 'Mashinal sprite'}
    />
  );
}

export { PIXEL_SIZE };
