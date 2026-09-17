import {
  ActionIcon,
  Button,
  Card,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Slider,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import {
  IconCheck,
  IconDownload,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useState, type MouseEvent } from 'react';
import {
  formatCellFilename,
  gridDimensions,
  indexPadWidth,
} from '../lib/cellFilenames';
import { downloadBlob } from '../lib/download';
import { EXPORT_FORMATS, extensionForFormat, type ExportFormat } from '../lib/exportFormat';
import type { CellImage } from '../types';

interface CellReviewProps {
  cells: CellImage[];
  namePrefix: string;
  onNamePrefixChange: (prefix: string) => void;
  exportFormat: ExportFormat;
  exportQuality: number;
  reformatting: boolean;
  onExportFormatChange: (format: ExportFormat) => void;
  onExportQualityChange: (quality: number) => void;
  onToggle: (id: string) => void;
  onSelectAll: (selected: boolean) => void;
  onSetSelected: (ids: string[], selected: boolean) => void;
  onDownloadCells: (cells: CellImage[]) => Promise<void> | void;
}

export function CellReview({
  cells,
  namePrefix,
  onNamePrefixChange,
  exportFormat,
  exportQuality,
  reformatting,
  onExportFormatChange,
  onExportQualityChange,
  onToggle,
  onSelectAll,
  onSetSelected,
  onDownloadCells,
}: CellReviewProps) {
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null);
  const [bulkZipping, setBulkZipping] = useState(false);
  const [qualityDraft, setQualityDraft] = useState(exportQuality);
  const selectedCount = cells.filter((cell) => cell.selected).length;
  const cellIdsKey = cells.map((cell) => cell.id).join('|');
  const { rowCount, colCount } = gridDimensions(cells);
  const rowPad = indexPadWidth(rowCount);
  const colPad = indexPadWidth(colCount);
  const exampleName = formatCellFilename(
    namePrefix,
    0,
    0,
    rowCount,
    colCount,
    extensionForFormat(exportFormat),
  );
  const isLossy = exportFormat !== 'image/png';

  // Reset the transient highlight whenever a fresh set of cells arrives
  // (e.g. re-splitting the grid), but not when only `selected` flags change.
  const [trackedCellIdsKey, setTrackedCellIdsKey] = useState(cellIdsKey);
  if (cellIdsKey !== trackedCellIdsKey) {
    setTrackedCellIdsKey(cellIdsKey);
    setHighlighted(new Set());
    setAnchorIndex(null);
  }

  // Keep the slider's local drag value in sync whenever the committed quality
  // changes from outside (new image loaded, format switched, etc.).
  const [trackedQuality, setTrackedQuality] = useState(exportQuality);
  if (exportQuality !== trackedQuality) {
    setTrackedQuality(exportQuality);
    setQualityDraft(exportQuality);
  }

  useHotkeys([['Escape', () => setHighlighted(new Set())]]);

  const handleCardClick = (
    event: MouseEvent<HTMLDivElement>,
    index: number,
    id: string,
  ) => {
    if (event.shiftKey && anchorIndex !== null) {
      const [start, end] =
        anchorIndex < index ? [anchorIndex, index] : [index, anchorIndex];
      setHighlighted(new Set(cells.slice(start, end + 1).map((c) => c.id)));
      return;
    }
    if (event.metaKey || event.ctrlKey) {
      setHighlighted((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setAnchorIndex(index);
      return;
    }
    setHighlighted(new Set([id]));
    setAnchorIndex(index);
  };

  const handleDownloadHighlighted = async () => {
    const subset = cells.filter((cell) => highlighted.has(cell.id));
    if (subset.length === 0) return;
    setBulkZipping(true);
    try {
      await onDownloadCells(subset);
    } finally {
      setBulkZipping(false);
    }
  };

  return (
    <div>
      <Group align="flex-start" wrap="wrap" gap="md" mb="md">
        <TextInput
          label="Filename prefix"
          description={
            <>
              Row and column numbers are appended to every file (zero-padded to
              fit the grid size). Example:{' '}
              <Text span ff="monospace" size="xs">
                {exampleName}
              </Text>
            </>
          }
          value={namePrefix}
          onChange={(event) => onNamePrefixChange(event.currentTarget.value)}
          style={{ flex: '1 1 240px' }}
        />

        <Select
          label="Export format"
          description="Cells are re-encoded from the original image, so any format works regardless of what you dropped."
          data={EXPORT_FORMATS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          value={exportFormat}
          onChange={(value) => {
            if (value) onExportFormatChange(value as ExportFormat);
          }}
          allowDeselect={false}
          disabled={reformatting}
          rightSection={reformatting ? <Loader size={14} /> : undefined}
          style={{ flex: '1 1 200px' }}
        />

        {isLossy && (
          <div style={{ flex: '1 1 220px' }}>
            <Text size="sm" fw={500} mb={4}>
              Quality: {Math.round(qualityDraft * 100)}%
            </Text>
            <Slider
              min={10}
              max={100}
              value={Math.round(qualityDraft * 100)}
              onChange={(value) => setQualityDraft(value / 100)}
              onChangeEnd={(value) => onExportQualityChange(value / 100)}
              disabled={reformatting}
              label={(value) => `${value}%`}
            />
          </div>
        )}
      </Group>

      <Group justify="space-between" mb="xs">
        <Text size="sm" c="dimmed">
          {selectedCount} of {cells.length} kept
        </Text>
        <Group gap="xs">
          <Button variant="default" size="xs" onClick={() => onSelectAll(true)}>
            Keep all
          </Button>
          <Button variant="default" size="xs" onClick={() => onSelectAll(false)}>
            Exclude all
          </Button>
        </Group>
      </Group>

      <Text size="xs" c="dimmed" mb="sm">
        Click a cell to select it, Shift-click to select a range, or Ctrl/Cmd-click
        to add individual cells.
      </Text>

      {highlighted.size > 0 && (
        <Group
          justify="space-between"
          mb="sm"
          px="sm"
          py={6}
          style={{
            background: 'var(--mantine-color-blue-light)',
            borderRadius: 8,
          }}
        >
          <Text size="sm" fw={600}>
            {highlighted.size} selected
          </Text>
          <Group gap="xs">
            <Button
              size="xs"
              variant="light"
              leftSection={<IconCheck size={14} />}
              onClick={() => onSetSelected([...highlighted], true)}
            >
              Keep
            </Button>
            <Button
              size="xs"
              variant="light"
              color="red"
              leftSection={<IconX size={14} />}
              onClick={() => onSetSelected([...highlighted], false)}
            >
              Exclude
            </Button>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconDownload size={14} />}
              loading={bulkZipping}
              onClick={handleDownloadHighlighted}
            >
              Download zip
            </Button>
            <Button
              size="xs"
              variant="subtle"
              onClick={() => setHighlighted(new Set())}
            >
              Clear
            </Button>
          </Group>
        </Group>
      )}

      <SimpleGrid
        data-tour="review-grid"
        cols={{ base: 3, sm: 4, md: 6, lg: 8, xl: 10 }}
        spacing="sm"
      >
        {cells.map((cell, index) => {
          const isHighlighted = highlighted.has(cell.id);
          const rowLabel = String(cell.row).padStart(rowPad, '0');
          const colLabel = String(cell.col).padStart(colPad, '0');
          return (
            <Card
              key={cell.id}
              withBorder
              padding="xs"
              radius="md"
              onClick={(event) => handleCardClick(event, index, cell.id)}
              style={{
                opacity: cell.selected ? 1 : 0.45,
                outline: isHighlighted
                  ? '2px solid var(--mantine-color-blue-5)'
                  : undefined,
                outlineOffset: 2,
                cursor: 'pointer',
              }}
            >
              <Card.Section
                bg="dark.8"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 56,
                  maxHeight: 96,
                  overflow: 'hidden',
                }}
              >
                <img
                  src={cell.url}
                  alt={cell.filename}
                  style={{
                    maxWidth: '100%',
                    maxHeight: 96,
                    objectFit: 'contain',
                    imageRendering: 'pixelated',
                  }}
                />
              </Card.Section>

              <div onClick={(event) => event.stopPropagation()}>
                <Group justify="space-between" mt="xs" wrap="nowrap">
                  <div style={{ minWidth: 0 }}>
                    <Text size="xs" fw={600}>
                      r{rowLabel} c{colLabel}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {cell.width}×{cell.height}
                    </Text>
                  </div>
                  <Tooltip label={cell.selected ? 'Keep this cell' : 'Skip this cell'}>
                    <Switch
                      checked={cell.selected}
                      onChange={() => onToggle(cell.id)}
                      aria-label={
                        cell.selected ? 'Keep this cell' : 'Skip this cell'
                      }
                      size="sm"
                    />
                  </Tooltip>
                </Group>

                <Group gap="xs" mt="xs" justify="flex-end">
                  <ActionIcon
                    variant="light"
                    size="sm"
                    aria-label={`Download ${cell.filename}`}
                    onClick={() => downloadBlob(cell.blob, cell.filename)}
                  >
                    <IconDownload size={14} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    color="red"
                    aria-label="Exclude cell"
                    onClick={() => {
                      if (cell.selected) onToggle(cell.id);
                    }}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              </div>
            </Card>
          );
        })}
      </SimpleGrid>
    </div>
  );
}
