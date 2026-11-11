-- ==============================================================================
-- CUBIORA: EXTENSIÓN DE ENUMS PARA SEDES, FARMACÉUTICOS Y DISPENSACIONES (1/2)
-- Separada en transacción previa para confirmar los nuevos valores de
-- QueueCategory antes de referenciarlos en defaults de columnas.
-- ==============================================================================

ALTER TYPE "QueueCategory" ADD VALUE IF NOT EXISTS 'HIGH_COST';
ALTER TYPE "QueueCategory" ADD VALUE IF NOT EXISTS 'BILLING';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DispensationResolution') THEN
    CREATE TYPE "DispensationResolution" AS ENUM ('TOTAL_DELIVERED', 'PENDING_48H', 'PRESCRIPTION_REJECTED', 'CANCELLED_BY_PATIENT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FacilityStatus') THEN
    CREATE TYPE "FacilityStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PharmacistOperationalRole') THEN
    CREATE TYPE "PharmacistOperationalRole" AS ENUM ('TITULAR', 'ADJUNTO', 'DISPENSADOR', 'GUARDIA');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkShift') THEN
    CREATE TYPE "WorkShift" AS ENUM ('MORNING', 'AFTERNOON', 'NIGHT', 'ROTATING');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PharmacistStatus') THEN
    CREATE TYPE "PharmacistStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'INACTIVE');
  END IF;
END $$;

