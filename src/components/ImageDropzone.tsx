import { Group, Text, useComputedColorScheme } from '@mantine/core';
import { Dropzone, type FileRejection } from '@mantine/dropzone';
import { notifications } from '@mantine/notifications';
import { IconPhoto, IconUpload, IconX } from '@tabler/icons-react';
import { ACCEPTED_IMAGE_MIME_TYPES, loadImage } from '../lib/loadImage';
import type { LoadedImage } from '../types';

interface ImageDropzoneProps {
  onLoaded: (image: LoadedImage) => void;
}

export function ImageDropzone({ onLoaded }: ImageDropzoneProps) {
  const scheme = useComputedColorScheme('dark');

  const handleFiles = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    try {
      onLoaded(await loadImage(file));
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Could not load image',
        message:
          error instanceof Error ? error.message : 'Please drop a supported image file.',
      });
    }
  };

  const handleReject = (rejections: FileRejection[]) => {
    const message =
      rejections[0]?.errors[0]?.message ??
      'Unsupported file. Try PNG, JPEG, WebP, GIF, BMP, or AVIF.';
    notifications.show({
      color: 'red',
      title: 'File rejected',
      message,
    });
  };

  return (
    <Dropzone
      data-tour="dropzone"
      accept={[...ACCEPTED_IMAGE_MIME_TYPES]}
      maxFiles={1}
      onDrop={handleFiles}
      onReject={handleReject}
      radius="lg"
      p="xl"
      style={{
        borderWidth: 2,
        background:
          scheme === 'dark'
            ? 'var(--mantine-color-dark-6)'
            : 'var(--mantine-color-gray-0)',
      }}
    >
      <Group justify="center" gap="xl" mih={220} style={{ pointerEvents: 'none' }}>
        <Dropzone.Accept>
          <IconUpload size={52} stroke={1.5} />
        </Dropzone.Accept>
        <Dropzone.Reject>
          <IconX size={52} stroke={1.5} color="var(--mantine-color-red-6)" />
        </Dropzone.Reject>
        <Dropzone.Idle>
          <IconPhoto size={52} stroke={1.5} color="var(--mantine-color-dimmed)" />
        </Dropzone.Idle>
        <div>
          <Text size="xl" inline>
            Drop an image here, or click to browse
          </Text>
          <Text size="sm" c="dimmed" inline mt={7}>
            PNG, JPEG, WebP, GIF, BMP, or AVIF. The file stays on your machine.
          </Text>
        </div>
      </Group>
    </Dropzone>
  );
}
