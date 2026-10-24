import React from 'react';
import { Box, Flex, Heading, Text } from '@radix-ui/themes';

export interface PageHeaderProps {
  code?: string;
  section?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  code,
  section,
  title,
  description,
  action,
}) => {
  const contextLabel = [code, section].filter(Boolean).join(' · ');

  return (
    <header className="app-page-header">
      <Flex justify="between" align="start" gap="4" wrap="wrap">
        <Box className="app-page-header-copy">
          {contextLabel && (
            <Text as="p" size="1" weight="medium" className="app-page-eyebrow">
              {contextLabel}
            </Text>
          )}

          <Heading as="h1" size="7" weight="bold" className="app-page-title">
            {title}
          </Heading>

          {description && (
            <Text as="p" size="2" className="app-page-description">
              {description}
            </Text>
          )}
        </Box>

        {action && <Box className="app-page-header-action">{action}</Box>}
      </Flex>
    </header>
  );
};
