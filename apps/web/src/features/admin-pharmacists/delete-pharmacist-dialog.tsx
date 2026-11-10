import React from 'react';
import { Button, Callout, Dialog, Flex, Text } from '@radix-ui/themes';
import { AlertTriangle } from 'lucide-react';
import type { PharmacistDto } from '@cubiora/shared';

interface DeletePharmacistDialogProps {
  pharmacist: PharmacistDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDeleting: boolean;
  errorMessage: string | null;
  onConfirmDelete: (id: string) => Promise<void>;
}

export const DeletePharmacistDialog: React.FC<DeletePharmacistDialogProps> = ({
  pharmacist,
  open,
  onOpenChange,
  isDeleting,
  errorMessage,
  onConfirmDelete,
}) => {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="460px" aria-describedby="delete-pharmacist-description">
        <Dialog.Title>Dar de baja a profesional farmacéutico</Dialog.Title>
        <Dialog.Description id="delete-pharmacist-description" size="2" color="gray" mb="3">
          Esta acción eliminará el registro profesional de la red de dispensación.
        </Dialog.Description>

        {pharmacist && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 mb-4 space-y-1">
            <Text as="p" size="2" weight="bold" className="text-slate-900">
              {pharmacist.fullName}
            </Text>
            <Text as="p" size="1" className="font-mono text-slate-600">
              Matrícula: {pharmacist.licenseNumber} · {pharmacist.email}
            </Text>
            {pharmacist.defaultCubicleName && (
              <Text as="p" size="1" className="text-amber-800 font-medium pt-1">
                Actualmente asignado a {pharmacist.defaultCubicleName}. El cubículo quedará
                automáticamente libre sin operador asignado.
              </Text>
            )}
          </div>
        )}

        {errorMessage && (
          <Callout.Root color="red" role="alert" mb="4">
            <Callout.Icon>
              <AlertTriangle size={16} aria-hidden="true" />
            </Callout.Icon>
            <Callout.Text>{errorMessage}</Callout.Text>
          </Callout.Root>
        )}

        <Flex justify="end" gap="3">
          <Dialog.Close>
            <Button type="button" variant="soft" color="gray" disabled={isDeleting}>
              Cancelar
            </Button>
          </Dialog.Close>
          <Button
            type="button"
            color="red"
            disabled={isDeleting || !pharmacist}
            onClick={() => {
              if (pharmacist) {
                void onConfirmDelete(pharmacist.id);
              }
            }}
          >
            {isDeleting ? 'Eliminando…' : 'Confirmar eliminación'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};

