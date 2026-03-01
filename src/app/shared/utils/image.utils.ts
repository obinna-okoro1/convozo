/**
 * Client-side image compression utility.
 *
 * Accepts any image file and compresses it to fit within a target byte budget
 * (default 2 MB) by iteratively reducing JPEG quality and, if necessary,
 * scaling the dimensions down.
 */

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const INITIAL_QUALITY = 0.92;
const QUALITY_STEP = 0.05;
const MIN_QUALITY = 0.3;
const SCALE_STEP = 0.8; // shrink to 80 % each round
const MAX_DIMENSION = 2048; // cap the longest side on first pass

/**
 * Compress an image `File` so its output never exceeds `maxBytes`.
 *
 * Returns a **JPEG** `File` whose `.name` keeps the original stem but
 * switches the extension to `.jpg`.
 */
export async function compressImage(
  file: File,
  maxBytes: number = DEFAULT_MAX_BYTES,
): Promise<File> {
  // If the file is already small enough and is a JPEG, skip processing
  if (file.size <= maxBytes && file.type === 'image/jpeg') {
    return file;
  }

  const img = await loadImage(file);
  let { width, height } = img;

  // Cap the initial dimensions so we don't canvas-render a 20 MP photo
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  let quality = INITIAL_QUALITY;
  let blob = await drawToBlob(img, width, height, quality);

  // Phase 1 — reduce quality
  while (blob.size > maxBytes && quality > MIN_QUALITY) {
    quality = Math.max(quality - QUALITY_STEP, MIN_QUALITY);
    blob = await drawToBlob(img, width, height, quality);
  }

  // Phase 2 — scale down dimensions (quality already at minimum)
  while (blob.size > maxBytes && (width > 100 || height > 100)) {
    width = Math.round(width * SCALE_STEP);
    height = Math.round(height * SCALE_STEP);
    quality = INITIAL_QUALITY; // reset quality for the smaller canvas
    blob = await drawToBlob(img, width, height, quality);

    // Re-run quality reduction at this size
    while (blob.size > maxBytes && quality > MIN_QUALITY) {
      quality = Math.max(quality - QUALITY_STEP, MIN_QUALITY);
      blob = await drawToBlob(img, width, height, quality);
    }
  }

  const stem = file.name.replace(/\.[^.]+$/, '');
  return new File([blob], `${stem}.jpg`, { type: 'image/jpeg' });
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

function drawToBlob(
  img: HTMLImageElement,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas 2D context not available'));
      return;
    }

    ctx.drawImage(img, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas toBlob returned null'));
        }
      },
      'image/jpeg',
      quality,
    );
  });
}
