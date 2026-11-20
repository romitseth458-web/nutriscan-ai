export interface PreparedFoodImage {
  previewDataUrl: string;
  thumbnailDataUrl: string;
  base64: string;
  mimeType: 'image/jpeg' | 'image/png';
  fileName: string;
  fileSizeBytes: number;
  width: number;
  height: number;
}

const MAX_RAW_FILE_BYTES = 20 * 1024 * 1024; // 20 MB raw camera photo before client optimization
const MAX_UPLOAD_DIMENSION = 1440; // Optimal resolution for Gemini Vision & < 4.5 MB Vercel limit
const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function validateImageFile(file: File): string | null {
  const mime = file.type.toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const hasValidExt =
    ext === 'jpg' ||
    ext === 'jpeg' ||
    ext === 'png' ||
    ext === 'webp' ||
    ext === 'heic' ||
    ext === 'heif';

  if (!ACCEPTED_TYPES.has(mime) && !hasValidExt && !mime.startsWith('image/')) {
    return 'Unsupported file format. Please select a JPG, JPEG, PNG, or WebP food image.';
  }
  if (file.size === 0) {
    return 'The selected file is empty.';
  }
  if (file.size > MAX_RAW_FILE_BYTES) {
    return `Image is too large (${formatBytes(file.size)}). Maximum allowed size is 20 MB.`;
  }
  return null;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(
        new Error(
          'Could not decode this image file in the browser. Please use a JPG, PNG, or WebP photo.'
        )
      );
    img.src = src;
  });
}

function renderScaledDataUrl(
  img: HTMLImageElement,
  maxDimension: number,
  mimeType: 'image/jpeg' | 'image/png',
  quality = 0.86
): string {
  const naturalW = Math.max(1, img.naturalWidth);
  const naturalH = Math.max(1, img.naturalHeight);
  const scale = Math.min(1, maxDimension / Math.max(naturalW, naturalH));
  const width = Math.max(1, Math.round(naturalW * scale));
  const height = Math.max(1, Math.round(naturalH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Fill white background before drawing so transparent PNGs convert cleanly to JPEG
  if (mimeType === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL(mimeType, quality);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read image file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

export async function prepareImageFromFile(file: File): Promise<PreparedFoodImage> {
  const validationError = validateImageFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  let objectUrl: string | null = null;
  let img: HTMLImageElement;

  try {
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      objectUrl = URL.createObjectURL(file);
      img = await loadImageElement(objectUrl);
    } else {
      const rawDataUrl = await readFileAsDataUrl(file);
      img = await loadImageElement(rawDataUrl);
    }
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }

  // Always normalize uploaded photos via canvas to valid JPEG (strips EXIF orientation issues,
  // converts mismatched .jpg/WebP/HEIC extensions into real JPEG bytes, and keeps payload < 1 MB
  // so mobile uploads & Vercel serverless requests succeed reliably).
  let normalizedDataUrl = renderScaledDataUrl(img, MAX_UPLOAD_DIMENSION, 'image/jpeg', 0.86);
  if (!normalizedDataUrl.startsWith('data:image/jpeg;base64,')) {
    const rawDataUrl = await readFileAsDataUrl(file);
    normalizedDataUrl = rawDataUrl;
  } else if (normalizedDataUrl.length > 2_800_000) {
    // Secondary compression pass if a dense texture produced > ~2.1 MB binary
    normalizedDataUrl = renderScaledDataUrl(img, 1200, 'image/jpeg', 0.76) || normalizedDataUrl;
  }

  const isPngOutput = normalizedDataUrl.startsWith('data:image/png;base64,');
  const mimeType: 'image/jpeg' | 'image/png' = isPngOutput ? 'image/png' : 'image/jpeg';
  const base64 = normalizedDataUrl.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
  const thumbnailDataUrl = renderScaledDataUrl(img, 280, 'image/jpeg', 0.76) || normalizedDataUrl;
  const approxUploadedBytes = Math.floor((base64.length * 3) / 4);

  return {
    previewDataUrl: normalizedDataUrl,
    thumbnailDataUrl,
    base64,
    mimeType,
    fileName: file.name,
    fileSizeBytes: approxUploadedBytes || file.size,
    width: img.naturalWidth,
    height: img.naturalHeight,
  };
}

export async function prepareImageFromUrl(
  imageUrl: string,
  fileName: string
): Promise<PreparedFoodImage> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error('Could not load sample meal image.');
  }
  const blob = await response.blob();
  const mime = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
  const file = new File([blob], fileName, { type: mime });
  return prepareImageFromFile(file);
}
