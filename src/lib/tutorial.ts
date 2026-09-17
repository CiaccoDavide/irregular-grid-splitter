import type { DriveStep } from 'driver.js';

const STORAGE_KEY = 'igps-tutorial-seen';

export function hasSeenTutorial(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markTutorialSeen(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Ignore storage errors (private browsing, disabled storage, etc.)
  }
}

/** Popover steps for the tutorial, scoped to a single wizard step. */
export function getTourSteps(step: number): DriveStep[] {
  switch (step) {
    case 0:
      return [
        {
          element: '[data-tour="dropzone"]',
          popover: {
            title: 'Load an image',
            description:
              'Drag an image here, or click to browse. PNG, JPEG, WebP, and more — the file stays on your machine the whole time.',
            side: 'bottom',
            align: 'center',
          },
        },
      ];
    case 1:
      return [
        {
          element: '[data-tour="mode-toggle"]',
          popover: {
            title: 'Choose a tool',
            description:
              'Pan moves around the image. Vertical and Horizontal add cut lines when you click on the image.',
            side: 'bottom',
            align: 'start',
          },
        },
        {
          element: '[data-tour="canvas"]',
          popover: {
            title: 'Place your grid',
            description:
              'Scroll to zoom, drag to pan (or hold Space). Click to add a line, or drag an existing line to move it. Lines always snap between pixels, and a faint pixel grid appears once you are zoomed in enough.',
            side: 'top',
            align: 'center',
          },
        },
        {
          element: '[data-tour="confirm-grid"]',
          popover: {
            title: 'Confirm the grid',
            description:
              'Happy with the lines? Confirm to split the image into every cell of the grid.',
            side: 'top',
            align: 'end',
          },
        },
      ];
    case 2:
      return [
        {
          element: '[data-tour="review-grid"]',
          popover: {
            title: 'Review the cells',
            description:
              'Click a cell to select it, Shift-click to select a range, or Ctrl/Cmd-click to add individual cells. The switch on each card marks it to keep or skip.',
            side: 'top',
            align: 'center',
          },
        },
        {
          element: '[data-tour="download-selected"]',
          popover: {
            title: 'Export your picks',
            description:
              'Download any cell on its own, or grab everything you kept in one zip.',
            side: 'top',
            align: 'end',
          },
        },
      ];
    default:
      return [];
  }
}
