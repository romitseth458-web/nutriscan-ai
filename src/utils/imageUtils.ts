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
const MAX_UPLOAD_DIMENSION = 1024; // Fast upload & crisp multi-item thali detail for Gemini Vision
const UPLOAD_JPEG_QUALITY = 0.78;
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
  source: HTMLImageElement | HTMLCanvasElement,
  naturalW: number,
  naturalH: number,
  maxDimension: number,
  mimeType: 'image/jpeg' | 'image/png',
  quality = UPLOAD_JPEG_QUALITY
): string {
  const safeW = Math.max(1, naturalW);
  const safeH = Math.max(1, naturalH);
  const scale = Math.min(1, maxDimension / Math.max(safeW, safeH));
  const width = Math.max(1, Math.round(safeW * scale));
  const height = Math.max(1, Math.round(safeH * scale));

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
  ctx.drawImage(source, 0, 0, width, height);
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

function buildPreparedImage(
  source: HTMLImageElement | HTMLCanvasElement,
  naturalW: number,
  naturalH: number,
  fileName: string,
  fallbackSize: number
): PreparedFoodImage | null {
  const normalizedDataUrl = renderScaledDataUrl(
    source,
    naturalW,
    naturalH,
    MAX_UPLOAD_DIMENSION,
    'image/jpeg',
    UPLOAD_JPEG_QUALITY
  );
  if (!normalizedDataUrl.startsWith('data:image/jpeg;base64,')) {
    return null;
  }

  const base64 = normalizedDataUrl.slice('data:image/jpeg;base64,'.length);
  const thumbnailDataUrl =
    renderScaledDataUrl(source, naturalW, naturalH, 240, 'image/jpeg', 0.7) || normalizedDataUrl;
  const approxUploadedBytes = Math.floor((base64.length * 3) / 4);

  return {
    previewDataUrl: normalizedDataUrl,
    thumbnailDataUrl,
    base64,
    mimeType: 'image/jpeg',
    fileName,
    fileSizeBytes: approxUploadedBytes || fallbackSize,
    width: naturalW,
    height: naturalH,
  };
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

  const prepared = buildPreparedImage(
    img,
    img.naturalWidth,
    img.naturalHeight,
    file.name,
    file.size
  );
  if (prepared) {
    return prepared;
  }

  // Fallback only if canvas export is blocked
  const rawDataUrl = await readFileAsDataUrl(file);
  const isPng = rawDataUrl.startsWith('data:image/png;base64,');
  const base64 = rawDataUrl.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
  return {
    previewDataUrl: rawDataUrl,
    thumbnailDataUrl: rawDataUrl,
    base64,
    mimeType: isPng ? 'image/png' : 'image/jpeg',
    fileName: file.name,
    fileSizeBytes: file.size,
    width: img.naturalWidth,
    height: img.naturalHeight,
  };
}

export function prepareImageFromCanvas(
  canvas: HTMLCanvasElement,
  fileName: string
): PreparedFoodImage {
  const prepared = buildPreparedImage(canvas, canvas.width, canvas.height, fileName, 0);
  if (!prepared) {
    throw new Error('Failed to encode captured camera photo.');
  }
  return prepared;
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
