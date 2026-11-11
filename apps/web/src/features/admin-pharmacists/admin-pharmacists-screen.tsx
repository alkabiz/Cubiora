import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Badge,
  Button,
  Callout,
  Card,
  Select,
  Text,
  TextField,
} from '@radix-ui/themes';
import {
  AlertTriangle,
  Building2,
  ClipboardCheck,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  PHARMACIST_ROLE_SHORT_LABELS_ES,
  PHARMACIST_STATUS_LABELS_ES,
  PharmacistOperationalRole,
  PharmacistStatus,
  WORK_SHIFT_LABELS_ES,
  WORK_SHIFT_SHORT_LABELS_ES,
  type CreatePharmacistDto,
  type PharmacistDto,
  type UpdatePharmacistDto,
} from '@cubiora/shared';
import { useFacilitiesQuery } from '../admin-facilities/api';
import {
  useCreatePharmacistMutation,
  useDeletePharmacistMutation,
  usePharmacistsQuery,
  useUpdatePharmacistMutation,
  useUpdatePharmacistStatusMutation,
} from './api';
import { PharmacistFormDialog } from './pharmacist-form-dialog';
import { DeletePharmacistDialog } from './delete-pharmacist-dialog';
import { AppMain } from '../../app/app-main';
import { PageHeader } from '../../app/page-header';

const ROLE_BADGE_COLOR: Record<
  PharmacistOperationalRole,
  'blue' | 'teal' | 'amber' | 'purple'
> = {
  [PharmacistOperationalRole.TITULAR]: 'blue',
  [PharmacistOperationalRole.ADJUNTO]: 'teal',
  [PharmacistOperationalRole.DISPENSADOR]: 'amber',
  [PharmacistOperationalRole.GUARDIA]: 'purple',
};

const STATUS_DOT_COLOR: Record<PharmacistStatus, string> = {
  [PharmacistStatus.ACTIVE]: 'bg-emerald-600',
  [PharmacistStatus.ON_LEAVE]: 'bg-amber-500',
  [PharmacistStatus.INACTIVE]: 'bg-slate-400',
};

function getInitials(fullName: string): string {
  const cleaned = fullName
    .replace(/^(Lic\.|Farm\.|Dr\.|Dra\.)\s*/i, '')
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'FM';
  if (parts.length === 1) return (parts[0] ?? 'F').slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
}

export const AdminPharmacistsScreen: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [facilityFilter, setFacilityFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingPharmacist, setEditingPharmacist] = useState<PharmacistDto | null>(null);

  const [deletingPharmacist, setDeletingPharmacist] = useState<PharmacistDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const pharmacistsQuery = usePharmacistsQuery({
    search: searchQuery,
    facilityId: facilityFilter,
    operationalRole: roleFilter,
    status: statusFilter,
  });

  const facilitiesQuery = useFacilitiesQuery();

  const createMutation = useCreatePharmacistMutation();
  const updateMutation = useUpdatePharmacistMutation();
  const updateStatusMutation = useUpdatePharmacistStatusMutation();
  const deleteMutation = useDeletePharmacistMutation();

  const pharmacists = useMemo(
    () => pharmacistsQuery.data?.items ?? [],
    [pharmacistsQuery.data],
  );
  const metrics = pharmacistsQuery.data?.metrics ?? {
    totalRegistered: 0,
    activeToday: 0,
    onLeaveCount: 0,
    totalDispatches: 0,
    averageServiceMinutes: 0,
    assignedFacilitiesCount: 0,
  };
  const facilities = useMemo(
    () => (Array.isArray(facilitiesQuery.data) ? facilitiesQuery.data : []),
    [facilitiesQuery.data],
  );

  const handleOpenCreate = () => {
    setFormMode('create');
    setEditingPharmacist(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (pharmacist: PharmacistDto) => {
    setFormMode('edit');
    setEditingPharmacist(pharmacist);
    setFormOpen(true);
  };

  const handleSubmitForm = async (
    payload: CreatePharmacistDto | UpdatePharmacistDto,
  ) => {
    if (formMode === 'create') {
      const created = await createMutation.mutateAsync(
        payload as CreatePharmacistDto,
      );
      setStatusFeedback(`Profesional ${created.fullName} registrado correctamente.`);
    } else if (editingPharmacist) {
      const updated = await updateMutation.mutateAsync({
        id: editingPharmacist.id,
        dto: payload as UpdatePharmacistDto,
      });
      setStatusFeedback(`Registro de ${updated.fullName} actualizado correctamente.`);
    }
  };

  const handleQuickStatusChange = async (
    pharmacist: PharmacistDto,
    nextStatus: PharmacistStatus,
  ) => {
    if (pharmacist.status === nextStatus) return;
    try {
      await updateStatusMutation.mutateAsync({
        id: pharmacist.id,
        status: nextStatus,
      });
      setStatusFeedback(
        `Estado de ${pharmacist.fullName} actualizado a ${PHARMACIST_STATUS_LABELS_ES[nextStatus]}.`,
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'No fue posible actualizar el estado.';
      setStatusFeedback(message);
    }
  };

  const handleConfirmDelete = async (id: string) => {
    setDeleteError(null);
    try {
      const deletedName = deletingPharmacist?.fullName ?? 'Profesional';
      await deleteMutation.mutateAsync(id);
      setDeletingPharmacist(null);
      setStatusFeedback(`${deletedName} eliminado del registro.`);
    } catch (err: unknown) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : 'No fue posible eliminar el registro profesional.',
      );
    }
  };

  const headerActions = (
    <div className="flex items-center gap-2.5 flex-wrap">
      <Link
        to="/admin/cubiculos"
        className="inline-flex items-center min-h-[36px] px-3.5 py-1.5 rounded-lg border border-slate-500 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] focus-visible:ring-offset-2"
      >
        Configurar Cubículos
      </Link>
      <Button
        type="button"
        color="teal"
        size="2"
        onClick={handleOpenCreate}
        className="min-h-[36px] cursor-pointer"
      >
        <Plus size={15} aria-hidden="true" />
        Registrar Farmacéutico
      </Button>
    </div>
  );

  return (
    <AppMain
      header={
        <PageHeader
          section="Personal Operativo de Dispensación"
          title="Gestión de Farmacéuticos Registrados"
          description="Directorio profesional, matrícula habilitante y vinculación con sedes y cubículos de atención."
          action={headerActions}
        />
      }
    >
      <div className="space-y-6">

      {/* Región viva accesible para confirmar mutaciones (WCAG 4.1.3 AA) */}
      {statusFeedback && (
        <Callout.Root color="teal" role="status" aria-live="polite">
          <Callout.Text>{statusFeedback}</Callout.Text>
        </Callout.Root>
      )}

      {/* ═══════════════ RESUMEN KPI (4 TARJETAS) ═══════════════ */}
      <section
        aria-label="Indicadores de personal farmacéutico"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <Card size="2" className="bg-white border border-slate-200/90">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 uppercase tracking-wider">
            <span>Total Registrados</span>
            <Users size={16} className="text-blue-700" aria-hidden="true" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">
              {metrics.totalRegistered}
            </span>
            <span className="text-xs text-slate-600">profesionales</span>
          </div>
          <p className="mt-2 text-xs text-slate-600">En plataforma Cubiora</p>
        </Card>

        <Card size="2" className="bg-white border border-slate-200/90">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 uppercase tracking-wider">
            <span>En Servicio Activo</span>
            <UserCheck size={16} className="text-emerald-700" aria-hidden="true" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">
              {metrics.activeToday}
            </span>
            <span className="text-xs text-emerald-700 font-semibold">habilitados</span>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            Licencia / Pausa: {metrics.onLeaveCount}
          </p>
        </Card>

        <Card size="2" className="bg-white border border-slate-200/90">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 uppercase tracking-wider">
            <span>Despachos Acumulados</span>
            <ClipboardCheck size={16} className="text-teal-700" aria-hidden="true" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">
              {metrics.totalDispatches}
            </span>
            <span className="text-xs text-slate-600">entregas</span>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            Prom. atención: {metrics.averageServiceMinutes} min
          </p>
        </Card>

        <Card size="2" className="bg-white border border-slate-200/90">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 uppercase tracking-wider">
            <span>Red de Sedes</span>
            <Building2 size={16} className="text-indigo-700" aria-hidden="true" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">
              {metrics.assignedFacilitiesCount}
            </span>
            <span className="text-xs text-slate-600">sedes con cobertura</span>
          </div>
          <div className="mt-2">
            <Link
              to="/admin/sedes"
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] rounded"
            >
              Ver mapa y sedes →
            </Link>
          </div>
        </Card>
      </section>

      {/* ═══════════════ BARRA DE FILTROS ═══════════════ */}
      <section
        aria-label="Filtros del directorio de farmacéuticos"
        className="bg-white border border-slate-200/90 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 shadow-2xs"
      >
        <div>
          <label
            htmlFor="pharmacist-search-input"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Buscar profesional
          </label>
          <TextField.Root
            id="pharmacist-search-input"
            placeholder="Nombre, matrícula o correo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          >
            <TextField.Slot>
              <Search size={14} className="text-slate-600" aria-hidden="true" />
            </TextField.Slot>
          </TextField.Root>
        </div>

        <div>
          <label
            htmlFor="filter-facility-select"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Sede hospitalaria
          </label>
          <Select.Root value={facilityFilter} onValueChange={setFacilityFilter}>
            <Select.Trigger
              id="filter-facility-select"
              aria-label="Filtrar por sede"
              className="w-full"
            />
            <Select.Content>
              <Select.Item value="ALL">Todas las Sedes</Select.Item>
              {facilities.map((facility) => (
                <Select.Item key={facility.id} value={facility.id}>
                  {facility.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </div>

        <div>
          <label
            htmlFor="filter-role-select"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Rol operativo
          </label>
          <Select.Root value={roleFilter} onValueChange={setRoleFilter}>
            <Select.Trigger
              id="filter-role-select"
              aria-label="Filtrar por rol operativo"
              className="w-full"
            />
            <Select.Content>
              <Select.Item value="ALL">Rol: Todos los roles</Select.Item>
              {Object.values(PharmacistOperationalRole).map((role) => (
                <Select.Item key={role} value={role}>
                  {PHARMACIST_ROLE_SHORT_LABELS_ES[role]}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </div>

        <div>
          <label
            htmlFor="filter-status-select"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Estado operativo
          </label>
          <Select.Root value={statusFilter} onValueChange={setStatusFilter}>
            <Select.Trigger
              id="filter-status-select"
              aria-label="Filtrar por estado"
              className="w-full"
            />
            <Select.Content>
              <Select.Item value="ALL">Estado: Todos</Select.Item>
              {Object.values(PharmacistStatus).map((status) => (
                <Select.Item key={status} value={status}>
                  {PHARMACIST_STATUS_LABELS_ES[status]}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </div>
      </section>

      {/* ═══════════════ DIRECTORIO DE PROFESIONALES ═══════════════ */}
      <section
        aria-label="Directorio de farmacéuticos"
        className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden"
      >
        {pharmacistsQuery.isError && (
          <div className="p-5">
            <Callout.Root color="red" role="alert">
              <Callout.Icon>
                <AlertTriangle size={16} aria-hidden="true" />
              </Callout.Icon>
              <Callout.Text>
                No fue posible cargar el directorio de farmacéuticos desde el servidor.{' '}
                <button
                  type="button"
                  onClick={() => void pharmacistsQuery.refetch()}
                  className="inline-flex items-center min-h-[32px] px-2 rounded underline font-semibold ml-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E]"
                >
                  Reintentar
                </button>
              </Callout.Text>
            </Callout.Root>
          </div>
        )}

        {pharmacistsQuery.isLoading && (
          <div className="p-8 text-center text-sm text-slate-600 flex items-center justify-center gap-2">
            <RefreshCw size={15} className="motion-safe:animate-spin text-teal-700" aria-hidden="true" />
            Cargando profesionales farmacéuticos registrados…
          </div>
        )}

        {!pharmacistsQuery.isLoading &&
          !pharmacistsQuery.isError &&
          pharmacists.length === 0 && (
            <div className="p-8 text-center space-y-2">
              <Text as="p" size="3" weight="bold" className="text-slate-800">
                No se encontraron profesionales con los criterios actuales
              </Text>
              <Text as="p" size="2" color="gray">
                Ajusta los filtros de búsqueda o registra un nuevo farmacéutico en el directorio.
              </Text>
            </div>
          )}

        {!pharmacistsQuery.isLoading && pharmacists.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th scope="col" className="py-3 px-4">
                    Profesional
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Matrícula
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Rol Operativo
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Sede y Cubículo
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Turno
                  </th>
                  <th scope="col" className="py-3 px-4 text-right">
                    Despachos
                  </th>
                  <th scope="col" className="py-3 px-4">
                    Estado
                  </th>
                  <th scope="col" className="py-3 px-4 text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {pharmacists.map((pharmacist) => (
                  <tr
                    key={pharmacist.id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="w-9 h-9 rounded-full bg-teal-50 border border-teal-200 text-teal-800 font-bold text-xs inline-flex items-center justify-center flex-shrink-0"
                        >
                          {getInitials(pharmacist.fullName)}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900">
                            {pharmacist.fullName}
                          </div>
                          <div className="text-xs text-slate-600 truncate">
                            {pharmacist.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-1 rounded">
                        {pharmacist.licenseNumber}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge
                        size="1"
                        variant="soft"
                        color={ROLE_BADGE_COLOR[pharmacist.operationalRole]}
                      >
                        {PHARMACIST_ROLE_SHORT_LABELS_ES[pharmacist.operationalRole]}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-start gap-1.5">
                        <Building2
                          size={14}
                          className="text-slate-600 mt-0.5 flex-shrink-0"
                          aria-hidden="true"
                        />
                        <div className="text-xs">
                          <div className="font-semibold text-slate-800">
                            {pharmacist.facilityName ?? 'Sin sede asignada'}
                          </div>
                          <div className="text-slate-600">
                            {pharmacist.defaultCubicleName ?? 'Sin cubículo asignado'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        title={WORK_SHIFT_LABELS_ES[pharmacist.shift]}
                        className="text-xs font-medium text-slate-700"
                      >
                        {WORK_SHIFT_SHORT_LABELS_ES[pharmacist.shift]}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono text-xs font-bold text-slate-900 tabular-nums">
                      {pharmacist.dispatchesCount}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="inline-flex items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT_COLOR[pharmacist.status]}`}
                        />
                        <Select.Root
                          size="1"
                          value={pharmacist.status}
                          onValueChange={(nextValue) =>
                            void handleQuickStatusChange(
                              pharmacist,
                              nextValue as PharmacistStatus,
                            )
                          }
                        >
                          <Select.Trigger
                            aria-label={`Estado operativo de ${pharmacist.fullName}`}
                            variant="soft"
                            color={
                              pharmacist.status === PharmacistStatus.ACTIVE
                                ? 'green'
                                : pharmacist.status === PharmacistStatus.ON_LEAVE
                                  ? 'amber'
                                  : 'gray'
                            }
                            className="min-h-[28px] font-semibold"
                          />
                          <Select.Content>
                            {Object.values(PharmacistStatus).map((st) => (
                              <Select.Item key={st} value={st}>
                                {PHARMACIST_STATUS_LABELS_ES[st]}
                              </Select.Item>
                            ))}
                          </Select.Content>
                        </Select.Root>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          size="1"
                          variant="soft"
                          color="gray"
                          onClick={() => handleOpenEdit(pharmacist)}
                          aria-label={`Editar a ${pharmacist.fullName}`}
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
                          onClick={() => {
                            setDeleteError(null);
                            setDeletingPharmacist(pharmacist);
                          }}
                          aria-label={`Eliminar a ${pharmacist.fullName}`}
                          className="min-h-[36px] cursor-pointer"
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modales CRUD accesibles Radix Dialog */}
      <PharmacistFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        initialPharmacist={editingPharmacist}
        facilities={facilities}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onSubmitForm={handleSubmitForm}
      />

      <DeletePharmacistDialog
        open={Boolean(deletingPharmacist)}
        onOpenChange={(open) => {
          if (!open) setDeletingPharmacist(null);
        }}
        pharmacist={deletingPharmacist}
        isDeleting={deleteMutation.isPending}
        errorMessage={deleteError}
        onConfirmDelete={handleConfirmDelete}
      />
      </div>
    </AppMain>
  );
};
