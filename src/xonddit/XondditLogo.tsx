import React, { useEffect, useState } from 'react';

export const XONDDIT_LOGO_ASSET =
  '/assets/aistudio/Gemini_Generated_Image_8mk3t98mk3t98mk3_2eefd040.jpg';

export interface XondditLogoProps {
  size?: number;
  className?: string;
  imgSrc?: string;
}

let cachedProcessedLogo: string | null = null;
let processingPromise: Promise<string> | null = null;

function processXondditLogo(src: string): Promise<string> {
  if (cachedProcessedLogo) return Promise.resolve(cachedProcessedLogo);
  if (processingPromise) return processingPromise;

  processingPromise = new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(src);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) {
          resolve(src);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        let minX = w;
        let minY = h;
        let maxX = 0;
        let maxY = 0;

        for (let y = 0; y < h; y++) {
          const rowOffset = y * w * 4;
          for (let x = 0; x < w; x++) {
            const i = rowOffset + x * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Separate vibrant orange-red mascot from neutral gray/white checkerboard
            const orangeStrength = r - Math.max(g, b);
            const alpha = Math.min(1, Math.max(0, (orangeStrength - 14) / 145));

            if (alpha <= 0.01) {
              data[i + 3] = 0;
            } else {
              data[i] = 241;
              data[i + 1] = 71;
              data[i + 2] = 36;
              data[i + 3] = Math.round(alpha * 255);

              if (alpha > 0.15) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);

        if (maxX > minX && maxY > minY) {
          const bw = maxX - minX + 1;
          const bh = maxY - minY + 1;
          const side = Math.ceil(Math.max(bw, bh) * 1.06);
          const outCanvas = document.createElement('canvas');
          outCanvas.width = side;
          outCanvas.height = side;
          const outCtx = outCanvas.getContext('2d');
          if (outCtx) {
            const dx = Math.round((side - bw) / 2);
            const dy = Math.round((side - bh) / 2);
            outCtx.drawImage(canvas, minX, minY, bw, bh, dx, dy, bw, bh);
            const resultUrl = outCanvas.toDataURL('image/png');
            cachedProcessedLogo = resultUrl;
            resolve(resultUrl);
            return;
          }
        }

        const fallbackUrl = canvas.toDataURL('image/png');
        cachedProcessedLogo = fallbackUrl;
        resolve(fallbackUrl);
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });

  return processingPromise;
}

if (typeof window !== 'undefined') {
  void processXondditLogo(XONDDIT_LOGO_ASSET);
}

export const XondditLogo: React.FC<XondditLogoProps> = ({
  size = 32,
  className = '',
  imgSrc = XONDDIT_LOGO_ASSET,
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string>(
    imgSrc === XONDDIT_LOGO_ASSET && cachedProcessedLogo ? cachedProcessedLogo : imgSrc
  );

  useEffect(() => {
    if (imgSrc !== XONDDIT_LOGO_ASSET) {
      setResolvedSrc(imgSrc);
      return;
    }
    if (cachedProcessedLogo) {
      setResolvedSrc(cachedProcessedLogo);
      return;
    }
    let active = true;
    processXondditLogo(imgSrc).then((url) => {
      if (active) setResolvedSrc(url);
    });
    return () => {
      active = false;
    };
  }, [imgSrc]);

  return (
    <img
      src={resolvedSrc}
      data-asset-src={imgSrc}
      alt="Xonddit Logo"
      width={size}
      height={size}
      decoding="async"
      draggable={false}
      className={`inline-block object-contain shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    />
  );
};

