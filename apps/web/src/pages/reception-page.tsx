import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, Heading, Text, TextField, Button, Callout, Flex, Box } from '@radix-ui/themes';
import { CheckCircledIcon } from '@radix-ui/react-icons';

const receptionSchema = z.object({
  patientName: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres'),
  patientDocument: z
    .string()
    .trim()
    .min(3, 'El documento debe tener al menos 3 caracteres'),
});

type ReceptionFormData = z.infer<typeof receptionSchema>;

export const ReceptionPage: React.FC = () => {
  const [lastCreatedTicket, setLastCreatedTicket] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReceptionFormData>({
    resolver: zodResolver(receptionSchema),
    defaultValues: {
      patientName: '',
      patientDocument: '',
    },
  });

  const onSubmit = (_data: ReceptionFormData) => {
    // Generación de turno en entorno PMV
    const generatedTicket = `T-${Math.floor(100 + Math.random() * 900)}`;
    setLastCreatedTicket(generatedTicket);
    reset();
  };

  return (
    <Box className="max-w-xl mx-auto">
      <Card size="3" className="p-6">
        <Heading size="5" weight="bold" className="mb-2">
          Registro de Turno Presencial
        </Heading>
        <Text size="2" color="gray" className="mb-6 block">
          Ingrese los datos del usuario para asignar un turno en la cola de entrega de medicamentos.
        </Text>

        {lastCreatedTicket && (
          <Callout.Root color="teal" variant="surface" className="mb-6 text-center">
            <Callout.Icon>
              <CheckCircledIcon />
            </Callout.Icon>
            <Callout.Text>
              <Text size="2" weight="medium" className="block">
                Turno Generado Exitosamente
              </Text>
              <Text size="7" weight="bold" className="font-mono-ticket block mt-1">
                {lastCreatedTicket}
              </Text>
            </Callout.Text>
          </Callout.Root>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Flex direction="column" gap="4">
            <Box>
              <label htmlFor="patientName" className="block text-sm font-medium mb-1.5 text-[var(--gray-12)]">
                Nombre Completo del Paciente
              </label>
              <TextField.Root
                id="patientName"
                placeholder="Ej. María Pérez"
                size="3"
                {...register('patientName')}
                aria-invalid={!!errors.patientName}
              />
              {errors.patientName && (
                <Text size="1" color="ruby" className="mt-1 block">
                  {errors.patientName.message}
                </Text>
              )}
            </Box>

            <Box>
              <label htmlFor="patientDocument" className="block text-sm font-medium mb-1.5 text-[var(--gray-12)]">
                Documento de Identidad
              </label>
              <TextField.Root
                id="patientDocument"
                placeholder="Ej. 1020304050"
                size="3"
                {...register('patientDocument')}
                aria-invalid={!!errors.patientDocument}
              />
              {errors.patientDocument && (
                <Text size="1" color="ruby" className="mt-1 block">
                  {errors.patientDocument.message}
                </Text>
              )}
            </Box>

            <Button
              type="submit"
              id="btn-generar-turno"
              size="3"
              color="teal"
              variant="solid"
              disabled={isSubmitting}
              className="mt-2 w-full cursor-pointer"
            >
              Generar Turno
            </Button>
          </Flex>
        </form>
      </Card>
    </Box>
  );
};
