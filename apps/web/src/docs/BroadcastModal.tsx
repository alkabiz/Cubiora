import React, { useState } from 'react';
import { usePharmacy } from '../context/PharmacyContext';
import {
  Dialog,
  Flex,
  Box,
  Text,
  TextArea,
  Button,
  SegmentedControl,
  Separator,
  Card,
} from '@radix-ui/themes';
import { Megaphone, Send, AlertTriangle, Info, BellRing } from 'lucide-react';

export const BroadcastModal: React.FC = () => {
  const { broadcastModalOpen, setBroadcastModalOpen, sendBroadcastAlert } = usePharmacy();
  const [message, setMessage] = useState(
    'Mantener verificación continua de tiempos de espera en sala y dispensación prioritaria.'
  );
  const [priority, setPriority] = useState<'info' | 'warning' | 'urgent'>('info');

  const quickTemplates = [
    'Mantener verificación continua de tiempos de espera en sala.',
    'Flujo de atención preferente en cubículos 01 y 03.',
    'Optimizar tiempos de atención para reducir cola general.',
    'Cambio de turno operativo programado en 15 minutos.',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    sendBroadcastAlert(message.trim());
    setBroadcastModalOpen(false);
  };

  return (
    <Dialog.Root open={broadcastModalOpen} onOpenChange={setBroadcastModalOpen}>
      <Dialog.Content size="3" maxWidth="520px" className="p-6">
        {/* Header */}
        <Flex align="center" gap="3" className="pb-3 border-b border-[var(--gray-a4)]">
          <div className="w-10 h-10 rounded-lg bg-[var(--teal-a3)] flex items-center justify-center text-[var(--teal-11)] shrink-0">
            <Megaphone className="w-5 h-5" />
          </div>
          <Box>
            <Dialog.Title size="4" weight="bold" className="text-[#001428] m-0">
              Transmitir Aviso General
            </Dialog.Title>
            <Dialog.Description size="2" color="gray" className="m-0 mt-0.5">
              Emisión inmediata a todos los cubículos y monitor de sala
            </Dialog.Description>
          </Box>
        </Flex>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4">
          <Box>
            <Text as="label" size="2" weight="bold" className="block text-[#001428] mb-1.5">
              Nivel de Prioridad del Comunicado
            </Text>
            <SegmentedControl.Root
              value={priority}
              onValueChange={(val) => setPriority(val as 'info' | 'warning' | 'urgent')}
              size="2"
              className="w-full"
            >
              <SegmentedControl.Item value="info" className="cursor-pointer flex items-center gap-1.5 font-semibold">
                <Info className="w-3.5 h-3.5" />
                Informativo
              </SegmentedControl.Item>
              <SegmentedControl.Item value="warning" className="cursor-pointer flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Atención
              </SegmentedControl.Item>
              <SegmentedControl.Item value="urgent" className="cursor-pointer flex items-center gap-1.5 font-semibold">
                <BellRing className="w-3.5 h-3.5 text-red-600" />
                Urgente
              </SegmentedControl.Item>
            </SegmentedControl.Root>
          </Box>

          <Box>
            <Text as="label" size="2" weight="bold" className="block text-[#001428] mb-1.5">
              Mensaje del Aviso
            </Text>
            <TextArea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escriba el comunicado para los operadores y la sala..."
              required
              size="2"
              className="w-full"
            />
          </Box>

          <Box>
            <Text size="1" weight="bold" color="gray" className="block mb-2">
              Plantillas Rápidas
            </Text>
            <Flex direction="column" gap="1.5">
              {quickTemplates.map((t, idx) => (
                <Card
                  key={idx}
                  variant="surface"
                  size="1"
                  onClick={() => setMessage(t)}
                  className="p-2 cursor-pointer transition-colors hover:bg-[var(--teal-a2)] hover:border-[var(--teal-7)] border-dashed border-[var(--gray-a5)]"
                >
                  <Text size="1" color="gray" className="hover:text-[var(--teal-11)] block">
                    &ldquo;{t}&rdquo;
                  </Text>
                </Card>
              ))}
            </Flex>
          </Box>

          <Separator size="4" className="my-1" />

          {/* Footer actions */}
          <Flex justify="end" align="center" gap="3">
            <Dialog.Close>
              <Button type="button" variant="soft" color="gray" className="cursor-pointer font-semibold">
                Cancelar
              </Button>
            </Dialog.Close>
            <Button
              type="submit"
              color="teal"
              variant="solid"
              className="cursor-pointer font-bold flex items-center gap-2 px-5 shadow-xs"
            >
              <Send className="w-4 h-4" />
              <span>Emitir a Sala</span>
            </Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
};
