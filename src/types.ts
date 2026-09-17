export type EditorMode = 'pan' | 'add-v' | 'add-h';

export type LineAxis = 'v' | 'h';

export interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface LoadedImage {
  file: File;
  image: HTMLImageElement;
  objectUrl: string;
  width: number;
  height: number;
  stem: string;
}

export interface SelectedLine {
  axis: LineAxis;
  index: number;
}

export interface PreviewLine {
  axis: LineAxis;
  pos: number;
}

export interface CellImage {
  id: string;
  row: number;
  col: number;
  width: number;
  height: number;
  blob: Blob;
  url: string;
  filename: string;
  selected: boolean;
}
