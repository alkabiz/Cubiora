import React from 'react';
import { Link } from 'react-router-dom';
import { Box, Flex, Heading, Text } from '@radix-ui/themes';
import { ArrowLeft } from 'lucide-react';

export interface PageHeaderProps {
  section?: string;
  eyebrowBadge?: React.ReactNode;
  title: string;
  titleBadge?: React.ReactNode;
  backTo?: string;
  backLabel?: string;
  description?: string;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  section,
  eyebrowBadge,
  title,
  titleBadge,
  backTo,
  backLabel,
  description,
  action,
}) => {
  return (
    <header className="app-page-header">
      <Flex justify="between" align="start" gap="4" wrap="wrap">
        <Box className="app-page-header-copy">
          {(section || eyebrowBadge) && (
            <Flex align="center" gap="2" wrap="wrap" className="app-page-eyebrow-row">
              {section && (
                <Text as="p" size="1" weight="medium" className="app-page-eyebrow">
                  {section}
                </Text>
              )}
              {eyebrowBadge}
            </Flex>
          )}

          <Flex align="center" gap="2" wrap="wrap">
            {backTo && (
              <Link
                to={backTo}
                aria-label={backLabel ?? 'Volver'}
                className="inline-flex items-center justify-center min-w-[32px] min-h-[32px] -ml-1.5 rounded-md text-[var(--app-primary)] hover:text-[var(--app-primary-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus)] focus-visible:ring-offset-2"
              >
                <ArrowLeft className="w-5 h-5" aria-hidden="true" />
              </Link>
            )}

            <Heading as="h1" size="7" weight="bold" className="app-page-title">
              {title}
            </Heading>

            {titleBadge}
          </Flex>

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
