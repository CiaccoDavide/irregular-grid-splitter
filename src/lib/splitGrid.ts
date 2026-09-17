import type { CellImage } from '../types';
import { formatCellFilename } from './cellFilenames';
import type { ExportFormat } from './exportFormat';
import { extensionForFormat } from './exportFormat';
import { boundsFromCuts } from './gridCuts';

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: ExportFormat,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to encode image'));
      },
      format,
      quality,
    );
  });
}

export async function splitGrid(
  image: HTMLImageElement,
  vertical: number[],
  horizontal: number[],
  stem: string,
  format: ExportFormat,
  quality: number,
): Promise<CellImage[]> {
  const xs = boundsFromCuts(vertical, image.naturalWidth);
  const ys = boundsFromCuts(horizontal, image.naturalHeight);
  const rowCount = ys.length - 1;
  const colCount = xs.length - 1;
  const extension = extensionForFormat(format);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context');

  const cells: CellImage[] = [];

  for (let row = 0; row < rowCount; row++) {
    for (let col = 0; col < colCount; col++) {
      const x = xs[col];
      const y = ys[row];
      const width = xs[col + 1] - x;
      const height = ys[row + 1] - y;
      if (width <= 0 || height <= 0) continue;

      canvas.width = width;
      canvas.height = height;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(image, x, y, width, height, 0, 0, width, height);

      const blob = await canvasToBlob(canvas, format, quality);
      const url = URL.createObjectURL(blob);
      cells.push({
        id: `${row}-${col}`,
        row,
        col,
        width,
        height,
        blob,
        url,
        filename: formatCellFilename(stem, row, col, rowCount, colCount, extension),
        selected: true,
      });
    }
  }

  return cells;
}

export function revokeCells(cells: CellImage[]): void {
  for (const cell of cells) {
    URL.revokeObjectURL(cell.url);
  }
}
