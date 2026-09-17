import {
  ActionIcon,
  Badge,
  Group,
  Kbd,
  Paper,
  SegmentedControl,
  Text,
  Tooltip,
  useComputedColorScheme,
} from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import {
  IconArrowsMove,
  IconFocusCentered,
  IconLineDashed,
  IconSeparatorVertical,
  IconTrash,
} from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import {
  cellCount,
  dedupeSorted,
  hitTestLine,
  insertUniqueSorted,
  moveCut,
  removeCut,
  snapCut,
} from '../lib/gridCuts';
import {
  clampScale,
  fitToView,
  PIXEL_GRID_MIN_SCALE,
  screenToWorld,
  visibleWorldRect,
  zoomAround,
} from '../lib/viewTransform';
import type {
  EditorMode,
  PreviewLine,
  SelectedLine,
  ViewTransform,
} from '../types';

const RULER = 28;
const VERTICAL_COLOR = '#4dabf7';
const HORIZONTAL_COLOR = '#ff922b';
const SELECTED_COLOR = '#ffe066';

interface GridEditorProps {
  image: HTMLImageElement;
  imageWidth: number;
  imageHeight: number;
  vertical: number[];
  horizontal: number[];
  onVerticalChange: (values: number[]) => void;
  onHorizontalChange: (values: number[]) => void;
}

interface Interaction {
  pan: boolean;
  drag: SelectedLine | null;
  space: boolean;
  lastX: number;
  lastY: number;
  moved: boolean;
  preview: PreviewLine | null;
  hover: SelectedLine | null;
}

function canvasPoint(
  event: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function tickStep(scale: number): number {
  if (scale >= 16) return 1;
  if (scale >= 8) return 5;
  if (scale >= 2) return 10;
  if (scale >= 0.5) return 50;
  return 100;
}

function cursorFor(
  mode: EditorMode,
  hover: SelectedLine | null,
  panning: boolean,
  space: boolean,
): string {
  if (panning) return 'grabbing';
  if (hover) return hover.axis === 'v' ? 'col-resize' : 'row-resize';
  if (space || mode === 'pan') return 'grab';
  return 'crosshair';
}

export function GridEditor({
  image,
  imageWidth,
  imageHeight,
  vertical,
  horizontal,
  onVerticalChange,
  onHorizontalChange,
}: GridEditorProps) {
  const scheme = useComputedColorScheme('dark');
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<EditorMode>('add-v');
  const [view, setView] = useState<ViewTransform>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const [selected, setSelected] = useState<SelectedLine | null>(null);
  const [cursor, setCursor] = useState('crosshair');

  const viewRef = useRef(view);
  const modeRef = useRef(mode);
  const selectedRef = useRef(selected);
  const verticalRef = useRef(vertical);
  const horizontalRef = useRef(horizontal);
  const fittedRef = useRef(false);
  const patternRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef(0);

  const interactionRef = useRef<Interaction>({
    pan: false,
    drag: null,
    space: false,
    lastX: 0,
    lastY: 0,
    moved: false,
    preview: null,
    hover: null,
  });

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    verticalRef.current = vertical;
  }, [vertical]);

  useEffect(() => {
    horizontalRef.current = horizontal;
  }, [horizontal]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (cssW === 0 || cssH === 0) return;

    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }

    const currentView = viewRef.current;
    const verts = verticalRef.current;
    const hors = horizontalRef.current;
    const currentSelected = selectedRef.current;
    const { preview, hover } = interactionRef.current;
    const dark = scheme === 'dark';
    const visible = visibleWorldRect(currentView, cssW, cssH);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = dark ? '#1a1b1e' : '#e9ecef';
    ctx.fillRect(0, 0, cssW, cssH);

    ctx.save();
    ctx.translate(currentView.offsetX, currentView.offsetY);
    ctx.scale(currentView.scale, currentView.scale);

    if (!patternRef.current) {
      const tile = document.createElement('canvas');
      tile.width = 16;
      tile.height = 16;
      const tctx = tile.getContext('2d');
      if (tctx) {
        tctx.fillStyle = '#f8f9fa';
        tctx.fillRect(0, 0, 16, 16);
        tctx.fillStyle = '#dee2e6';
        tctx.fillRect(0, 0, 8, 8);
        tctx.fillRect(8, 8, 8, 8);
        patternRef.current = tile;
      }
    }
    if (patternRef.current) {
      const pattern = ctx.createPattern(patternRef.current, 'repeat');
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, imageWidth, imageHeight);
      }
    }

    ctx.imageSmoothingEnabled = currentView.scale < 1;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, imageWidth, imageHeight);

    if (currentView.scale >= PIXEL_GRID_MIN_SCALE) {
      ctx.strokeStyle = dark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 1 / currentView.scale;
      ctx.beginPath();
      const x0 = Math.max(0, Math.floor(visible.left));
      const x1 = Math.min(imageWidth, Math.ceil(visible.right));
      const y0 = Math.max(0, Math.floor(visible.top));
      const y1 = Math.min(imageHeight, Math.ceil(visible.bottom));
      for (let x = x0; x <= x1; x++) {
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y1);
      }
      for (let y = y0; y <= y1; y++) {
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
      }
      ctx.stroke();
    }

    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1 / currentView.scale;
    ctx.strokeRect(0, 0, imageWidth, imageHeight);

    const drawCuts = (
      positions: number[],
      axis: 'v' | 'h',
      color: string,
    ) => {
      for (let i = 0; i < positions.length; i++) {
        const isSel =
          currentSelected?.axis === axis && currentSelected.index === i;
        const isHover = hover?.axis === axis && hover.index === i;
        const width = (isSel ? 3 : isHover ? 2.5 : 2) / currentView.scale;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        if (axis === 'v') {
          ctx.moveTo(positions[i], 0);
          ctx.lineTo(positions[i], imageHeight);
        } else {
          ctx.moveTo(0, positions[i]);
          ctx.lineTo(imageWidth, positions[i]);
        }
        ctx.strokeStyle = dark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)';
        ctx.lineWidth = width + 2 / currentView.scale;
        ctx.stroke();
        ctx.beginPath();
        if (axis === 'v') {
          ctx.moveTo(positions[i], 0);
          ctx.lineTo(positions[i], imageHeight);
        } else {
          ctx.moveTo(0, positions[i]);
          ctx.lineTo(imageWidth, positions[i]);
        }
        ctx.strokeStyle = isSel ? SELECTED_COLOR : color;
        ctx.globalAlpha = isSel || isHover ? 1 : 0.95;
        ctx.lineWidth = width;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    };

    drawCuts(verts, 'v', VERTICAL_COLOR);
    drawCuts(hors, 'h', HORIZONTAL_COLOR);

    if (preview) {
      ctx.save();
      ctx.strokeStyle = preview.axis === 'v' ? VERTICAL_COLOR : HORIZONTAL_COLOR;
      ctx.globalAlpha = 0.55;
      ctx.setLineDash([6 / currentView.scale, 4 / currentView.scale]);
      ctx.lineWidth = 2 / currentView.scale;
      ctx.beginPath();
      if (preview.axis === 'v') {
        ctx.moveTo(preview.pos, 0);
        ctx.lineTo(preview.pos, imageHeight);
      } else {
        ctx.moveTo(0, preview.pos);
        ctx.lineTo(imageWidth, preview.pos);
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    ctx.fillStyle = dark ? 'rgba(16,17,19,0.88)' : 'rgba(255,255,255,0.88)';
    ctx.fillRect(0, 0, cssW, RULER);
    ctx.fillRect(0, 0, RULER, cssH);
    ctx.fillStyle = dark ? '#1a1b1e' : '#f8f9fa';
    ctx.fillRect(0, 0, RULER, RULER);

    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.moveTo(RULER, 0);
    ctx.lineTo(RULER, cssH);
    ctx.moveTo(0, RULER);
    ctx.lineTo(cssW, RULER);
    ctx.stroke();

    const step = tickStep(currentView.scale);
    ctx.fillStyle = dark ? '#c1c2c5' : '#495057';
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textBaseline = 'middle';

    ctx.textAlign = 'center';
    const startX = Math.floor(visible.left / step) * step;
    const endX = Math.ceil(visible.right / step) * step;
    for (let x = startX; x <= endX; x += step) {
      if (x < 0 || x > imageWidth) continue;
      const sx = x * currentView.scale + currentView.offsetX;
      if (sx < RULER) continue;
      ctx.beginPath();
      ctx.strokeStyle = dark ? '#5c5f66' : '#adb5bd';
      ctx.moveTo(sx, RULER - (x % (step * 2) === 0 ? 10 : 6));
      ctx.lineTo(sx, RULER);
      ctx.stroke();
      if (x % (step * 2) === 0 || step === 1) {
        ctx.fillText(String(x), sx, 10);
      }
    }

    ctx.textAlign = 'right';
    const startY = Math.floor(visible.top / step) * step;
    const endY = Math.ceil(visible.bottom / step) * step;
    for (let y = startY; y <= endY; y += step) {
      if (y < 0 || y > imageHeight) continue;
      const sy = y * currentView.scale + currentView.offsetY;
      if (sy < RULER) continue;
      ctx.beginPath();
      ctx.strokeStyle = dark ? '#5c5f66' : '#adb5bd';
      ctx.moveTo(RULER - (y % (step * 2) === 0 ? 10 : 6), sy);
      ctx.lineTo(RULER, sy);
      ctx.stroke();
      if (y % (step * 2) === 0 || step === 1) {
        ctx.save();
        ctx.translate(12, sy);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText(String(y), 0, 0);
        ctx.restore();
      }
    }

    ctx.fillStyle = dark ? '#909296' : '#868e96';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${imageWidth}×${imageHeight}`, RULER / 2, RULER / 2);
  }, [image, imageHeight, imageWidth, scheme]);

  const drawRef = useRef(draw);

  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  const scheduleDraw = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      drawRef.current();
    });
  }, []);

  const fit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const next = fitToView(
      imageWidth,
      imageHeight,
      canvas.clientWidth,
      canvas.clientHeight,
    );
    viewRef.current = next;
    setView(next);
    scheduleDraw();
  }, [imageHeight, imageWidth, scheduleDraw]);

  useEffect(() => {
    fittedRef.current = false;
    const wrap = wrapRef.current;
    if (!wrap) return;

    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (canvas.clientWidth <= 0 || canvas.clientHeight <= 0) return;
      if (!fittedRef.current) {
        fittedRef.current = true;
        const next = fitToView(
          imageWidth,
          imageHeight,
          canvas.clientWidth,
          canvas.clientHeight,
        );
        viewRef.current = next;
        setView(next);
      }
      drawRef.current();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    resize();
    return () => observer.disconnect();
  }, [image, imageHeight, imageWidth]);

  useEffect(() => {
    scheduleDraw();
  }, [vertical, horizontal, selected, view, mode, scheme, scheduleDraw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const { x, y } = canvasPoint(event, canvas);
      const zoom = Math.exp(-event.deltaY * 0.00175);
      const nextScale = clampScale(
        viewRef.current.scale * zoom,
        imageWidth,
        imageHeight,
        canvas.clientWidth,
        canvas.clientHeight,
      );
      const next = zoomAround(viewRef.current, x, y, nextScale);
      viewRef.current = next;
      setView(next);
      scheduleDraw();
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [imageHeight, imageWidth, scheduleDraw]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        interactionRef.current.space = true;
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        interactionRef.current.space = false;
        if (!interactionRef.current.pan) {
          setCursor(
            cursorFor(
              modeRef.current,
              interactionRef.current.hover,
              false,
              false,
            ),
          );
        }
      }
    };
    const onBlur = () => {
      interactionRef.current.space = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const deleteSelected = useCallback(() => {
    const current = selectedRef.current;
    if (!current) return;
    if (current.axis === 'v') {
      const next = removeCut(verticalRef.current, current.index);
      verticalRef.current = next;
      onVerticalChange(next);
    } else {
      const next = removeCut(horizontalRef.current, current.index);
      horizontalRef.current = next;
      onHorizontalChange(next);
    }
    setSelected(null);
    interactionRef.current.hover = null;
    interactionRef.current.drag = null;
  }, [onHorizontalChange, onVerticalChange]);

  useHotkeys([
    ['v', () => setMode('add-v')],
    ['h', () => setMode('add-h')],
    ['a', () => setMode('pan')],
    ['Escape', () => setSelected(null)],
    ['Delete', deleteSelected],
    ['Backspace', deleteSelected],
  ]);

  const finishDrag = useCallback(() => {
    const drag = interactionRef.current.drag;
    if (!drag) return;
    if (drag.axis === 'v') {
      const pos = verticalRef.current[drag.index];
      const next = dedupeSorted(verticalRef.current);
      verticalRef.current = next;
      onVerticalChange(next);
      const index = next.indexOf(pos);
      setSelected(index >= 0 ? { axis: 'v', index } : null);
    } else {
      const pos = horizontalRef.current[drag.index];
      const next = dedupeSorted(horizontalRef.current);
      horizontalRef.current = next;
      onHorizontalChange(next);
      const index = next.indexOf(pos);
      setSelected(index >= 0 ? { axis: 'h', index } : null);
    }
    interactionRef.current.drag = null;
  }, [onHorizontalChange, onVerticalChange]);

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (event.button === 1) event.preventDefault();
    canvas.setPointerCapture(event.pointerId);

    const { x, y } = canvasPoint(event.nativeEvent, canvas);
    const world = screenToWorld(x, y, viewRef.current);
    const hit = hitTestLine(
      world.x,
      world.y,
      verticalRef.current,
      horizontalRef.current,
      imageWidth,
      imageHeight,
      viewRef.current.scale,
    );

    interactionRef.current.lastX = x;
    interactionRef.current.lastY = y;
    interactionRef.current.moved = false;
    interactionRef.current.preview = null;

    const middle = event.button === 1;
    const space = interactionRef.current.space;
    if (middle || space || (modeRef.current === 'pan' && !hit)) {
      interactionRef.current.pan = true;
      setCursor('grabbing');
      return;
    }

    if (hit) {
      interactionRef.current.drag = hit;
      setSelected(hit);
      setCursor(hit.axis === 'v' ? 'col-resize' : 'row-resize');
      scheduleDraw();
      return;
    }

    setSelected(null);
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = canvasPoint(event.nativeEvent, canvas);
    const dx = x - interactionRef.current.lastX;
    const dy = y - interactionRef.current.lastY;
    if (Math.abs(dx) + Math.abs(dy) > 2) interactionRef.current.moved = true;

    if (interactionRef.current.pan) {
      const next = {
        ...viewRef.current,
        offsetX: viewRef.current.offsetX + dx,
        offsetY: viewRef.current.offsetY + dy,
      };
      viewRef.current = next;
      interactionRef.current.lastX = x;
      interactionRef.current.lastY = y;
      scheduleDraw();
      return;
    }

    if (interactionRef.current.drag) {
      const world = screenToWorld(x, y, viewRef.current);
      const { axis, index } = interactionRef.current.drag;
      if (axis === 'v') {
        const snapped = snapCut(world.x, imageWidth);
        if (snapped != null) {
          const next = moveCut(verticalRef.current, index, snapped);
          verticalRef.current = next;
          onVerticalChange(next);
          scheduleDraw();
        }
      } else {
        const snapped = snapCut(world.y, imageHeight);
        if (snapped != null) {
          const next = moveCut(horizontalRef.current, index, snapped);
          horizontalRef.current = next;
          onHorizontalChange(next);
          scheduleDraw();
        }
      }
      interactionRef.current.lastX = x;
      interactionRef.current.lastY = y;
      return;
    }

    const world = screenToWorld(x, y, viewRef.current);
    const hit = hitTestLine(
      world.x,
      world.y,
      verticalRef.current,
      horizontalRef.current,
      imageWidth,
      imageHeight,
      viewRef.current.scale,
    );
    interactionRef.current.hover = hit;

    if (hit) {
      interactionRef.current.preview = null;
    } else if (modeRef.current === 'add-v') {
      const snapped = snapCut(world.x, imageWidth);
      interactionRef.current.preview =
        snapped != null ? { axis: 'v', pos: snapped } : null;
    } else if (modeRef.current === 'add-h') {
      const snapped = snapCut(world.y, imageHeight);
      interactionRef.current.preview =
        snapped != null ? { axis: 'h', pos: snapped } : null;
    } else {
      interactionRef.current.preview = null;
    }

    setCursor(
      cursorFor(
        modeRef.current,
        hit,
        false,
        interactionRef.current.space,
      ),
    );
    scheduleDraw();
  };

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = canvasPoint(event.nativeEvent, canvas);
    const world = screenToWorld(x, y, viewRef.current);

    if (interactionRef.current.pan) {
      interactionRef.current.pan = false;
      setView(viewRef.current);
      setCursor(
        cursorFor(
          modeRef.current,
          interactionRef.current.hover,
          false,
          interactionRef.current.space,
        ),
      );
      return;
    }

    if (interactionRef.current.drag) {
      finishDrag();
      return;
    }

    if (interactionRef.current.moved) return;

    if (modeRef.current === 'add-v') {
      const snapped = snapCut(world.x, imageWidth);
      if (snapped != null) {
        const next = insertUniqueSorted(verticalRef.current, snapped);
        verticalRef.current = next;
        onVerticalChange(next);
        setSelected({ axis: 'v', index: next.indexOf(snapped) });
      }
    } else if (modeRef.current === 'add-h') {
      const snapped = snapCut(world.y, imageHeight);
      if (snapped != null) {
        const next = insertUniqueSorted(horizontalRef.current, snapped);
        horizontalRef.current = next;
        onHorizontalChange(next);
        setSelected({ axis: 'h', index: next.indexOf(snapped) });
      }
    }
  };

  const onPointerLeave = () => {
    if (interactionRef.current.pan || interactionRef.current.drag) return;
    interactionRef.current.preview = null;
    interactionRef.current.hover = null;
    scheduleDraw();
  };

  const counts = cellCount(vertical, horizontal);
  const zoomPct = Math.round(view.scale * 100);

  return (
    <Paper withBorder radius="md" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Group
        px="sm"
        py={8}
        gap="sm"
        justify="space-between"
        style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
      >
        <Group gap="sm" data-tour="mode-toggle">
          <SegmentedControl
            size="xs"
            value={mode}
            onChange={(value) => setMode(value as EditorMode)}
            data={[
              {
                value: 'pan',
                label: (
                  <Group gap={6} wrap="nowrap">
                    <IconArrowsMove size={14} />
                    Pan
                  </Group>
                ),
              },
              {
                value: 'add-v',
                label: (
                  <Group gap={6} wrap="nowrap">
                    <IconSeparatorVertical size={14} />
                    Vertical
                  </Group>
                ),
              },
              {
                value: 'add-h',
                label: (
                  <Group gap={6} wrap="nowrap">
                    <IconLineDashed size={14} />
                    Horizontal
                  </Group>
                ),
              },
            ]}
          />
          <Tooltip label="Delete selected line">
            <ActionIcon
              variant="subtle"
              color="red"
              disabled={!selected}
              onClick={deleteSelected}
              aria-label="Delete selected line"
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Fit image in view">
            <ActionIcon variant="subtle" onClick={fit} aria-label="Fit image">
              <IconFocusCentered size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Group gap="xs">
          <Badge variant="light" color="blue">
            {vertical.length} vertical
          </Badge>
          <Badge variant="light" color="orange">
            {horizontal.length} horizontal
          </Badge>
          <Badge variant="outline">{counts} cells</Badge>
          <Badge variant="outline">{zoomPct}%</Badge>
        </Group>
      </Group>

      <div
        ref={wrapRef}
        data-tour="canvas"
        style={{ flex: 1, minHeight: 0, position: 'relative' }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerLeave}
          onContextMenu={(event) => event.preventDefault()}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            touchAction: 'none',
            cursor,
            userSelect: 'none',
          }}
        />
      </div>

      <Group
        px="sm"
        py={6}
        gap="md"
        style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
      >
        <Text size="xs" c="dimmed">
          Scroll to zoom, drag to pan, or hold <Kbd size="xs">Space</Kbd>. Lines
          snap between pixels. <Kbd size="xs">V</Kbd>/<Kbd size="xs">H</Kbd> add
          lines, <Kbd size="xs">Del</Kbd> removes the selected one.
        </Text>
      </Group>
    </Paper>
  );
}
