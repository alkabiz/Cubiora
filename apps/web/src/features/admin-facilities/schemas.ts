import { z } from 'zod';
import { FacilityStatus } from '@cubiora/shared';

export const UNASSIGNED_FACILITY_CUBICLE_VALUE = '__NONE_CUBICLE__';

export const facilityFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, 'El código de sede es obligatorio (mín. 3 caracteres)')
    .max(30, 'Máximo 30 caracteres')
    .regex(/^[A-Za-z0-9-_]+$/, 'Usa solo letras, números, guiones o guiones bajos'),
  name: z
    .string()
    .trim()
    .min(3, 'El nombre de la sede es obligatorio')
    .max(120, 'Máximo 120 caracteres'),
  address: z
    .string()
    .trim()
    .min(5, 'La dirección física es obligatoria')
    .max(200, 'Máximo 200 caracteres'),
  city: z
    .string()
    .trim()
    .min(2, 'La ciudad es obligatoria')
    .max(80, 'Máximo 80 caracteres'),
  phone: z
    .string()
    .trim()
    .min(5, 'El teléfono institucional es obligatorio')
    .max(50, 'Máximo 50 caracteres'),
  openingHours: z
    .string()
    .trim()
    .min(4, 'El horario de atención es obligatorio')
    .max(80, 'Máximo 80 caracteres'),
  enabledCubiclesCount: z.coerce
    .number()
    .int('Debe ser un número entero')
    .min(1, 'Mínimo 1 cubículo')
    .max(20, 'Máximo 20 cubículos por sede'),
  status: z.enum([
    FacilityStatus.ACTIVE,
    FacilityStatus.MAINTENANCE,
    FacilityStatus.INACTIVE,
  ]),
  isPrimary: z.boolean().default(false),
});

export type FacilityFormValues = z.infer<typeof facilityFormSchema>;

export const assignPharmacistFormSchema = z.object({
  pharmacistId: z.string().min(1, 'Selecciona un farmacéutico registrado'),
  cubicleId: z.string().min(1),
});

export type AssignPharmacistFormValues = z.infer<typeof assignPharmacistFormSchema>;

