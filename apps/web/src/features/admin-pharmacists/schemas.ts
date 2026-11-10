import { z } from 'zod';
import {
  PharmacistOperationalRole,
  PharmacistStatus,
  WorkShift,
} from '@cubiora/shared';

export const UNASSIGNED_FACILITY_VALUE = '__UNASSIGNED_FACILITY__';
export const UNASSIGNED_CUBICLE_VALUE = '__UNASSIGNED_CUBICLE__';

export const pharmacistFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, 'El nombre completo debe tener al menos 3 caracteres')
    .max(120, 'Máximo 120 caracteres'),
  licenseNumber: z
    .string()
    .trim()
    .min(3, 'La matrícula profesional debe tener al menos 3 caracteres')
    .max(40, 'Máximo 40 caracteres'),
  operationalRole: z.enum([
    PharmacistOperationalRole.TITULAR,
    PharmacistOperationalRole.ADJUNTO,
    PharmacistOperationalRole.DISPENSADOR,
    PharmacistOperationalRole.GUARDIA,
  ]),
  facilityId: z.string().min(1),
  defaultCubicleId: z.string().min(1),
  shift: z.enum([
    WorkShift.MORNING,
    WorkShift.AFTERNOON,
    WorkShift.NIGHT,
    WorkShift.ROTATING,
  ]),
  status: z.enum([
    PharmacistStatus.ACTIVE,
    PharmacistStatus.ON_LEAVE,
    PharmacistStatus.INACTIVE,
  ]),
  email: z
    .string()
    .trim()
    .email('Ingresa un correo electrónico institucional válido')
    .max(120, 'Máximo 120 caracteres'),
  phone: z
    .string()
    .trim()
    .min(5, 'Ingresa un teléfono de contacto válido')
    .max(40, 'Máximo 40 caracteres'),
});

export type PharmacistFormValues = z.infer<typeof pharmacistFormSchema>;

