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

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function validateImageFile(file: File): string | null {
  const mime = file.type.toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const hasValidExt = ext === 'jpg' || ext === 'jpeg' || ext === 'png';

  if (!ACCEPTED_TYPES.has(mime) && !hasValidExt) {
    return 'Unsupported file format. Please select a JPG, JPEG, or PNG food image.';
  }
  if (file.size === 0) {
    return 'The selected file is empty.';
  }
  if (file.size > MAX_FILE_BYTES) {
    return `Image is too large (${formatBytes(file.size)}). Maximum allowed size is 8 MB.`;
  }
  return null;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image file. Please try another photo.'));
    img.src = src;
  });
}

function createThumbnailDataUrl(img: HTMLImageElement, maxWidth = 280): string {
  const scale = Math.min(1, maxWidth / Math.max(1, img.naturalWidth));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.78);
}

export async function prepareImageFromFile(file: File): Promise<PreparedFoodImage> {
  const validationError = validateImageFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
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

  const img = await loadImageElement(dataUrl);
  const thumbnailDataUrl = createThumbnailDataUrl(img) || dataUrl;

  const isPng =
    file.type.toLowerCase() === 'image/png' ||
    file.name.toLowerCase().endsWith('.png');
  const mimeType: 'image/jpeg' | 'image/png' = isPng ? 'image/png' : 'image/jpeg';
  const base64 = dataUrl.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

  return {
    previewDataUrl: dataUrl,
    thumbnailDataUrl,
    base64,
    mimeType,
    fileName: file.name,
    fileSizeBytes: file.size,
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
  const mime = blob.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const file = new File([blob], fileName, { type: mime });
  return prepareImageFromFile(file);
}
