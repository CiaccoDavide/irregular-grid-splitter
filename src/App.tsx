import {
  ActionIcon,
  Alert,
  AppShell,
  Badge,
  Button,
  Container,
  Group,
  Loader,
  ScrollArea,
  Text,
  Title,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconDownload,
  IconHelpCircle,
  IconMoon,
  IconSparkles,
  IconSun,
} from '@tabler/icons-react';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CellReview } from './components/CellReview';
import { GridEditor } from './components/GridEditor';
import { ImageDropzone } from './components/ImageDropzone';
import { SiteFooter } from './components/SiteFooter';
import {
  sanitizeNamePrefix,
  withFilenamePrefix,
} from './lib/cellFilenames';
import { downloadZip } from './lib/download';
import {
  DEFAULT_EXPORT_QUALITY,
  defaultExportFormat,
  extensionForFormat,
  type ExportFormat,
} from './lib/exportFormat';
import { revokeCells, splitGrid } from './lib/splitGrid';
import { getTourSteps, hasSeenTutorial, markTutorialSeen } from './lib/tutorial';
import './tutorial.css';
import type { CellImage, LoadedImage } from './types';

const STEPS = ['Load', 'Grid', 'Export'] as const;
const SITE_FOOTER_HEIGHT = 36;
const ACTION_FOOTER_HEIGHT = 64;

function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme('dark');
  const dark = computed === 'dark';
  return (
    <ActionIcon
      variant="subtle"
      size="lg"
      aria-label="Toggle color scheme"
      onClick={() => setColorScheme(dark ? 'light' : 'dark')}
    >
      {dark ? <IconSun size={18} /> : <IconMoon size={18} />}
    </ActionIcon>
  );
}

export default function App() {
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState<LoadedImage | null>(null);
  const [vertical, setVertical] = useState<number[]>([]);
  const [horizontal, setHorizontal] = useState<number[]>([]);
  const [cells, setCells] = useState<CellImage[]>([]);
  const [namePrefix, setNamePrefix] = useState('image');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('image/png');
  const [exportQuality, setExportQuality] = useState(DEFAULT_EXPORT_QUALITY);
  const [splitting, setSplitting] = useState(false);
  const [reformatting, setReformatting] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [tutorialActive, setTutorialActive] = useState(false);
  const [showBanner, setShowBanner] = useState(() => !hasSeenTutorial());
  const loadedRef = useRef(loaded);
  const cellsRef = useRef(cells);
  const stepRef = useRef(step);
  const driverRef = useRef<Driver | null>(null);
  const cancelledRef = useRef(false);
  const touredStepRef = useRef<number | null>(null);

  useEffect(() => {
    loadedRef.current = loaded;
  }, [loaded]);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    cellsRef.current = cells;
  }, [cells]);

  useEffect(() => {
    return () => {
      if (loadedRef.current) URL.revokeObjectURL(loadedRef.current.objectUrl);
      revokeCells(cellsRef.current);
      driverRef.current?.destroy();
    };
  }, []);

  const runTourForStep = useCallback((targetStep: number) => {
    const steps = getTourSteps(targetStep);
    if (steps.length === 0) return;

    driverRef.current?.destroy();
    cancelledRef.current = false;
    touredStepRef.current = targetStep;

    const instance = driver({
      showProgress: steps.length > 1,
      allowClose: true,
      overlayOpacity: 0.65,
      stagePadding: 6,
      stageRadius: 8,
      steps,
      onCloseClick: () => {
        cancelledRef.current = true;
        instance.destroy();
      },
      onDestroyed: () => {
        driverRef.current = null;
        if (cancelledRef.current || targetStep >= 2) {
          setTutorialActive(false);
          markTutorialSeen();
        }
      },
    });
    driverRef.current = instance;
    instance.drive();
  }, []);

  const startTutorial = useCallback(() => {
    setShowBanner(false);
    setTutorialActive(true);
    runTourForStep(stepRef.current);
  }, [runTourForStep]);

  useEffect(() => {
    if (!tutorialActive) return;
    if (touredStepRef.current === step) return;
    const timeout = window.setTimeout(() => runTourForStep(step), 400);
    return () => window.clearTimeout(timeout);
  }, [step, tutorialActive, runTourForStep]);

  const dismissBanner = () => {
    setShowBanner(false);
    markTutorialSeen();
  };

  const handleLoaded = (next: LoadedImage) => {
    if (loaded) URL.revokeObjectURL(loaded.objectUrl);
    revokeCells(cells);
    setLoaded(next);
    setNamePrefix(next.stem);
    setExportFormat(defaultExportFormat(next.file.type));
    setExportQuality(DEFAULT_EXPORT_QUALITY);
    setVertical([]);
    setHorizontal([]);
    setCells([]);
    setStep(1);
  };

  const handleNamePrefixChange = (prefix: string) => {
    setNamePrefix(prefix);
    setCells((current) =>
      withFilenamePrefix(current, prefix, extensionForFormat(exportFormat)),
    );
  };

  const handleConfirm = async () => {
    if (!loaded) return;
    if (vertical.length + horizontal.length === 0) {
      notifications.show({
        color: 'yellow',
        title: 'Add at least one line',
        message: 'Place a vertical or horizontal cut before splitting.',
      });
      return;
    }
    setSplitting(true);
    try {
      const prefix = sanitizeNamePrefix(namePrefix || loaded.stem);
      const next = await splitGrid(
        loaded.image,
        vertical,
        horizontal,
        prefix,
        exportFormat,
        exportQuality,
      );
      revokeCells(cells);
      setNamePrefix(prefix);
      setCells(next);
      setStep(2);
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Split failed',
        message: error instanceof Error ? error.message : 'Could not split the image.',
      });
    } finally {
      setSplitting(false);
    }
  };

  const reencode = async (format: ExportFormat, quality: number) => {
    if (!loaded || cells.length === 0 || reformatting) return;
    setReformatting(true);
    try {
      const prefix = sanitizeNamePrefix(namePrefix);
      const next = await splitGrid(
        loaded.image,
        vertical,
        horizontal,
        prefix,
        format,
        quality,
      );
      const previousSelection = new Map(cells.map((cell) => [cell.id, cell.selected]));
      const merged = next.map((cell) => ({
        ...cell,
        selected: previousSelection.get(cell.id) ?? true,
      }));
      revokeCells(cells);
      setExportFormat(format);
      setExportQuality(quality);
      setCells(merged);
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Could not change export format',
        message: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setReformatting(false);
    }
  };

  const handleExportFormatChange = (format: ExportFormat) => {
    void reencode(format, exportQuality);
  };

  const handleExportQualityChange = (quality: number) => {
    void reencode(exportFormat, quality);
  };

  const handleDownloadSelected = async () => {
    const selected = cells.filter((cell) => cell.selected);
    if (selected.length === 0) return;
    const prefix = sanitizeNamePrefix(namePrefix);
    setZipping(true);
    try {
      await downloadZip(selected, `${prefix}_cells.zip`);
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Download failed',
        message: error instanceof Error ? error.message : 'Could not create the zip.',
      });
    } finally {
      setZipping(false);
    }
  };

  const handleDownloadCells = async (subset: CellImage[]) => {
    if (subset.length === 0) return;
    const prefix = sanitizeNamePrefix(namePrefix);
    try {
      await downloadZip(subset, `${prefix}_selection.zip`);
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Download failed',
        message: error instanceof Error ? error.message : 'Could not create the zip.',
      });
    }
  };

  const handleSetSelected = (ids: string[], selected: boolean) => {
    const idSet = new Set(ids);
    setCells((current) =>
      current.map((cell) =>
        idSet.has(cell.id) ? { ...cell, selected } : cell,
      ),
    );
  };

  const selectedCount = cells.filter((cell) => cell.selected).length;
  const canConfirm = vertical.length + horizontal.length > 0;
  const footerHeight =
    SITE_FOOTER_HEIGHT + (step === 0 ? 0 : ACTION_FOOTER_HEIGHT);

  return (
    <AppShell
      header={{ height: 56 }}
      footer={{ height: footerHeight }}
      padding={0}
      styles={{
        root: { height: '100%' },
        main: { flex: 1, minHeight: 0 },
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="md">
            <Title order={4}>Irregular Grid Splitter</Title>
            <Group gap={6}>
              {STEPS.map((label, index) => (
                <Badge
                  key={label}
                  variant={step === index ? 'filled' : 'light'}
                  color={step === index ? 'blue' : 'gray'}
                >
                  {index + 1}. {label}
                </Badge>
              ))}
            </Group>
          </Group>
          <Group gap="sm">
            <Tooltip label="Start the interactive tutorial">
              <ActionIcon
                variant="subtle"
                size="lg"
                aria-label="Start tutorial"
                onClick={startTutorial}
              >
                <IconHelpCircle size={18} />
              </ActionIcon>
            </Tooltip>
            <ColorSchemeToggle />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main
        style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          height: '100%',
        }}
      >
        {step === 0 && (
          <Container size="sm" py="xl" style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '100%' }}>
              {showBanner && (
                <Alert
                  variant="light"
                  color="blue"
                  title="New here?"
                  icon={<IconSparkles size={18} />}
                  withCloseButton
                  onClose={dismissBanner}
                  mb="lg"
                >
                  <Group justify="space-between" wrap="wrap" gap="sm">
                    <Text size="sm">
                      Take a 60-second interactive tour of the whole workflow.
                    </Text>
                    <Group gap="xs" wrap="nowrap">
                      <Button size="xs" onClick={startTutorial}>
                        Start tour
                      </Button>
                      <Button size="xs" variant="subtle" onClick={dismissBanner}>
                        Maybe later
                      </Button>
                    </Group>
                  </Group>
                </Alert>
              )}
              <Title order={2} mb="xs">
                Load an image
              </Title>
              <Text c="dimmed" mb="lg">
                Drop a sprite sheet or other raster image. Next you will draw
                an irregular grid over it, then export only the cells you want.
              </Text>
              <ImageDropzone onLoaded={handleLoaded} />
            </div>
          </Container>
        )}

        {step === 1 && loaded && (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              padding: 12,
            }}
          >
            <GridEditor
              image={loaded.image}
              imageWidth={loaded.width}
              imageHeight={loaded.height}
              vertical={vertical}
              horizontal={horizontal}
              onVerticalChange={setVertical}
              onHorizontalChange={setHorizontal}
            />
          </div>
        )}

        {step === 2 && (
          <ScrollArea style={{ flex: 1 }} type="auto" p="md">
            <Container size="xl" px={0}>
              <Title order={3} mb="xs">
                Review cells
              </Title>
              <Text c="dimmed" mb="md">
                Uncheck cells you do not want. Download any cell on its own, or
                zip the ones you kept.
              </Text>
              <CellReview
                cells={cells}
                namePrefix={namePrefix}
                onNamePrefixChange={handleNamePrefixChange}
                exportFormat={exportFormat}
                exportQuality={exportQuality}
                reformatting={reformatting}
                onExportFormatChange={handleExportFormatChange}
                onExportQualityChange={handleExportQualityChange}
                onToggle={(id) =>
                  setCells((current) =>
                    current.map((cell) =>
                      cell.id === id
                        ? { ...cell, selected: !cell.selected }
                        : cell,
                    ),
                  )
                }
                onSelectAll={(selected) =>
                  setCells((current) =>
                    current.map((cell) => ({ ...cell, selected })),
                  )
                }
                onSetSelected={handleSetSelected}
                onDownloadCells={handleDownloadCells}
              />
            </Container>
          </ScrollArea>
        )}
      </AppShell.Main>

      <AppShell.Footer>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {step !== 0 && (
            <Group h={ACTION_FOOTER_HEIGHT} px="md" justify="space-between" style={{ flexShrink: 0 }}>
              <div>
                {step === 1 && (
                  <Button
                    variant="default"
                    leftSection={<IconArrowLeft size={16} />}
                    onClick={() => setStep(0)}
                  >
                    Change image
                  </Button>
                )}
                {step === 2 && (
                  <Button
                    variant="default"
                    leftSection={<IconArrowLeft size={16} />}
                    onClick={() => setStep(1)}
                  >
                    Edit grid
                  </Button>
                )}
              </div>
              <Group>
                {step === 1 && (
                  <Button
                    onClick={() => {
                      setVertical([]);
                      setHorizontal([]);
                    }}
                    variant="subtle"
                    disabled={vertical.length + horizontal.length === 0}
                  >
                    Clear lines
                  </Button>
                )}
                {step === 1 && (
                  <Button
                    data-tour="confirm-grid"
                    onClick={handleConfirm}
                    disabled={!canConfirm || splitting}
                    leftSection={splitting ? <Loader size={16} /> : undefined}
                  >
                    Confirm grid
                  </Button>
                )}
                {step === 2 && (
                  <Button
                    data-tour="download-selected"
                    onClick={handleDownloadSelected}
                    disabled={selectedCount === 0 || zipping}
                    leftSection={
                      zipping ? <Loader size={16} /> : <IconDownload size={16} />
                    }
                  >
                    Download selected ({selectedCount})
                  </Button>
                )}
              </Group>
            </Group>
          )}
          <SiteFooter />
        </div>
      </AppShell.Footer>
    </AppShell>
  );
}
