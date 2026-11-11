import { z } from 'zod';
import { UserRole } from '@cubiora/shared';

export const UNASSIGNED_USER_CUBICLE = '__UNASSIGNED_CUBICLE__';

export const createUserSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'El usuario debe tener al menos 3 caracteres')
    .max(50, 'Máximo 50 caracteres')
    .regex(/^[a-z0-9._-]+$/, 'Solo minúsculas, números, puntos, guiones o guion bajo'),
  displayName: z
    .string()
    .trim()
    .min(2, 'El nombre visible debe tener al menos 2 caracteres')
    .max(100, 'Máximo 100 caracteres'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(128, 'Máximo 128 caracteres'),
  role: z.enum([UserRole.ADMIN, UserRole.CASHIER, UserRole.RECEPTION]),
  cubicleId: z.string().min(1),
  active: z.boolean(),
});

export const updateUserSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'El nombre visible debe tener al menos 2 caracteres')
    .max(100, 'Máximo 100 caracteres'),
  role: z.enum([UserRole.ADMIN, UserRole.CASHIER, UserRole.RECEPTION]),
  cubicleId: z.string().min(1),
  active: z.boolean(),
});

export const resetUserPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
      .max(128, 'Máximo 128 caracteres'),
    confirmPassword: z.string().min(1, 'Confirma la nueva contraseña'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden',
  });

export type CreateUserFormValues = z.infer<typeof createUserSchema>;
export type UpdateUserFormValues = z.infer<typeof updateUserSchema>;
export type ResetUserPasswordFormValues = z.infer<typeof resetUserPasswordSchema>;

