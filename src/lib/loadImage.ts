import type { LoadedImage } from '../types';

/** Canvas-decodable raster formats we can draw and split. */
const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;

const RASTER_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/x-ms-bmp',
  'image/avif',
]);

export const ACCEPTED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/avif',
] as const;

export function isSupportedImageFile(file: File): boolean {
  if (file.type && RASTER_MIME_TYPES.has(file.type)) return true;
  return IMAGE_EXTENSIONS.test(file.name);
}

function fileStem(name: string): string {
  const stripped = name.replace(IMAGE_EXTENSIONS, '').trim();
  const safe = stripped.replace(/[^\w.-]+/g, '_');
  return safe || 'image';
}

export async function loadImage(file: File): Promise<LoadedImage> {
  if (!isSupportedImageFile(file)) {
    throw new Error('Please choose a raster image (PNG, JPEG, WebP, GIF, BMP, or AVIF).');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error('Image has no dimensions.');
    }
    return {
      file,
      image,
      objectUrl,
      width: image.naturalWidth,
      height: image.naturalHeight,
      stem: fileStem(file.name),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    if (error instanceof Error && error.message.includes('dimensions')) {
      throw error;
    }
    throw new Error('Could not decode that image. Try PNG, JPEG, WebP, GIF, BMP, or AVIF.');
  }
}
