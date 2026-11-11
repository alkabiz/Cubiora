import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Button,
  Callout,
  Dialog,
  Flex,
  Select,
  Text,
  TextArea,
} from '@radix-ui/themes';
import { AlertCircle, Megaphone } from 'lucide-react';

export const DEFAULT_BROADCAST_MESSAGE =
  'Atención: favor verificar número de cubículo en pantalla antes de avanzar.';

const broadcastNoticeSchema = z.object({
  message: z
    .string()
    .trim()
    .min(5, 'El mensaje debe contener al menos 5 caracteres.')
    .max(240, 'El mensaje no debe superar los 240 caracteres.'),
  severity: z.enum(['info', 'warning', 'critical']),
});

type BroadcastNoticeValues = z.infer<typeof broadcastNoticeSchema>;

export interface BroadcastNoticeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isConnected: boolean;
  onSendNotice: (message: string, severity: 'info' | 'warning' | 'critical') => boolean;
  onSentSuccess: () => void;
}

export const BroadcastNoticeDialog: React.FC<BroadcastNoticeDialogProps> = ({
  open,
  onOpenChange,
  isConnected,
  onSendNotice,
  onSentSuccess,
}) => {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BroadcastNoticeValues>({
    resolver: zodResolver(broadcastNoticeSchema) as never,
    defaultValues: {
      message: DEFAULT_BROADCAST_MESSAGE,
      severity: 'info',
    },
  });

  useEffect(() => {
    if (open) {
      setSubmitError(null);
      reset({
        message: DEFAULT_BROADCAST_MESSAGE,
        severity: 'info',
      });
    }
  }, [open, reset]);

  const handleValidSubmit = (values: BroadcastNoticeValues) => {
    setSubmitError(null);
    const sent = onSendNotice(values.message, values.severity);
    if (!sent) {
      setSubmitError('Sin conexión WebSocket activa: no fue posible emitir el aviso general.');
      return;
    }
    onSentSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="520px" aria-describedby="broadcast-notice-description">
        <Dialog.Title className="flex items-center gap-2">
          <Megaphone size={16} aria-hidden="true" />
          <span>Emitir Aviso General a Sala</span>
        </Dialog.Title>
        <Dialog.Description id="broadcast-notice-description" size="2" color="gray" mb="4">
          Proyecta un comunicado operativo en tiempo real sobre las pantallas públicas de la sede activa.
        </Dialog.Description>

        {!isConnected && !submitError && (
          <Callout.Root color="amber" role="status" mb="4">
            <Callout.Icon>
              <AlertCircle size={16} aria-hidden="true" />
            </Callout.Icon>
            <Callout.Text>
              Telemetría WebSocket desconectada: verifica la conexión en vivo antes de emitir el aviso.
            </Callout.Text>
          </Callout.Root>
        )}

        {submitError && (
          <Callout.Root color="red" role="alert" mb="4">
            <Callout.Icon>
              <AlertCircle size={16} aria-hidden="true" />
            </Callout.Icon>
            <Callout.Text>{submitError}</Callout.Text>
          </Callout.Root>
        )}

        <form onSubmit={handleSubmit(handleValidSubmit)} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="broadcast-notice-message"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Mensaje para pantallas de sala <span className="text-red-600">*</span>
            </label>
            <TextArea
              id="broadcast-notice-message"
              rows={3}
              placeholder="Escribe el comunicado operativo para sala…"
              aria-invalid={Boolean(errors.message)}
              {...register('message')}
            />
            {errors.message && (
              <Text as="p" size="1" color="red" role="alert" mt="1">
                {errors.message.message}
              </Text>
            )}
          </div>

          <div>
            <label
              htmlFor="broadcast-notice-severity"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Nivel de prioridad visual
            </label>
            <Controller
              name="severity"
              control={control}
              render={({ field }) => (
                <Select.Root value={field.value} onValueChange={field.onChange}>
                  <Select.Trigger
                    id="broadcast-notice-severity"
                    aria-label="Nivel de prioridad visual"
                    className="w-full"
                  />
                  <Select.Content>
                    <Select.Item value="info">Informativo</Select.Item>
                    <Select.Item value="warning">Advertencia operativa</Select.Item>
                    <Select.Item value="critical">Alerta prioritaria</Select.Item>
                  </Select.Content>
                </Select.Root>
              )}
            />
          </div>

          <Flex justify="end" gap="3" pt="3" className="border-t border-slate-200">
            <Dialog.Close>
              <Button type="button" variant="soft" color="gray" disabled={isSubmitting}>
                Cancelar
              </Button>
            </Dialog.Close>
            <Button type="submit" disabled={isSubmitting}>
              <Megaphone size={14} aria-hidden="true" />
              Emitir aviso en sala
            </Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
};

