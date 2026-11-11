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
  USER_ROLE_LABELS_ES,
  UserRole,
  type AdminUserDto,
  type CreateAdminUserDto,
  type UpdateAdminUserDto,
} from '@cubiora/shared';
import {
  createUserSchema,
  type CreateUserFormValues,
  UNASSIGNED_USER_CUBICLE,
  updateUserSchema,
  type UpdateUserFormValues,
} from './schemas';

export interface SelectableCubicleOption {
  id: string;
  code: string;
  displayName: string;
  facilityCode: string;
}

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initialUser: AdminUserDto | null;
  cubicleOptions: SelectableCubicleOption[];
  isSubmitting: boolean;
  onSubmitCreate: (payload: CreateAdminUserDto) => Promise<void>;
  onSubmitUpdate: (id: string, payload: UpdateAdminUserDto) => Promise<void>;
}

export const UserFormDialog: React.FC<UserFormDialogProps> = ({
  open,
  onOpenChange,
  mode,
  initialUser,
  cubicleOptions,
  isSubmitting,
  onSubmitCreate,
  onSubmitUpdate,
}) => {
  const [serverError, setServerError] = useState<string | null>(null);
  const schema = mode === 'create' ? createUserSchema : updateUserSchema;

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CreateUserFormValues | UpdateUserFormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      username: initialUser?.username ?? '',
      displayName: initialUser?.displayName ?? '',
      password: '',
      role: initialUser?.role ?? UserRole.CASHIER,
      cubicleId: initialUser?.cubicleId ?? UNASSIGNED_USER_CUBICLE,
      active: initialUser?.active ?? true,
    },
  });

  useEffect(() => {
    if (open) {
      setServerError(null);
      reset({
        username: initialUser?.username ?? '',
        displayName: initialUser?.displayName ?? '',
        password: '',
        role: initialUser?.role ?? UserRole.CASHIER,
        cubicleId: initialUser?.cubicleId ?? UNASSIGNED_USER_CUBICLE,
        active: initialUser?.active ?? true,
      });
    }
  }, [open, initialUser, reset]);

  const currentRole = watch('role');

  const onValidSubmit = async (values: CreateUserFormValues | UpdateUserFormValues) => {
    setServerError(null);
    const resolvedCubicleId =
      values.cubicleId === UNASSIGNED_USER_CUBICLE ? null : values.cubicleId;

    try {
      if (mode === 'create') {
        const createVals = values as CreateUserFormValues;
        await onSubmitCreate({
          username: createVals.username.trim().toLowerCase(),
          displayName: createVals.displayName.trim(),
          password: createVals.password,
          role: createVals.role,
          cubicleId: resolvedCubicleId,
          active: createVals.active,
        });
      } else if (initialUser) {
        await onSubmitUpdate(initialUser.id, {
          displayName: values.displayName.trim(),
          role: values.role,
          cubicleId: resolvedCubicleId,
          active: values.active,
        });
      }
      onOpenChange(false);
    } catch (err: unknown) {
      setServerError(
        err instanceof Error
          ? err.message
          : 'No fue posible guardar los datos del usuario operativo.',
      );
    }
  };

  const createErrors = errors as Record<string, { message?: string } | undefined>;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="540px" aria-describedby="user-form-description">
        <Dialog.Title>
          {mode === 'create'
            ? 'Crear Cuenta Operativa del Sistema'
            : `Editar Cuenta · ${initialUser?.username ?? ''}`}
        </Dialog.Title>
        <Dialog.Description id="user-form-description" size="2" color="gray" mb="4">
          {mode === 'create'
            ? 'Define credenciales de acceso, rol operativo y ventanilla asignada.'
            : 'Actualiza el nombre visible, rol, cubículo vinculado y estado de acceso.'}
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
                htmlFor="user-username-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Nombre de usuario <span className="text-red-600">*</span>
              </label>
              <TextField.Root
                id="user-username-input"
                placeholder="Ej. cajero3"
                disabled={mode === 'edit'}
                {...register('username' as never)}
              />
              {createErrors.username?.message && (
                <Text as="p" size="1" color="red" role="alert" mt="1">
                  {createErrors.username.message}
                </Text>
              )}
            </div>

            <div>
              <label
                htmlFor="user-display-name-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Nombre visible <span className="text-red-600">*</span>
              </label>
              <TextField.Root
                id="user-display-name-input"
                placeholder="Ej. Laura Gómez"
                {...register('displayName')}
              />
              {errors.displayName && (
                <Text as="p" size="1" color="red" role="alert" mt="1">
                  {errors.displayName.message}
                </Text>
              )}
            </div>
          </div>

          {mode === 'create' && (
            <div>
              <label
                htmlFor="user-password-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Contraseña inicial <span className="text-red-600">*</span>
              </label>
              <TextField.Root
                id="user-password-input"
                type="password"
                placeholder="Mínimo 8 caracteres"
                {...register('password' as never)}
              />
              {createErrors.password?.message && (
                <Text as="p" size="1" color="red" role="alert" mt="1">
                  {createErrors.password.message}
                </Text>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="user-role-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Rol operativo <span className="text-red-600">*</span>
              </label>
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <Select.Root value={field.value} onValueChange={field.onChange}>
                    <Select.Trigger
                      id="user-role-select"
                      aria-label="Rol operativo del usuario"
                      className="w-full"
                    />
                    <Select.Content>
                      {Object.values(UserRole).map((r) => (
                        <Select.Item key={r} value={r}>
                          {USER_ROLE_LABELS_ES[r]}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                )}
              />
            </div>

            <div>
              <label
                htmlFor="user-cubicle-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Cubículo asignado
              </label>
              <Controller
                name="cubicleId"
                control={control}
                render={({ field }) => (
                  <Select.Root value={field.value} onValueChange={field.onChange}>
                    <Select.Trigger
                      id="user-cubicle-select"
                      aria-label="Cubículo asignado al usuario"
                      className="w-full"
                    />
                    <Select.Content>
                      <Select.Item value={UNASSIGNED_USER_CUBICLE}>
                        Sin cubículo asignado
                      </Select.Item>
                      {cubicleOptions.map((cub) => (
                        <Select.Item key={cub.id} value={cub.id}>
                          {`${cub.displayName} (${cub.code}) · ${cub.facilityCode}`}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                )}
              />
              {currentRole === UserRole.CASHIER && (
                <Text as="p" size="1" color="gray" mt="1">
                  Los operadores de cubículo requieren un cubículo asignado para operar caja.
                </Text>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
            <Controller
              name="active"
              control={control}
              render={({ field }) => (
                <label className="flex items-center gap-2.5 text-xs font-medium text-slate-800 cursor-pointer">
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                  />
                  <span>Cuenta operativa activa (puede iniciar sesión)</span>
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? 'Guardando…'
                : mode === 'create'
                  ? 'Crear Cuenta'
                  : 'Guardar Cambios'}
            </Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
};

