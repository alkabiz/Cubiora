import React, { useMemo, useState } from 'react';
import { Badge, Button, Callout, Select } from '@radix-ui/themes';
import {
  AlertTriangle,
  KeyRound,
  Pencil,
  Power,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import {
  USER_ROLE_LABELS_ES,
  UserRole,
  type AdminUserDto,
  type CreateAdminUserDto,
  type FacilityDto,
  type ResetAdminUserPasswordDto,
  type UpdateAdminUserDto,
} from '@cubiora/shared';
import {
  useAdminUsersQuery,
  useCreateAdminUserMutation,
  useResetAdminUserPasswordMutation,
  useUpdateAdminUserMutation,
} from './api';
import { UserFormDialog, type SelectableCubicleOption } from './user-form-dialog';
import { ResetPasswordDialog } from './reset-password-dialog';

interface UsersManagementPanelProps {
  facilities: FacilityDto[];
}

const ROLE_BADGE_COLOR: Record<UserRole, 'purple' | 'teal' | 'blue'> = {
  [UserRole.ADMIN]: 'purple',
  [UserRole.CASHIER]: 'teal',
  [UserRole.RECEPTION]: 'blue',
};

export const UsersManagementPanel: React.FC<UsersManagementPanelProps> = ({ facilities }) => {
  const usersQuery = useAdminUsersQuery();
  const createMutation = useCreateAdminUserMutation();
  const updateMutation = useUpdateAdminUserMutation();
  const resetPasswordMutation = useResetAdminUserPasswordMutation();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingUser, setEditingUser] = useState<AdminUserDto | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminUserDto | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const users = useMemo(
    () => (Array.isArray(usersQuery.data) ? usersQuery.data : []),
    [usersQuery.data],
  );

  const cubicleOptions: SelectableCubicleOption[] = useMemo(() => {
    const list: SelectableCubicleOption[] = [];
    const seen = new Set<string>();
    for (const fac of facilities) {
      for (const cub of fac.cubicles ?? []) {
        if (seen.has(cub.id)) continue;
        seen.add(cub.id);
        list.push({
          id: cub.id,
          code: cub.code,
          displayName: cub.displayName,
          facilityCode: fac.code,
        });
      }
    }
    return list;
  }, [facilities]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.username.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q) ||
        (u.cubicleCode?.toLowerCase().includes(q) ?? false) ||
        (u.cubicleDisplayName?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [users, searchQuery, roleFilter]);

  const handleOpenCreate = () => {
    setFormMode('create');
    setEditingUser(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (user: AdminUserDto) => {
    setFormMode('edit');
    setEditingUser(user);
    setFormOpen(true);
  };

  const handleCreateUser = async (dto: CreateAdminUserDto) => {
    setActionError(null);
    const created = await createMutation.mutateAsync(dto);
    setFeedback(`Cuenta operativa ${created.username} (${created.displayName}) creada.`);
  };

  const handleUpdateUser = async (id: string, dto: UpdateAdminUserDto) => {
    setActionError(null);
    const updated = await updateMutation.mutateAsync({ id, dto });
    setFeedback(`Cuenta operativa ${updated.username} actualizada.`);
  };

  const handleToggleActive = async (user: AdminUserDto) => {
    setActionError(null);
    try {
      const updated = await updateMutation.mutateAsync({
        id: user.id,
        dto: { active: !user.active },
      });
      setFeedback(
        `Cuenta ${updated.username} ${updated.active ? 'activada' : 'desactivada'}.`,
      );
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'No fue posible actualizar el estado de la cuenta.',
      );
    }
  };

  const handleResetPassword = async (id: string, dto: ResetAdminUserPasswordDto) => {
    setActionError(null);
    await resetPasswordMutation.mutateAsync({ id, dto });
    setFeedback(`Contraseña restablecida para ${resetTarget?.username ?? 'el usuario'}.`);
  };

  return (
    <section
      aria-label="Cuentas operativas del sistema"
      className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-teal-700" aria-hidden="true" />
            <h2 className="text-base font-bold text-slate-900">
              Cuentas Operativas del Sistema ({users.length})
            </h2>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Administra usuarios de acceso, roles, asignación de cubículos para caja y contraseñas.
          </p>
        </div>

        <Button
          type="button"
          color="teal"
          size="2"
          onClick={handleOpenCreate}
          className="min-h-[36px] cursor-pointer"
        >
          <UserPlus size={14} aria-hidden="true" />
          Crear Cuenta Operativa
        </Button>
      </div>

      {feedback && (
        <Callout.Root color="teal" role="status" aria-live="polite">
          <Callout.Text>{feedback}</Callout.Text>
        </Callout.Root>
      )}

      {actionError && (
        <Callout.Root color="red" role="alert">
          <Callout.Icon>
            <AlertTriangle size={16} aria-hidden="true" />
          </Callout.Icon>
          <Callout.Text>{actionError}</Callout.Text>
        </Callout.Root>
      )}

      {usersQuery.isError && (
        <Callout.Root color="red" role="alert">
          <Callout.Icon>
            <AlertTriangle size={16} aria-hidden="true" />
          </Callout.Icon>
          <div className="flex items-center justify-between gap-3 flex-wrap w-full">
            <Callout.Text>
              No fue posible cargar las cuentas operativas desde el servidor.
            </Callout.Text>
            <button
              type="button"
              onClick={() => void usersQuery.refetch()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[32px] rounded bg-white border border-red-300 text-xs font-semibold text-red-800 hover:bg-red-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E]"
            >
              <RefreshCw size={12} aria-hidden="true" />
              Reintentar
            </button>
          </div>
        </Callout.Root>
      )}

      {/* Filtros de cuentas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <label htmlFor="users-search-input" className="sr-only">
            Buscar cuenta operativa
          </label>
          <Search
            className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="users-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por usuario, nombre o cubículo..."
            className="w-full bg-[#F8FAFC] border border-slate-500 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-600 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0F766E] focus:border-[#0F766E]"
          />
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="users-role-filter"
            className="text-xs font-semibold text-slate-700 whitespace-nowrap"
          >
            Filtrar rol:
          </label>
          <Select.Root
            value={roleFilter}
            onValueChange={(value) => setRoleFilter(value as 'ALL' | UserRole)}
          >
            <Select.Trigger id="users-role-filter" aria-label="Filtrar cuentas por rol" />
            <Select.Content>
              <Select.Item value="ALL">Todos los roles</Select.Item>
              {Object.values(UserRole).map((role) => (
                <Select.Item key={role} value={role}>
                  {USER_ROLE_LABELS_ES[role]}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </div>
      </div>

      {/* Tabla de usuarios */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-[#F8FAFC] border-b border-slate-200 text-[11px] font-bold text-slate-700">
            <tr>
              <th scope="col" className="py-3 px-4">Usuario / Nombre</th>
              <th scope="col" className="py-3 px-4">Rol</th>
              <th scope="col" className="py-3 px-4">Cubículo asignado</th>
              <th scope="col" className="py-3 px-4">Estado</th>
              <th scope="col" className="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usersQuery.isLoading ? (
              <tr>
                <td colSpan={5} className="py-8 px-4 text-center text-slate-600">
                  Cargando cuentas operativas del sistema…
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 px-4 text-center text-slate-600">
                  {users.length === 0
                    ? 'No hay cuentas operativas registradas.'
                    : 'No se encontraron cuentas que coincidan con el filtro.'}
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const missingCubicleForCashier =
                  user.role === UserRole.CASHIER && !user.cubicleId;

                return (
                  <tr key={user.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-mono font-bold text-slate-900">{user.username}</div>
                      <div className="text-slate-600">{user.displayName}</div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge size="1" variant="soft" color={ROLE_BADGE_COLOR[user.role]}>
                        {USER_ROLE_LABELS_ES[user.role] ?? user.role}
                      </Badge>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {user.cubicleCode ? (
                        <span className="font-medium text-slate-800">
                          {user.cubicleDisplayName ?? user.cubicleCode} ({user.cubicleCode})
                        </span>
                      ) : missingCubicleForCashier ? (
                        <span className="font-medium text-amber-800">Sin cubículo asignado</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge size="1" variant="soft" color={user.active ? 'green' : 'gray'}>
                        {user.active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          type="button"
                          size="1"
                          variant="soft"
                          color="gray"
                          onClick={() => handleOpenEdit(user)}
                          aria-label={`Editar cuenta ${user.username}`}
                          className="min-h-[32px] cursor-pointer"
                        >
                          <Pencil size={12} aria-hidden="true" />
                          Editar
                        </Button>

                        <Button
                          type="button"
                          size="1"
                          variant="soft"
                          color="blue"
                          onClick={() => setResetTarget(user)}
                          aria-label={`Restablecer contraseña de ${user.username}`}
                          className="min-h-[32px] cursor-pointer"
                        >
                          <KeyRound size={12} aria-hidden="true" />
                          Contraseña
                        </Button>

                        <Button
                          type="button"
                          size="1"
                          variant="soft"
                          color={user.active ? 'red' : 'teal'}
                          disabled={updateMutation.isPending}
                          onClick={() => void handleToggleActive(user)}
                          aria-label={`${user.active ? 'Desactivar' : 'Activar'} cuenta ${user.username}`}
                          className="min-h-[32px] cursor-pointer"
                        >
                          <Power size={12} aria-hidden="true" />
                          {user.active ? 'Desactivar' : 'Activar'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        initialUser={editingUser}
        cubicleOptions={cubicleOptions}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onSubmitCreate={handleCreateUser}
        onSubmitUpdate={handleUpdateUser}
      />

      <ResetPasswordDialog
        open={Boolean(resetTarget)}
        onOpenChange={(open) => {
          if (!open) setResetTarget(null);
        }}
        user={resetTarget}
        isSubmitting={resetPasswordMutation.isPending}
        onResetPassword={handleResetPassword}
      />
    </section>
  );
};

