import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  AdminUserDto,
  CreateAdminUserDto,
  ResetAdminUserPasswordDto,
  UpdateAdminUserDto,
} from '@cubiora/shared';
import { apiClient, unwrapApiData, type WrappedApiResponse } from '../../lib/api';
import { adminQueryKeys, useResolvedQueryClient } from '../../lib/query-client';

export async function fetchAdminUsers(): Promise<AdminUserDto[]> {
  const response = await apiClient<WrappedApiResponse<AdminUserDto[]>>('/admin/users');
  const raw = unwrapApiData(response);
  return Array.isArray(raw) ? raw : [];
}

export async function createAdminUser(dto: CreateAdminUserDto): Promise<AdminUserDto> {
  const response = await apiClient<WrappedApiResponse<AdminUserDto>>('/admin/users', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
  return unwrapApiData(response);
}

export async function updateAdminUser(
  id: string,
  dto: UpdateAdminUserDto,
): Promise<AdminUserDto> {
  const response = await apiClient<WrappedApiResponse<AdminUserDto>>(
    `/admin/users/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(dto),
    },
  );
  return unwrapApiData(response);
}

export async function resetAdminUserPassword(
  id: string,
  dto: ResetAdminUserPasswordDto,
): Promise<{ reset: true; id: string }> {
  const response = await apiClient<WrappedApiResponse<{ reset: true; id: string }>>(
    `/admin/users/${encodeURIComponent(id)}/reset-password`,
    {
      method: 'POST',
      body: JSON.stringify(dto),
    },
  );
  return unwrapApiData(response);
}

export function useAdminUsersQuery(
  options: { enabled?: boolean; retry?: boolean | number } = {},
) {
  const resolvedClient = useResolvedQueryClient();
  return useQuery(
    {
      queryKey: adminQueryKeys.users(),
      queryFn: fetchAdminUsers,
      enabled: options.enabled ?? true,
      retry: options.retry ?? false,
    },
    resolvedClient,
  );
}

export function useCreateAdminUserMutation() {
  const resolvedClient = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (dto: CreateAdminUserDto) => createAdminUser(dto),
      onSuccess: () => {
        void resolvedClient.invalidateQueries({ queryKey: adminQueryKeys.users() });
        void resolvedClient.invalidateQueries({ queryKey: adminQueryKeys.cubicles() });
      },
    },
    resolvedClient,
  );
}

export function useUpdateAdminUserMutation() {
  const resolvedClient = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: ({ id, dto }: { id: string; dto: UpdateAdminUserDto }) =>
        updateAdminUser(id, dto),
      onSuccess: () => {
        void resolvedClient.invalidateQueries({ queryKey: adminQueryKeys.users() });
        void resolvedClient.invalidateQueries({ queryKey: adminQueryKeys.cubicles() });
      },
    },
    resolvedClient,
  );
}

export function useResetAdminUserPasswordMutation() {
  const resolvedClient = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: ({ id, dto }: { id: string; dto: ResetAdminUserPasswordDto }) =>
        resetAdminUserPassword(id, dto),
    },
    resolvedClient,
  );
}

