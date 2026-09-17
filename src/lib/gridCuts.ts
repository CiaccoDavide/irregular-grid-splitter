import type { LineAxis, SelectedLine } from '../types';

const HIT_PX = 8;

export function snapCut(value: number, extent: number): number | null {
  const snapped = Math.round(value);
  if (snapped <= 0 || snapped >= extent) return null;
  return snapped;
}

export function insertUniqueSorted(values: number[], next: number): number[] {
  if (values.includes(next)) return values;
  return [...values, next].sort((a, b) => a - b);
}

export function dedupeSorted(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

export function moveCut(
  values: number[],
  index: number,
  next: number,
): number[] {
  if (index < 0 || index >= values.length) return values;
  const copy = values.slice();
  copy[index] = next;
  return copy;
}

export function removeCut(values: number[], index: number): number[] {
  return values.filter((_, i) => i !== index);
}

export function hitTestLine(
  worldX: number,
  worldY: number,
  vertical: number[],
  horizontal: number[],
  imageWidth: number,
  imageHeight: number,
  scale: number,
): SelectedLine | null {
  let best: { axis: LineAxis; index: number; dist: number } | null = null;
  const threshold = HIT_PX / scale;

  if (worldY >= -threshold && worldY <= imageHeight + threshold) {
    for (let i = 0; i < vertical.length; i++) {
      const dist = Math.abs(worldX - vertical[i]);
      if (dist <= threshold && (!best || dist < best.dist)) {
        best = { axis: 'v', index: i, dist };
      }
    }
  }

  if (worldX >= -threshold && worldX <= imageWidth + threshold) {
    for (let i = 0; i < horizontal.length; i++) {
      const dist = Math.abs(worldY - horizontal[i]);
      if (dist <= threshold && (!best || dist < best.dist)) {
        best = { axis: 'h', index: i, dist };
      }
    }
  }

  return best ? { axis: best.axis, index: best.index } : null;
}

export function boundsFromCuts(
  cuts: number[],
  extent: number,
): number[] {
  return [0, ...dedupeSorted(cuts), extent];
}

export function cellCount(vertical: number[], horizontal: number[]): number {
  return (vertical.length + 1) * (horizontal.length + 1);
}
