import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Callout, Dialog, Flex, Text, TextField } from '@radix-ui/themes';
import { AlertCircle } from 'lucide-react';
import type { AdminUserDto, ResetAdminUserPasswordDto } from '@cubiora/shared';
import {
  resetUserPasswordSchema,
  type ResetUserPasswordFormValues,
} from './schemas';

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUserDto | null;
  isSubmitting: boolean;
  onResetPassword: (userId: string, dto: ResetAdminUserPasswordDto) => Promise<void>;
}

export const ResetPasswordDialog: React.FC<ResetPasswordDialogProps> = ({
  open,
  onOpenChange,
  user,
  isSubmitting,
  onResetPassword,
}) => {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ResetUserPasswordFormValues>({
    resolver: zodResolver(resetUserPasswordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (open) {
      setServerError(null);
      reset({ newPassword: '', confirmPassword: '' });
    }
  }, [open, reset]);

  const onValidSubmit = async (values: ResetUserPasswordFormValues) => {
    if (!user) return;
    setServerError(null);
    try {
      await onResetPassword(user.id, { newPassword: values.newPassword });
      onOpenChange(false);
    } catch (err: unknown) {
      setServerError(
        err instanceof Error
          ? err.message
          : 'No fue posible actualizar la contraseña del usuario.',
      );
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="460px" aria-describedby="reset-password-description">
        <Dialog.Title>
          Restablecer Contraseña · {user?.username ?? ''}
        </Dialog.Title>
        <Dialog.Description id="reset-password-description" size="2" color="gray" mb="4">
          Define una nueva contraseña segura para la cuenta de {user?.displayName ?? 'este usuario'}.
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
              htmlFor="reset-new-password-input"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Nueva contraseña <span className="text-red-600">*</span>
            </label>
            <TextField.Root
              id="reset-new-password-input"
              type="password"
              placeholder="Mínimo 8 caracteres"
              {...register('newPassword')}
            />
            {errors.newPassword && (
              <Text as="p" size="1" color="red" role="alert" mt="1">
                {errors.newPassword.message}
              </Text>
            )}
          </div>

          <div>
            <label
              htmlFor="reset-confirm-password-input"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Confirmar contraseña <span className="text-red-600">*</span>
            </label>
            <TextField.Root
              id="reset-confirm-password-input"
              type="password"
              placeholder="Repite la nueva contraseña"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <Text as="p" size="1" color="red" role="alert" mt="1">
                {errors.confirmPassword.message}
              </Text>
            )}
          </div>

          <Flex justify="end" gap="3" pt="3" className="border-t border-slate-200">
            <Dialog.Close>
              <Button type="button" variant="soft" color="gray" disabled={isSubmitting}>
                Cancelar
              </Button>
            </Dialog.Close>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Actualizando…' : 'Restablecer Contraseña'}
            </Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
};

