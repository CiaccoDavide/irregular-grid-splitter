import { Anchor, Group, Text } from '@mantine/core';
import { IconBrandGithub } from '@tabler/icons-react';

export const GITHUB_REPO_URL =
  'https://github.com/CiaccoDavide/irregular-grid-splitter';

const STACK = ['React', 'Vite', 'TypeScript', 'Mantine'] as const;

export function SiteFooter() {
  return (
    <Group
      h={36}
      px="md"
      justify="space-between"
      wrap="nowrap"
      style={{
        borderTop: '1px solid var(--mantine-color-default-border)',
        flexShrink: 0,
      }}
    >
      <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
        Built with{' '}
        {STACK.map((name, index) => (
          <span key={name}>
            {index > 0 && (
              <Text span c="dimmed" size="xs">
                {index === STACK.length - 1 ? ' & ' : ', '}
              </Text>
            )}
            <Text span size="xs" c="dimmed" fw={500}>
              {name}
            </Text>
          </span>
        ))}
      </Text>
      <Group gap="xs" wrap="nowrap">
        <Anchor
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noreferrer"
          size="xs"
          c="dimmed"
          underline="hover"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <IconBrandGithub size={14} stroke={1.5} />
          Open source on GitHub
        </Anchor>
        <Text size="xs" c="dimmed">
          ·
        </Text>
        <Anchor
          href={`${GITHUB_REPO_URL}/blob/main/LICENSE`}
          target="_blank"
          rel="noreferrer"
          size="xs"
          c="dimmed"
          underline="hover"
        >
          MIT
        </Anchor>
      </Group>
    </Group>
  );
}
