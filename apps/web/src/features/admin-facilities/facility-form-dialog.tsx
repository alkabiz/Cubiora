import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Callout,
  Checkbox,
  Dialog,
  Flex,
  Select,
  Text,
  TextField,
} from '@radix-ui/themes';
import { AlertCircle } from 'lucide-react';
import {
  FACILITY_STATUS_LABELS_ES,
  FacilityStatus,
  type CreateFacilityDto,
  type FacilityDto,
  type UpdateFacilityDto,
} from '@cubiora/shared';
import { facilityFormSchema, type FacilityFormValues } from './schemas';

interface FacilityFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initialFacility: FacilityDto | null;
  isSubmitting: boolean;
  onSubmitForm: (payload: CreateFacilityDto | UpdateFacilityDto) => Promise<void>;
}

export const FacilityFormDialog: React.FC<FacilityFormDialogProps> = ({
  open,
  onOpenChange,
  mode,
  initialFacility,
  isSubmitting,
  onSubmitForm,
}) => {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FacilityFormValues>({
    // @hookform/resolvers v5 + zod coerce input type: cast clean runtime values
    resolver: zodResolver(facilityFormSchema) as never,
    defaultValues: {
      code: initialFacility?.code ?? '',
      name: initialFacility?.name ?? '',
      address: initialFacility?.address ?? '',
      city: initialFacility?.city ?? 'Bogotá D.C.',
      phone: initialFacility?.phone ?? '+57 601 ',
      openingHours: initialFacility?.openingHours ?? '07:00 a 19:00',
      enabledCubiclesCount: initialFacility?.enabledCubiclesCount ?? 3,
      status: initialFacility?.status ?? FacilityStatus.ACTIVE,
      isPrimary: initialFacility?.isPrimary ?? false,
    },
  });

  useEffect(() => {
    if (open) {
      setServerError(null);
      reset({
        code: initialFacility?.code ?? '',
        name: initialFacility?.name ?? '',
        address: initialFacility?.address ?? '',
        city: initialFacility?.city ?? 'Bogotá D.C.',
        phone: initialFacility?.phone ?? '+57 601 ',
        openingHours: initialFacility?.openingHours ?? '07:00 a 19:00',
        enabledCubiclesCount: initialFacility?.enabledCubiclesCount ?? 3,
        status: initialFacility?.status ?? FacilityStatus.ACTIVE,
        isPrimary: initialFacility?.isPrimary ?? false,
      });
    }
  }, [open, initialFacility, reset]);

  const onValidSubmit = async (values: FacilityFormValues) => {
    setServerError(null);
    try {
      await onSubmitForm({
        code: values.code.trim().toUpperCase(),
        name: values.name.trim(),
        address: values.address.trim(),
        city: values.city.trim(),
        phone: values.phone.trim(),
        openingHours: values.openingHours.trim(),
        enabledCubiclesCount: Number(values.enabledCubiclesCount),
        status: values.status,
        isPrimary: values.isPrimary,
      });
      onOpenChange(false);
    } catch (err: unknown) {
      setServerError(
        err instanceof Error
          ? err.message
          : 'No fue posible guardar la información de la sede.',
      );
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="600px" aria-describedby="facility-form-description">
        <Dialog.Title>
          {mode === 'create'
            ? 'Registrar Nueva Sede de Dispensación'
            : 'Editar Información de Sede'}
        </Dialog.Title>
        <Dialog.Description id="facility-form-description" size="2" color="gray" mb="4">
          Configura el código institucional, ubicación, horario operativo y cantidad de ventanillas físicas parametrizadas.
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
                htmlFor="facility-code-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Código de sede <span className="text-red-600">*</span>
              </label>
              <TextField.Root
                id="facility-code-input"
                placeholder="Ej. SEDE-EXP-05"
                {...register('code')}
              />
              {errors.code && (
                <Text as="p" size="1" color="red" role="alert" mt="1">
                  {errors.code.message}
                </Text>
              )}
            </div>

            <div>
              <label
                htmlFor="facility-status-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Estado operativo
              </label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select.Root value={field.value} onValueChange={field.onChange}>
                    <Select.Trigger
                      id="facility-status-select"
                      aria-label="Estado operativo de la sede"
                      className="w-full"
                    />
                    <Select.Content>
                      {Object.values(FacilityStatus).map((st) => (
                        <Select.Item key={st} value={st}>
                          {FACILITY_STATUS_LABELS_ES[st]}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                )}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="facility-name-input"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Nombre de la sede <span className="text-red-600">*</span>
            </label>
            <TextField.Root
              id="facility-name-input"
              placeholder="Ej. Punto de Dispensación Central"
              {...register('name')}
            />
            {errors.name && (
              <Text as="p" size="1" color="red" role="alert" mt="1">
                {errors.name.message}
              </Text>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="facility-address-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Dirección física <span className="text-red-600">*</span>
              </label>
              <TextField.Root
                id="facility-address-input"
                placeholder="Cra. 7 # 71-21, Local 1"
                {...register('address')}
              />
              {errors.address && (
                <Text as="p" size="1" color="red" role="alert" mt="1">
                  {errors.address.message}
                </Text>
              )}
            </div>

            <div>
              <label
                htmlFor="facility-city-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Ciudad / Jurisdicción <span className="text-red-600">*</span>
              </label>
              <TextField.Root
                id="facility-city-input"
                placeholder="Ej. Bogotá D.C."
                {...register('city')}
              />
              {errors.city && (
                <Text as="p" size="1" color="red" role="alert" mt="1">
                  {errors.city.message}
                </Text>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="facility-phone-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Teléfono de guardia <span className="text-red-600">*</span>
              </label>
              <TextField.Root
                id="facility-phone-input"
                placeholder="+57 601 555-0100"
                {...register('phone')}
              />
              {errors.phone && (
                <Text as="p" size="1" color="red" role="alert" mt="1">
                  {errors.phone.message}
                </Text>
              )}
            </div>

            <div>
              <label
                htmlFor="facility-hours-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Horario de atención <span className="text-red-600">*</span>
              </label>
              <TextField.Root
                id="facility-hours-input"
                placeholder="07:00 a 19:00"
                {...register('openingHours')}
              />
              {errors.openingHours && (
                <Text as="p" size="1" color="red" role="alert" mt="1">
                  {errors.openingHours.message}
                </Text>
              )}
            </div>

            <div>
              <label
                htmlFor="facility-cubicles-count-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Cubículos habilitados
              </label>
              <TextField.Root
                id="facility-cubicles-count-input"
                type="number"
                min={1}
                max={20}
                {...register('enabledCubiclesCount')}
              />
              {errors.enabledCubiclesCount && (
                <Text as="p" size="1" color="red" role="alert" mt="1">
                  {errors.enabledCubiclesCount.message}
                </Text>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
            <Controller
              name="isPrimary"
              control={control}
              render={({ field }) => (
                <label className="flex items-center gap-2.5 text-xs font-medium text-slate-800 cursor-pointer">
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                  />
                  <span>Establecer como Sede Primaria Activa para la operación global</span>
                </label>
              )}
            />
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
                  ? 'Registrar Sede'
                  : 'Guardar Cambios'}
            </Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
};

