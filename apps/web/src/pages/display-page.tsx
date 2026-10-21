import React, { useState } from 'react';
import { PublicCall } from '@cubiora/shared';
import { Card, Heading, Text, Badge, Flex, Box, Grid } from '@radix-ui/themes';

const INITIAL_CALLS: PublicCall[] = [
  {
    publicCode: 'TUR-000101-A1',
    cubicleDisplayName: 'Cubículo 1',
    calledAt: new Date().toISOString(),
    callNumber: 1,
  },
  {
    publicCode: 'TUR-000098-B2',
    cubicleDisplayName: 'Cubículo 2',
    calledAt: new Date(Date.now() - 1000 * 120).toISOString(),
    callNumber: 2,
  },
  {
    publicCode: 'TUR-000095-C3',
    cubicleDisplayName: 'Cubículo 3',
    calledAt: new Date(Date.now() - 1000 * 300).toISOString(),
    callNumber: 1,
  },
];

export const DisplayPage: React.FC = () => {
  const [calls] = useState<PublicCall[]>(INITIAL_CALLS);
  const currentCall = calls[0];
  const recentHistory = calls.slice(1);

  return (
    <Box className="max-w-6xl mx-auto p-4 sm:p-6">
      <header className="flex justify-between items-center mb-6 pb-4 border-b border-[var(--gray-a4)]">
        <Box>
          <Heading size="6" weight="bold">
            Pantalla de Llamados
          </Heading>
          <Text size="2" color="gray">
            Entrega de Medicamentos — Sala de Espera
          </Text>
        </Box>
        <Flex align="center" gap="2">
          <Badge color="green" size="2" variant="solid">
            ● EN VIVO
          </Badge>
        </Flex>
      </header>

      <Grid columns={{ initial: '1', md: '3' }} gap="6">
        {/* Turno Principal Llamado Actual */}
        <Box className="md:col-span-2">
          <Card size="4" className="p-8 text-center border-2 border-[var(--teal-9)] bg-[var(--color-surface)]">
            <Text
              size="2"
              weight="bold"
              color="gray"
              className="uppercase tracking-widest block mb-4"
            >
              Turno en Atención
            </Text>
            <div
              id="pantalla-turno-actual"
              className="text-5xl sm:text-7xl md:text-8xl font-extrabold font-mono-ticket my-4 text-[var(--gray-12)]"
            >
              {currentCall ? currentCall.publicCode : 'SIN LLAMADOS'}
            </div>
            <Heading
              id="pantalla-cubiculo-actual"
              size="7"
              color="teal"
              weight="bold"
              className="mt-2"
            >
              {currentCall ? currentCall.cubicleDisplayName : 'Por favor espere'}
            </Heading>
            {currentCall && currentCall.callNumber > 1 && (
              <Box className="mt-4">
                <Badge color="amber" size="3" variant="surface">
                  Llamado #{currentCall.callNumber}
                </Badge>
              </Box>
            )}
          </Card>
        </Box>

        {/* Turnos Anteriores Recientes */}
        <Box>
          <Card size="3" className="p-5 h-full border border-[var(--gray-a4)]">
            <Heading size="3" weight="bold" color="gray" className="mb-4">
              Llamados Recientes
            </Heading>
            <Flex direction="column" gap="3">
              {recentHistory.map((call, idx) => (
                <Flex
                  key={idx}
                  justify="between"
                  align="center"
                  className="p-3 bg-[var(--gray-a2)] rounded border border-[var(--gray-a4)] font-mono"
                >
                  <Text size="3" weight="bold">
                    {call.publicCode}
                  </Text>
                  <Badge color="teal" variant="surface" size="1">
                    {call.cubicleDisplayName}
                  </Badge>
                </Flex>
              ))}
            </Flex>
          </Card>
        </Box>
      </Grid>
    </Box>
  );
};
