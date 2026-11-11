import React, { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Callout,
  Dialog,
  Flex,
  Select,
  Text,
  TextField,
} from '@radix-ui/themes';
import { AlertCircle } from 'lucide-react';
import {
  PHARMACIST_ROLE_LABELS_ES,
  PHARMACIST_STATUS_LABELS_ES,
  PharmacistOperationalRole,
  PharmacistStatus,
  WORK_SHIFT_LABELS_ES,
  WorkShift,
  type CreatePharmacistDto,
  type FacilityDto,
  type PharmacistDto,
  type UpdatePharmacistDto,
} from '@cubiora/shared';
import {
  pharmacistFormSchema,
  UNASSIGNED_CUBICLE_VALUE,
  UNASSIGNED_FACILITY_VALUE,
  type PharmacistFormValues,
} from './schemas';

interface PharmacistFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initialPharmacist: PharmacistDto | null;
  facilities: FacilityDto[];
  isSubmitting: boolean;
  onSubmitForm: (payload: CreatePharmacistDto | UpdatePharmacistDto) => Promise<void>;
}

export const PharmacistFormDialog: React.FC<PharmacistFormDialogProps> = ({
  open,
  onOpenChange,
  mode,
  initialPharmacist,
  facilities,
  isSubmitting,
  onSubmitForm,
}) => {
  const [serverError, setServerError] = useState<string | null>(null);

  const defaultFacilityId = useMemo(() => {
    if (initialPharmacist?.facilityId) return initialPharmacist.facilityId;
    const primary = facilities.find((f) => f.isPrimary) ?? facilities[0];
    return primary?.id ?? UNASSIGNED_FACILITY_VALUE;
  }, [initialPharmacist, facilities]);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<PharmacistFormValues>({
    resolver: zodResolver(pharmacistFormSchema),
    defaultValues: {
      fullName: initialPharmacist?.fullName ?? '',
      licenseNumber: initialPharmacist?.licenseNumber ?? '',
      operationalRole:
        initialPharmacist?.operationalRole ?? PharmacistOperationalRole.TITULAR,
      facilityId: defaultFacilityId,
      defaultCubicleId:
        initialPharmacist?.defaultCubicleId ?? UNASSIGNED_CUBICLE_VALUE,
      shift: initialPharmacist?.shift ?? WorkShift.MORNING,
      status: initialPharmacist?.status ?? PharmacistStatus.ACTIVE,
      email: initialPharmacist?.email ?? '',
      phone: initialPharmacist?.phone ?? '+57 300 ',
    },
  });

  useEffect(() => {
    if (open) {
      setServerError(null);
      reset({
        fullName: initialPharmacist?.fullName ?? '',
        licenseNumber: initialPharmacist?.licenseNumber ?? '',
        operationalRole:
          initialPharmacist?.operationalRole ?? PharmacistOperationalRole.TITULAR,
        facilityId:
          initialPharmacist?.facilityId ??
          (facilities.find((f) => f.isPrimary) ?? facilities[0])?.id ??
          UNASSIGNED_FACILITY_VALUE,
        defaultCubicleId:
          initialPharmacist?.defaultCubicleId ?? UNASSIGNED_CUBICLE_VALUE,
        shift: initialPharmacist?.shift ?? WorkShift.MORNING,
        status: initialPharmacist?.status ?? PharmacistStatus.ACTIVE,
        email: initialPharmacist?.email ?? '',
        phone: initialPharmacist?.phone ?? '+57 300 ',
      });
    }
  }, [open, initialPharmacist, facilities, reset]);

  const selectedFacilityId = watch('facilityId');
  const selectedCubicleId = watch('defaultCubicleId');

  const availableCubicles = useMemo(() => {
    if (!selectedFacilityId || selectedFacilityId === UNASSIGNED_FACILITY_VALUE) {
      return [];
    }
    const targetFacility = facilities.find((f) => f.id === selectedFacilityId);
    return targetFacility?.cubicles ?? [];
  }, [facilities, selectedFacilityId]);

  // Limpia la selección de cubículo si no pertenece a la sede seleccionada actualmente
  useEffect(() => {
    if (
      selectedCubicleId &&
      selectedCubicleId !== UNASSIGNED_CUBICLE_VALUE &&
      !availableCubicles.some((c) => c.id === selectedCubicleId)
    ) {
      setValue('defaultCubicleId', UNASSIGNED_CUBICLE_VALUE, { shouldValidate: true });
    }
  }, [availableCubicles, selectedCubicleId, setValue]);

  const onValidSubmit = async (values: PharmacistFormValues) => {
    setServerError(null);
    try {
      const normalizedFacilityId =
        values.facilityId === UNASSIGNED_FACILITY_VALUE ? null : values.facilityId;
      const normalizedCubicleId =
        values.defaultCubicleId === UNASSIGNED_CUBICLE_VALUE
          ? null
          : values.defaultCubicleId;

      await onSubmitForm({
        fullName: values.fullName.trim(),
        licenseNumber: values.licenseNumber.trim().toUpperCase(),
        operationalRole: values.operationalRole,
        facilityId: normalizedFacilityId,
        defaultCubicleId: normalizedCubicleId,
        cubicleId: normalizedCubicleId,
        shift: values.shift,
        status: values.status,
        email: values.email.trim().toLowerCase(),
        phone: values.phone.trim(),
      });
      onOpenChange(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'No fue posible guardar el registro profesional.';
      setServerError(message);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="600px" aria-describedby="pharmacist-form-description">
        <Dialog.Title>
          {mode === 'create'
            ? 'Registrar Farmacéutico Profesional'
            : 'Editar Farmacéutico Registrado'}
        </Dialog.Title>
        <Dialog.Description id="pharmacist-form-description" size="2" color="gray" mb="4">
          {mode === 'create'
            ? 'Completa los datos profesionales, matrícula y asignación operativa para habilitar al farmacéutico en ventanillas.'
            : 'Actualiza los datos del profesional, su sede asociada o el cubículo asignado por defecto.'}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="pharmacist-fullname"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Nombre completo <span className="text-red-600">*</span>
              </label>
              <TextField.Root
                id="pharmacist-fullname"
                placeholder="Ej. Lic. R. Mendoza"
                {...register('fullName')}
              />
              {errors.fullName && (
                <Text as="p" size="1" color="red" role="alert" mt="1">
                  {errors.fullName.message}
                </Text>
              )}
            </div>

            <div>
              <label
                htmlFor="pharmacist-license"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Matrícula profesional <span className="text-red-600">*</span>
              </label>
              <TextField.Root
                id="pharmacist-license"
                placeholder="Ej. MN-4812"
                {...register('licenseNumber')}
              />
              {errors.licenseNumber && (
                <Text as="p" size="1" color="red" role="alert" mt="1">
                  {errors.licenseNumber.message}
                </Text>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="pharmacist-email"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Correo electrónico institucional <span className="text-red-600">*</span>
              </label>
              <TextField.Root
                id="pharmacist-email"
                type="email"
                placeholder="nombre@cubiora.hospital"
                {...register('email')}
              />
              {errors.email && (
                <Text as="p" size="1" color="red" role="alert" mt="1">
                  {errors.email.message}
                </Text>
              )}
            </div>

            <div>
              <label
                htmlFor="pharmacist-phone"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Teléfono de contacto <span className="text-red-600">*</span>
              </label>
              <TextField.Root
                id="pharmacist-phone"
                type="tel"
                placeholder="+57 300 555-0101"
                {...register('phone')}
              />
              {errors.phone && (
                <Text as="p" size="1" color="red" role="alert" mt="1">
                  {errors.phone.message}
                </Text>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="pharmacist-role-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Rol operativo
              </label>
              <Controller
                name="operationalRole"
                control={control}
                render={({ field }) => (
                  <Select.Root value={field.value} onValueChange={field.onChange}>
                    <Select.Trigger
                      id="pharmacist-role-select"
                      aria-label="Rol operativo"
                      className="w-full"
                    />
                    <Select.Content>
                      {Object.values(PharmacistOperationalRole).map((roleValue) => (
                        <Select.Item key={roleValue} value={roleValue}>
                          {PHARMACIST_ROLE_LABELS_ES[roleValue]}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                )}
              />
            </div>

            <div>
              <label
                htmlFor="pharmacist-shift-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Turno horario
              </label>
              <Controller
                name="shift"
                control={control}
                render={({ field }) => (
                  <Select.Root value={field.value} onValueChange={field.onChange}>
                    <Select.Trigger
                      id="pharmacist-shift-select"
                      aria-label="Turno horario"
                      className="w-full"
                    />
                    <Select.Content>
                      {Object.values(WorkShift).map((shiftValue) => (
                        <Select.Item key={shiftValue} value={shiftValue}>
                          {WORK_SHIFT_LABELS_ES[shiftValue]}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                )}
              />
            </div>

            <div>
              <label
                htmlFor="pharmacist-status-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Estado inicial
              </label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select.Root value={field.value} onValueChange={field.onChange}>
                    <Select.Trigger
                      id="pharmacist-status-select"
                      aria-label="Estado inicial"
                      className="w-full"
                    />
                    <Select.Content>
                      {Object.values(PharmacistStatus).map((statusValue) => (
                        <Select.Item key={statusValue} value={statusValue}>
                          {PHARMACIST_STATUS_LABELS_ES[statusValue]}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="pharmacist-facility-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Sede asignada
              </label>
              <Controller
                name="facilityId"
                control={control}
                render={({ field }) => (
                  <Select.Root value={field.value} onValueChange={field.onChange}>
                    <Select.Trigger
                      id="pharmacist-facility-select"
                      aria-label="Sede asignada"
                      className="w-full"
                    />
                    <Select.Content>
                      <Select.Item value={UNASSIGNED_FACILITY_VALUE}>
                        Sin sede asignada
                      </Select.Item>
                      {facilities.map((facility) => (
                        <Select.Item key={facility.id} value={facility.id}>
                          {facility.name} ({facility.code})
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                )}
              />
            </div>

            <div>
              <label
                htmlFor="pharmacist-cubicle-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Cubículo habitual
              </label>
              <Controller
                name="defaultCubicleId"
                control={control}
                render={({ field }) => (
                  <Select.Root
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={availableCubicles.length === 0}
                  >
                    <Select.Trigger
                      id="pharmacist-cubicle-select"
                      aria-label="Cubículo habitual"
                      className="w-full"
                    />
                    <Select.Content>
                      <Select.Item value={UNASSIGNED_CUBICLE_VALUE}>
                        Sin cubículo fijo
                      </Select.Item>
                      {availableCubicles.map((cub) => (
                        <Select.Item key={cub.id} value={cub.id}>
                          {cub.displayName} ({cub.shortCode})
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                )}
              />
            </div>
          </div>

          <Flex justify="end" gap="3" pt="3" className="border-t border-slate-200">
            <Dialog.Close>
              <Button type="button" variant="soft" color="gray" disabled={isSubmitting}>
                Cancelar
              </Button>
            </Dialog.Close>
            <Button type="submit" color="teal" disabled={isSubmitting}>
              {isSubmitting
                ? 'Guardando…'
                : mode === 'create'
                  ? 'Registrar Farmacéutico'
                  : 'Guardar Cambios'}
            </Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
};

