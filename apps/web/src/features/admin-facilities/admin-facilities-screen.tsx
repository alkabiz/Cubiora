import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Callout, Text } from '@radix-ui/themes';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  FACILITY_STATUS_LABELS_ES,
  FacilityStatus,
  PHARMACIST_ROLE_SHORT_LABELS_ES,
  PHARMACIST_STATUS_LABELS_ES,
  PharmacistStatus,
  WORK_SHIFT_SHORT_LABELS_ES,
  type AssignPharmacistToFacilityDto,
  type CreateFacilityDto,
  type FacilityDto,
  type UpdateFacilityDto,
} from '@cubiora/shared';
import { usePharmacistsQuery } from '../admin-pharmacists/api';
import {
  useActivateFacilityMutation,
  useAssignPharmacistToFacilityMutation,
  useCreateFacilityMutation,
  useDeleteFacilityMutation,
  useFacilitiesQuery,
  useUpdateFacilityMutation,
} from './api';
import { FacilityFormDialog } from './facility-form-dialog';
import { AssignPharmacistDialog } from './assign-pharmacist-dialog';
import { DeleteFacilityDialog } from './delete-facility-dialog';
import { UsersManagementPanel } from '../admin-users';
import { AppMain } from '../../app/app-main';
import { PageHeader } from '../../app/page-header';

const FACILITY_STATUS_COLOR: Record<FacilityStatus, 'green' | 'amber' | 'gray'> = {
  [FacilityStatus.ACTIVE]: 'green',
  [FacilityStatus.MAINTENANCE]: 'amber',
  [FacilityStatus.INACTIVE]: 'gray',
};

export const AdminFacilitiesScreen: React.FC = () => {
  const facilitiesQuery = useFacilitiesQuery();
  const pharmacistsQuery = usePharmacistsQuery();

  const createMutation = useCreateFacilityMutation();
  const updateMutation = useUpdateFacilityMutation();
  const activateMutation = useActivateFacilityMutation();
  const assignMutation = useAssignPharmacistToFacilityMutation();
  const deleteMutation = useDeleteFacilityMutation();

  const facilities = useMemo(
    () => (Array.isArray(facilitiesQuery.data) ? facilitiesQuery.data : []),
    [facilitiesQuery.data],
  );
  const allPharmacists = useMemo(
    () => pharmacistsQuery.data?.items ?? [],
    [pharmacistsQuery.data],
  );

  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingFacility, setEditingFacility] = useState<FacilityDto | null>(null);

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [preselectedPharmacistId, setPreselectedPharmacistId] = useState<string | null>(null);

  const [deletingFacility, setDeletingFacility] = useState<FacilityDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // Seleccionar automáticamente la sede primaria o primera sede al cargar
  useEffect(() => {
    if (facilities.length === 0) {
      setSelectedFacilityId(null);
      return;
    }
    if (!selectedFacilityId || !facilities.some((f) => f.id === selectedFacilityId)) {
      const primary = facilities.find((f) => f.isPrimary) ?? facilities[0] ?? null;
      setSelectedFacilityId(primary?.id ?? null);
    }
  }, [facilities, selectedFacilityId]);

  const selectedFacility = useMemo(
    () =>
      facilities.find((f) => f.id === selectedFacilityId) ??
      facilities.find((f) => f.isPrimary) ??
      facilities[0] ??
      null,
    [facilities, selectedFacilityId],
  );

  const handleOpenCreate = () => {
    setFormMode('create');
    setEditingFacility(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (facility: FacilityDto) => {
    setFormMode('edit');
    setEditingFacility(facility);
    setFormOpen(true);
  };

  const handleSubmitFacility = async (
    payload: CreateFacilityDto | UpdateFacilityDto,
  ) => {
    if (formMode === 'create') {
      const created = await createMutation.mutateAsync(payload as CreateFacilityDto);
      setSelectedFacilityId(created.id);
      setStatusFeedback(`Sede ${created.name} (${created.code}) registrada correctamente.`);
    } else if (editingFacility) {
      const updated = await updateMutation.mutateAsync({
        id: editingFacility.id,
        dto: payload as UpdateFacilityDto,
      });
      setStatusFeedback(`Sede ${updated.name} actualizada correctamente.`);
    }
  };

  const handleActivateFacility = async (facility: FacilityDto) => {
    try {
      const activated = await activateMutation.mutateAsync(facility.id);
      setSelectedFacilityId(activated.id);
      setStatusFeedback(
        `${activated.name} (${activated.code}) fijada como Sede Primaria Activa.`,
      );
    } catch (err: unknown) {
      setStatusFeedback(
        err instanceof Error
          ? err.message
          : 'No fue posible activar la sede seleccionada.',
      );
    }
  };

  const handleAssignPharmacist = async (
    facilityId: string,
    dto: AssignPharmacistToFacilityDto,
  ) => {
    const updatedFacility = await assignMutation.mutateAsync({ facilityId, dto });
    setSelectedFacilityId(updatedFacility.id);
    setStatusFeedback(
      `Asignación profesional actualizada en ${updatedFacility.name}.`,
    );
  };

  const handleConfirmDeleteFacility = async (id: string) => {
    setDeleteError(null);
    try {
      const removedName = deletingFacility?.name ?? 'Sede';
      await deleteMutation.mutateAsync(id);
      setDeletingFacility(null);
      setStatusFeedback(`Sede ${removedName} eliminada correctamente.`);
    } catch (err: unknown) {
      setDeleteError(
        err instanceof Error ? err.message : 'No fue posible eliminar la sede.',
      );
    }
  };

  return (
    <AppMain
      header={
        <PageHeader
          section="Red Hospitalaria y Puntos de Atención"
          title="Gestión de Sedes y Usuarios Asociados"
          description="Administra sedes hospitalarias, define la sede primaria activa y vincula profesionales farmacéuticos a cada ventanilla."
          action={
            <Button
              type="button"
              color="teal"
              size="2"
              onClick={handleOpenCreate}
              className="min-h-[36px] cursor-pointer"
            >
              <Plus size={15} aria-hidden="true" />
              Registrar Nueva Sede
            </Button>
          }
        />
      }
    >
      <div className="space-y-6">

      {statusFeedback && (
        <Callout.Root color="teal" role="status" aria-live="polite">
          <Callout.Text>{statusFeedback}</Callout.Text>
        </Callout.Root>
      )}

      {facilitiesQuery.isError && (
        <Callout.Root color="red" role="alert">
          <Callout.Icon>
            <AlertTriangle size={16} aria-hidden="true" />
          </Callout.Icon>
          <Callout.Text>
            No fue posible cargar las sedes hospitalarias desde el servidor.{' '}
            <button
              type="button"
              onClick={() => void facilitiesQuery.refetch()}
              className="inline-flex items-center min-h-[32px] px-2 rounded underline font-semibold ml-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E]"
            >
              Reintentar
            </button>
          </Callout.Text>
        </Callout.Root>
      )}

      {facilitiesQuery.isLoading && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-600 flex items-center justify-center gap-2">
          <RefreshCw size={15} className="motion-safe:animate-spin text-teal-700" aria-hidden="true" />
          Cargando red de sedes hospitalarias…
        </div>
      )}

      {/* ═══════════════ GRILLA DE SEDES ═══════════════ */}
      {!facilitiesQuery.isLoading && facilities.length > 0 && (
        <section aria-label="Listado de sedes hospitalarias">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {facilities.map((facility) => {
              const isSelected = selectedFacility?.id === facility.id;

              return (
                <article
                  key={facility.id}
                  className={`bg-white rounded-2xl p-4 border transition-colors shadow-2xs flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'border-[#0F766E] ring-1 ring-[#0F766E]/25'
                      : 'border-slate-200/90 hover:border-slate-400'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                        {facility.code}
                      </span>

                      {facility.isPrimary ? (
                        <Badge size="1" color="green" variant="solid">
                          SEDE EN USO
                        </Badge>
                      ) : (
                        <Badge
                          size="1"
                          variant="soft"
                          color={FACILITY_STATUS_COLOR[facility.status]}
                        >
                          {FACILITY_STATUS_LABELS_ES[facility.status]}
                        </Badge>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedFacilityId(facility.id)}
                      aria-pressed={isSelected}
                      className="text-left w-full group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] rounded-lg"
                    >
                      <h2 className="text-sm font-bold text-slate-900 group-hover:text-[#115E59] transition-colors">
                        {facility.name}
                      </h2>
                      <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                        <MapPin size={12} aria-hidden="true" />
                        <span>{facility.city}</span>
                      </p>
                      <p className="text-xs text-slate-700 font-medium mt-2">
                        {facility.cubiclesCount} cubículos · {facility.pharmacistsCount}{' '}
                        usuarios
                      </p>
                    </button>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedFacilityId(facility.id)}
                      className={`min-h-[32px] px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] ${
                        isSelected
                          ? 'bg-teal-50 text-teal-900 border border-teal-600'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      {isSelected ? 'Seleccionada' : 'Ver detalle'}
                    </button>

                    {!facility.isPrimary && (
                      <Button
                        type="button"
                        size="1"
                        variant="soft"
                        color="teal"
                        disabled={activateMutation.isPending}
                        onClick={() => void handleActivateFacility(facility)}
                        className="min-h-[30px] cursor-pointer"
                      >
                        Activar como sede actual
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══════════════ DETALLE SPLIT (2 COLUMNAS) ═══════════════ */}
      {selectedFacility && (
        <section
          aria-label={`Detalle operativo de ${selectedFacility.name}`}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        >
          {/* Panel Izquierdo: Ficha Técnica y Ventanillas Físicas */}
          <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">
                    {selectedFacility.code}
                  </span>
                  <Badge
                    size="1"
                    variant="soft"
                    color={FACILITY_STATUS_COLOR[selectedFacility.status]}
                  >
                    {FACILITY_STATUS_LABELS_ES[selectedFacility.status]}
                  </Badge>
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-2">
                  {selectedFacility.name}
                </h2>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="1"
                  variant="soft"
                  color="gray"
                  onClick={() => handleOpenEdit(selectedFacility)}
                  aria-label={`Editar sede ${selectedFacility.name}`}
                  className="min-h-[36px] cursor-pointer"
                >
                  <Pencil size={13} aria-hidden="true" />
                  <span>Editar</span>
                </Button>
                <Button
                  type="button"
                  size="1"
                  variant="soft"
                  color="red"
                  disabled={selectedFacility.isPrimary}
                  title={
                    selectedFacility.isPrimary
                      ? 'Activa otra sede antes de eliminar la sede primaria.'
                      : 'Eliminar sede'
                  }
                  onClick={() => {
                    setDeleteError(null);
                    setDeletingFacility(selectedFacility);
                  }}
                  aria-label={`Eliminar sede ${selectedFacility.name}`}
                  className="min-h-[36px] cursor-pointer"
                >
                  <Trash2 size={13} aria-hidden="true" />
                </Button>
              </div>
            </div>

            <dl className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2.5 text-xs">
              <div className="flex items-start gap-2">
                <MapPin size={14} className="text-slate-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
                <div>
                  <dt className="font-semibold text-slate-700">Dirección</dt>
                  <dd className="text-slate-900 mt-0.5">
                    {selectedFacility.address}, {selectedFacility.city}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Phone size={14} className="text-slate-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
                <div>
                  <dt className="font-semibold text-slate-700">Teléfono de Guardia</dt>
                  <dd className="text-slate-900 mt-0.5 font-mono">
                    {selectedFacility.phone}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Clock size={14} className="text-slate-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
                <div>
                  <dt className="font-semibold text-slate-700">Horario de Atención</dt>
                  <dd className="text-slate-900 mt-0.5">
                    {selectedFacility.openingHours}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Building2 size={14} className="text-slate-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
                <div>
                  <dt className="font-semibold text-slate-700">Capacidad Parametrizada</dt>
                  <dd className="text-slate-900 mt-0.5">
                    {selectedFacility.enabledCubiclesCount} cubículos habilitados (
                    {selectedFacility.cubicles.length} registrados)
                  </dd>
                </div>
              </div>
            </dl>

            {/* Esquema de Ventanillas Físicas */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5">
                Esquema de Ventanillas Físicas
              </h3>
              {selectedFacility.cubicles.length === 0 ? (
                <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  Aún no hay ventanillas registradas en esta sede.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {selectedFacility.cubicles.map((cub) => (
                    <div
                      key={cub.id}
                      className="rounded-xl border border-slate-200 bg-white p-2.5 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {cub.shortCode}
                        </span>
                        <span
                          aria-label={cub.active ? 'Activa' : 'Inactiva'}
                          className={`w-2 h-2 rounded-full ${
                            cub.active ? 'bg-emerald-600' : 'bg-slate-400'
                          }`}
                        />
                      </div>
                      <p className="text-[11px] font-medium text-slate-700 truncate">
                        {cub.displayName}
                      </p>
                      <p className="text-[11px] text-slate-600 truncate">
                        {cub.operatorName ?? 'Sin operador'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2 text-xs">
              {selectedFacility.isPrimary ? (
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-800">
                  <CheckCircle2 size={14} className="text-emerald-700" aria-hidden="true" />
                  Estado de sesión: Sede Primaria Activa
                </span>
              ) : (
                <>
                  <span className="text-slate-600 font-medium">
                    Sede secundaria disponible
                  </span>
                  <Button
                    type="button"
                    size="1"
                    color="teal"
                    disabled={activateMutation.isPending}
                    onClick={() => void handleActivateFacility(selectedFacility)}
                    className="min-h-[32px] cursor-pointer"
                  >
                    Activar como sede actual
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Panel Derecho: Usuarios y Farmacéuticos Asociados */}
          <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-teal-700" aria-hidden="true" />
                <h2 className="text-base font-bold text-slate-900">
                  Usuarios y Farmacéuticos Asociados ({selectedFacility.pharmacists.length})
                </h2>
              </div>

              <Button
                type="button"
                size="2"
                color="teal"
                variant="soft"
                onClick={() => {
                  setPreselectedPharmacistId(null);
                  setAssignDialogOpen(true);
                }}
                className="min-h-[36px] cursor-pointer"
              >
                <UserPlus size={14} aria-hidden="true" />
                Asociar Usuario
              </Button>
            </div>

            {selectedFacility.pharmacists.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-400 bg-slate-50/70 p-6 text-center space-y-2">
                <Text as="p" size="2" weight="bold" className="text-slate-800">
                  Sin farmacéuticos asociados actualmente
                </Text>
                <Text as="p" size="2" color="gray">
                  Asocia un profesional del registro global para habilitar cobertura de atención en esta sede.
                </Text>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {selectedFacility.pharmacists.map((member) => (
                  <div
                    key={member.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-slate-900">
                          {member.fullName}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                          {member.licenseNumber}
                        </span>
                        <Badge size="1" variant="soft" color="blue">
                          {PHARMACIST_ROLE_SHORT_LABELS_ES[member.operationalRole]}
                        </Badge>
                        <Badge
                          size="1"
                          variant="soft"
                          color={
                            member.status === PharmacistStatus.ACTIVE
                              ? 'green'
                              : member.status === PharmacistStatus.ON_LEAVE
                                ? 'amber'
                                : 'gray'
                          }
                        >
                          {PHARMACIST_STATUS_LABELS_ES[member.status]}
                        </Badge>
                      </div>

                      <div className="text-xs text-slate-600 flex items-center gap-3 flex-wrap">
                        <span>Turno: {WORK_SHIFT_SHORT_LABELS_ES[member.shift]}</span>
                        <span>·</span>
                        <span className="font-medium text-slate-800">
                          Ventanilla: {member.defaultCubicleName ?? 'Sin cubículo asignado'}
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="1"
                      variant="soft"
                      color="gray"
                      onClick={() => {
                        setPreselectedPharmacistId(member.id);
                        setAssignDialogOpen(true);
                      }}
                      className="min-h-[36px] cursor-pointer self-start sm:self-center"
                    >
                      Reasignar
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2 flex-wrap">
              <Link
                to="/admin/farmaceuticos"
                className="text-xs font-semibold text-teal-700 hover:text-teal-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] rounded"
              >
                Administrar en Directorio de Farmacéuticos →
              </Link>
              <Link
                to="/admin/cubiculos"
                className="text-xs font-semibold text-slate-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] rounded"
              >
                Ir a Configuración de Cubículos →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════ CUENTAS OPERATIVAS DEL SISTEMA ═══════════════ */}
      <UsersManagementPanel facilities={facilities} />

      {/* Modales Radix Dialog */}
      <FacilityFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        initialFacility={editingFacility}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onSubmitForm={handleSubmitFacility}
      />

      <AssignPharmacistDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        facility={selectedFacility}
        pharmacists={allPharmacists}
        preselectedPharmacistId={preselectedPharmacistId}
        isSubmitting={assignMutation.isPending}
        onAssign={handleAssignPharmacist}
      />

      <DeleteFacilityDialog
        open={Boolean(deletingFacility)}
        onOpenChange={(open) => {
          if (!open) setDeletingFacility(null);
        }}
        facility={deletingFacility}
        isDeleting={deleteMutation.isPending}
        errorMessage={deleteError}
        onConfirmDelete={handleConfirmDeleteFacility}
      />
      </div>
    </AppMain>
  );
};

