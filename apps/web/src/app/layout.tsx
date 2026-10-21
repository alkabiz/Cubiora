import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Box, Flex, Container, Heading, Text, Badge, Button } from '@radix-ui/themes';

export const Layout: React.FC = () => {
  const location = useLocation();

  const isCurrent = (path: string) => location.pathname === path;
  const isDisplayMode = location.pathname === '/pantalla';

  return (
    <Box className="min-h-screen flex flex-col bg-[var(--color-background)]">
      {!isDisplayMode && (
        <header className="border-b border-[var(--gray-a4)] bg-[var(--color-surface)] px-4 py-3 sm:px-6">
          <Container size="4">
            <Flex justify="between" align="center" gap="4" wrap="wrap">
              <Flex align="center" gap="3">
                <Badge size="2" variant="solid" color="teal" className="w-8 h-8 flex items-center justify-center font-bold">
                  C
                </Badge>
                <Heading size="4" weight="bold">
                  Cubiora
                </Heading>
                <Badge size="1" variant="surface" color="teal">
                  FarmaTurnos PMV
                </Badge>
              </Flex>

              <nav aria-label="Navegación principal">
                <Flex gap="2" align="center" wrap="wrap">
                  <Button
                    variant={isCurrent('/recepcion') ? 'solid' : 'ghost'}
                    color="teal"
                    size="2"
                    asChild
                  >
                    <Link to="/recepcion">Recepción</Link>
                  </Button>
                  <Button
                    variant={isCurrent('/cajero') ? 'solid' : 'ghost'}
                    color="teal"
                    size="2"
                    asChild
                  >
                    <Link to="/cajero">Atención (Cubículo)</Link>
                  </Button>
                  <Button
                    variant={isCurrent('/pantalla') ? 'solid' : 'ghost'}
                    color="teal"
                    size="2"
                    asChild
                  >
                    <Link to="/pantalla">Pantalla Sala</Link>
                  </Button>
                  <Button
                    variant={isCurrent('/login') ? 'solid' : 'ghost'}
                    color="teal"
                    size="2"
                    asChild
                  >
                    <Link to="/login">Acceso</Link>
                  </Button>
                </Flex>
              </nav>
            </Flex>
          </Container>
        </header>
      )}

      <Box className="flex-1 p-4 sm:p-6 md:p-8" asChild>
        <main>
          <Container size="4">
            <Outlet />
          </Container>
        </main>
      </Box>

      {!isDisplayMode && (
        <footer className="border-t border-[var(--gray-a4)] py-4 text-center">
          <Text size="1" color="gray">
            Cubiora &copy; {new Date().getFullYear()} — Sistema Presencial de Gestión de Turnos de Medicamentos
          </Text>
        </footer>
      )}
    </Box>
  );
};
