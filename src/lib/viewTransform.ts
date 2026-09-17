import type { ViewTransform } from '../types';

export const MAX_SCALE = 64;
export const PIXEL_GRID_MIN_SCALE = 8;

export function screenToWorld(
  sx: number,
  sy: number,
  view: ViewTransform,
): { x: number; y: number } {
  return {
    x: (sx - view.offsetX) / view.scale,
    y: (sy - view.offsetY) / view.scale,
  };
}

export function zoomAround(
  view: ViewTransform,
  sx: number,
  sy: number,
  nextScale: number,
): ViewTransform {
  const world = screenToWorld(sx, sy, view);
  return {
    scale: nextScale,
    offsetX: sx - world.x * nextScale,
    offsetY: sy - world.y * nextScale,
  };
}

export function fitToView(
  imageWidth: number,
  imageHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  padding = 48,
): ViewTransform {
  const availableW = Math.max(1, canvasWidth - padding * 2);
  const availableH = Math.max(1, canvasHeight - padding * 2);
  const scale = Math.min(
    availableW / imageWidth,
    availableH / imageHeight,
    MAX_SCALE,
  );
  return {
    scale,
    offsetX: (canvasWidth - imageWidth * scale) / 2,
    offsetY: (canvasHeight - imageHeight * scale) / 2,
  };
}

export function clampScale(
  scale: number,
  imageWidth: number,
  imageHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): number {
  const fit = fitToView(imageWidth, imageHeight, canvasWidth, canvasHeight).scale;
  const min = Math.min(fit * 0.25, 0.05);
  return Math.min(MAX_SCALE, Math.max(min, scale));
}

export function visibleWorldRect(
  view: ViewTransform,
  cssWidth: number,
  cssHeight: number,
): { left: number; top: number; right: number; bottom: number } {
  return {
    left: (0 - view.offsetX) / view.scale,
    top: (0 - view.offsetY) / view.scale,
    right: (cssWidth - view.offsetX) / view.scale,
    bottom: (cssHeight - view.offsetY) / view.scale,
  };
}
