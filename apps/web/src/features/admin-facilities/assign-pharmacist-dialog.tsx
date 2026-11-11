import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Callout, Dialog, Flex, Select, Text } from '@radix-ui/themes';
import { AlertCircle } from 'lucide-react';
import {
  PHARMACIST_ROLE_SHORT_LABELS_ES,
  type AssignPharmacistToFacilityDto,
  type FacilityDto,
  type PharmacistDto,
} from '@cubiora/shared';
import {
  assignPharmacistFormSchema,
  UNASSIGNED_FACILITY_CUBICLE_VALUE,
  type AssignPharmacistFormValues,
} from './schemas';

interface AssignPharmacistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facility: FacilityDto | null;
  pharmacists: PharmacistDto[];
  preselectedPharmacistId: string | null;
  isSubmitting: boolean;
  onAssign: (facilityId: string, dto: AssignPharmacistToFacilityDto) => Promise<void>;
}

export const AssignPharmacistDialog: React.FC<AssignPharmacistDialogProps> = ({
  open,
  onOpenChange,
  facility,
  pharmacists,
  preselectedPharmacistId,
  isSubmitting,
  onAssign,
}) => {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AssignPharmacistFormValues>({
    resolver: zodResolver(assignPharmacistFormSchema),
    defaultValues: {
      pharmacistId: preselectedPharmacistId ?? pharmacists[0]?.id ?? '',
      cubicleId: UNASSIGNED_FACILITY_CUBICLE_VALUE,
    },
  });

  useEffect(() => {
    if (open) {
      setServerError(null);
      const selectedPharm = pharmacists.find((p) => p.id === preselectedPharmacistId);
      const matchingCubicle =
        selectedPharm?.defaultCubicleId &&
        facility?.cubicles.some((c) => c.id === selectedPharm.defaultCubicleId)
          ? selectedPharm.defaultCubicleId
          : UNASSIGNED_FACILITY_CUBICLE_VALUE;

      reset({
        pharmacistId: preselectedPharmacistId ?? pharmacists[0]?.id ?? '',
        cubicleId: matchingCubicle,
      });
    }
  }, [open, facility, pharmacists, preselectedPharmacistId, reset]);

  const onValidSubmit = async (values: AssignPharmacistFormValues) => {
    if (!facility) return;
    setServerError(null);
    try {
      await onAssign(facility.id, {
        pharmacistId: values.pharmacistId,
        cubicleId:
          values.cubicleId === UNASSIGNED_FACILITY_CUBICLE_VALUE
            ? null
            : values.cubicleId,
      });
      onOpenChange(false);
    } catch (err: unknown) {
      setServerError(
        err instanceof Error
          ? err.message
          : 'No fue posible asociar el profesional a la sede.',
      );
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="520px" aria-describedby="assign-pharmacist-description">
        <Dialog.Title>
          {preselectedPharmacistId
            ? 'Reasignar Farmacéutico en Sede'
            : 'Asociar Farmacéutico a Sede'}
        </Dialog.Title>
        <Dialog.Description id="assign-pharmacist-description" size="2" color="gray" mb="4">
          {facility
            ? `Selecciona un farmacéutico registrado para asociarlo a ${facility.name} (${facility.code}) y opcionalmente asignarle una ventanilla física.`
            : 'Selecciona el profesional farmacéutico y cubículo asignado.'}
        </Dialog.Description>

        {serverError && (
          <Callout.Root color="red" role="alert" mb="4">
            <Callout.Icon>
              <AlertCircle size={16} aria-hidden="true" />
            </Callout.Icon>
            <Callout.Text>{serverError}</Callout.Text>
          </Callout.Root>
        )}

        <form onSubmit={handleSubmit(onValidSubmit)} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="assign-pharmacist-select"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Seleccionar Farmacéutico Disponible <span className="text-red-600">*</span>
            </label>
            <Controller
              name="pharmacistId"
              control={control}
              render={({ field }) => (
                <Select.Root
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={pharmacists.length === 0}
                >
                  <Select.Trigger
                    id="assign-pharmacist-select"
                    aria-label="Seleccionar Farmacéutico Disponible"
                    placeholder="Selecciona un profesional..."
                    className="w-full"
                  />
                  <Select.Content>
                    {pharmacists.map((p) => (
                      <Select.Item key={p.id} value={p.id}>
                        {`${p.fullName} (${p.licenseNumber} - ${PHARMACIST_ROLE_SHORT_LABELS_ES[p.operationalRole]})`}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              )}
            />
            {errors.pharmacistId && (
              <Text as="p" size="1" color="red" role="alert" mt="1">
                {errors.pharmacistId.message}
              </Text>
            )}
          </div>

          <div>
            <label
              htmlFor="assign-facility-cubicle-select"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Ventanilla física / Cubículo (opcional)
            </label>
            <Controller
              name="cubicleId"
              control={control}
              render={({ field }) => (
                <Select.Root value={field.value} onValueChange={field.onChange}>
                  <Select.Trigger
                    id="assign-facility-cubicle-select"
                    aria-label="Cubículo dentro de la sede"
                    className="w-full"
                  />
                  <Select.Content>
                    <Select.Item value={UNASSIGNED_FACILITY_CUBICLE_VALUE}>
                      Sin cubículo específico
                    </Select.Item>
                    {(facility?.cubicles ?? []).map((cub) => (
                      <Select.Item key={cub.id} value={cub.id}>
                        {cub.operatorName
                          ? `${cub.displayName} (${cub.shortCode}) — actual: ${cub.operatorName}`
                          : `${cub.displayName} (${cub.shortCode})`}
                      </Select.Item>
                    ))}
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
            <Button
              type="submit"
              disabled={isSubmitting || pharmacists.length === 0}
            >
              {isSubmitting ? 'Asociando…' : 'Confirmar Asociación'}
            </Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
};

