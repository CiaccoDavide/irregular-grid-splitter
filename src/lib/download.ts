import { isTauri } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import JSZip from 'jszip';
import type { CellImage } from '../types';

function extensionOf(filename: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(filename);
  return match ? match[1].toLowerCase() : 'png';
}

function downloadBlobInBrowser(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function downloadBlobInTauri(blob: Blob, filename: string): Promise<void> {
  const extension = extensionOf(filename);
  const path = await save({
    defaultPath: filename,
    filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
  });
  if (!path) return; // user cancelled the save dialog
  const bytes = new Uint8Array(await blob.arrayBuffer());
  await writeFile(path, bytes);
}

export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  if (isTauri()) {
    await downloadBlobInTauri(blob, filename);
  } else {
    downloadBlobInBrowser(blob, filename);
  }
}

export async function downloadZip(
  cells: CellImage[],
  zipName: string,
): Promise<void> {
  const zip = new JSZip();
  for (const cell of cells) {
    zip.file(cell.filename, cell.blob);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  await downloadBlob(blob, zipName);
}
