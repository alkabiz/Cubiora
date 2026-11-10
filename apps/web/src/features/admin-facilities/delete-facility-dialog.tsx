import React from 'react';
import { Button, Callout, Dialog, Flex, Text } from '@radix-ui/themes';
import { AlertTriangle } from 'lucide-react';
import type { FacilityDto } from '@cubiora/shared';

interface DeleteFacilityDialogProps {
  facility: FacilityDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDeleting: boolean;
  errorMessage: string | null;
  onConfirmDelete: (id: string) => Promise<void>;
}

export const DeleteFacilityDialog: React.FC<DeleteFacilityDialogProps> = ({
  facility,
  open,
  onOpenChange,
  isDeleting,
  errorMessage,
  onConfirmDelete,
}) => {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="460px" aria-describedby="delete-facility-description">
        <Dialog.Title>Eliminar sede hospitalaria</Dialog.Title>
        <Dialog.Description id="delete-facility-description" size="2" color="gray" mb="3">
          Los usuarios y cubículos vinculados quedarán desasociados de esta sede antes de su eliminación.
        </Dialog.Description>

        {facility && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 mb-4 space-y-1">
            <Text as="p" size="2" weight="bold" className="text-slate-900">
              {facility.name}
            </Text>
            <Text as="p" size="1" className="font-mono text-slate-600">
              {facility.code} · {facility.city} ({facility.pharmacistsCount} profesionales asociados)
            </Text>
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
            disabled={isDeleting || !facility}
            onClick={() => {
              if (facility) {
                void onConfirmDelete(facility.id);
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

