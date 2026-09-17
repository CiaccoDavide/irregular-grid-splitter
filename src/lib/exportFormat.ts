/** Raster formats a browser canvas can actually encode to via `canvas.toBlob`. */
export type ExportFormat = 'image/png' | 'image/jpeg' | 'image/webp';

export interface ExportFormatOption {
  value: ExportFormat;
  label: string;
  extension: string;
}

export const EXPORT_FORMATS: ExportFormatOption[] = [
  { value: 'image/png', label: 'PNG (lossless)', extension: 'png' },
  { value: 'image/jpeg', label: 'JPEG', extension: 'jpg' },
  { value: 'image/webp', label: 'WebP', extension: 'webp' },
];

/** Sensible default quality for lossy formats (0-1), matches common browser defaults. */
export const DEFAULT_EXPORT_QUALITY = 0.92;

export function extensionForFormat(format: ExportFormat): string {
  return EXPORT_FORMATS.find((option) => option.value === format)?.extension ?? 'png';
}

/**
 * Picks the export format matching the loaded file when the browser can
 * actually re-encode it (PNG/JPEG/WebP); otherwise falls back to PNG, since
 * canvas.toBlob cannot produce GIF/BMP/AVIF regardless of the source file.
 */
export function defaultExportFormat(mimeType: string): ExportFormat {
  const match = EXPORT_FORMATS.find((option) => option.value === mimeType);
  return match ? match.value : 'image/png';
}
