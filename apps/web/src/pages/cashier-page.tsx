import React, { useState } from 'react';
import { Card, Heading, Text, Select, Button, Badge, Flex, Box } from '@radix-ui/themes';

export const CashierPage: React.FC = () => {
  const [cubicleNumber, setCubicleNumber] = useState(1);
  const [currentTicket, setCurrentTicket] = useState<string | null>(null);
  const [callCount, setCallCount] = useState(0);

  const handleCallNext = () => {
    const nextTicket = `TUR-000${Math.floor(100 + Math.random() * 900)}-X1`;
    setCurrentTicket(nextTicket);
    setCallCount(1);
  };

  const handleRepeatCall = () => {
    if (callCount < 3) {
      setCallCount((prev) => prev + 1);
    }
  };

  const handleComplete = () => {
    setCurrentTicket(null);
    setCallCount(0);
  };

  const handleNoShow = () => {
    setCurrentTicket(null);
    setCallCount(0);
  };

  return (
    <Box className="max-w-2xl mx-auto">
      <Card size="3" className="p-6">
        <Flex justify="between" align="center" className="mb-6" wrap="wrap" gap="3">
          <Box>
            <Heading size="5" weight="bold">
              Atención en Cubículo
            </Heading>
            <Text size="2" color="gray">
              Gestión de atención y llamado presencial
            </Text>
          </Box>

          <Flex align="center" gap="2">
            <label htmlFor="cubicle-select" className="text-sm font-medium text-[var(--gray-12)]">
              Cubículo:
            </label>
            <Select.Root
              value={String(cubicleNumber)}
              onValueChange={(val) => setCubicleNumber(Number(val))}
            >
              <Select.Trigger id="cubicle-select" aria-label="Seleccionar Cubículo" />
              <Select.Content>
                <Select.Item value="1">Cubículo 1</Select.Item>
                <Select.Item value="2">Cubículo 2</Select.Item>
                <Select.Item value="3">Cubículo 3</Select.Item>
              </Select.Content>
            </Select.Root>
          </Flex>
        </Flex>

        {/* Estado actual del turno */}
        <Card variant="surface" size="3" className="mb-6 p-8 text-center border border-[var(--gray-a4)]">
          {currentTicket ? (
            <Flex direction="column" align="center" gap="2">
              <Badge color="teal" size="1" variant="surface">
                TURNO EN ATENCIÓN ACTUAL
              </Badge>
              <Text size="8" weight="bold" className="font-mono-ticket block my-2">
                {currentTicket}
              </Text>
              <Badge color="amber" size="2" variant="solid">
                Llamados: {callCount} de 3
              </Badge>
            </Flex>
          ) : (
            <Flex direction="column" align="center" gap="1" className="py-4">
              <Text size="4" weight="bold" color="gray">
                Cubículo disponible
              </Text>
              <Text size="2" color="gray">
                Presione &quot;Llamar Siguiente Turno&quot; para avanzar la cola FIFO
              </Text>
            </Flex>
          )}
        </Card>

        {/* Botones de acción */}
        <Flex gap="3" wrap="wrap">
          {!currentTicket ? (
            <Button
              id="btn-llamar-siguiente"
              onClick={handleCallNext}
              size="3"
              color="teal"
              variant="solid"
              className="flex-1 cursor-pointer"
            >
              Llamar Siguiente Turno
            </Button>
          ) : (
            <>
              <Button
                id="btn-rellamar"
                onClick={handleRepeatCall}
                disabled={callCount >= 3}
                size="3"
                variant="surface"
                color="teal"
                className="flex-1 cursor-pointer"
              >
                Re-Llamar ({callCount}/3)
              </Button>
              <Button
                id="btn-finalizar"
                onClick={handleComplete}
                size="3"
                variant="solid"
                color="teal"
                className="flex-1 cursor-pointer"
              >
                Completar Entrega
              </Button>
              <Button
                id="btn-no-show"
                onClick={handleNoShow}
                size="3"
                variant="soft"
                color="amber"
                className="cursor-pointer"
              >
                No Presentado
              </Button>
            </>
          )}
        </Flex>
      </Card>
    </Box>
  );
};
