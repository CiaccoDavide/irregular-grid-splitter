import type { CellImage } from '../types';

/** Digits needed so every index (and the count itself) fits, e.g. 100 cells → 3. */
export function indexPadWidth(count: number): number {
  return Math.max(1, String(Math.max(count, 1)).length);
}

export function sanitizeNamePrefix(raw: string): string {
  const trimmed = raw.trim();
  const safe = trimmed.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '');
  return safe || 'image';
}

export function gridDimensions(cells: CellImage[]): {
  rowCount: number;
  colCount: number;
} {
  let maxRow = 0;
  let maxCol = 0;
  for (const cell of cells) {
    if (cell.row > maxRow) maxRow = cell.row;
    if (cell.col > maxCol) maxCol = cell.col;
  }
  return { rowCount: maxRow + 1, colCount: maxCol + 1 };
}

export function formatCellFilename(
  prefix: string,
  row: number,
  col: number,
  rowCount: number,
  colCount: number,
  extension: string,
): string {
  const safe = sanitizeNamePrefix(prefix);
  const rowPad = indexPadWidth(rowCount);
  const colPad = indexPadWidth(colCount);
  const r = String(row).padStart(rowPad, '0');
  const c = String(col).padStart(colPad, '0');
  return `${safe}_r${r}_c${c}.${extension}`;
}

/** Rebuild filenames for every cell using a new prefix (row/col padding and extension unchanged unless overridden). */
export function withFilenamePrefix(
  cells: CellImage[],
  prefix: string,
  extension: string,
): CellImage[] {
  if (cells.length === 0) return cells;
  const { rowCount, colCount } = gridDimensions(cells);
  return cells.map((cell) => ({
    ...cell,
    filename: formatCellFilename(prefix, cell.row, cell.col, rowCount, colCount, extension),
  }));
}
