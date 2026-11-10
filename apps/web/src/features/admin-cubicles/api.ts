import { useMutation, useQuery } from '@tanstack/react-query';
import type { AdminCubicleConfigDto, AssignCubiclePharmacistDto } from '@cubiora/shared';
import { apiClient, unwrapApiData, type WrappedApiResponse } from '../../lib/api';
import { adminQueryKeys, useResolvedQueryClient } from '../../lib/query-client';

export async function fetchAdminCubicles(facilityId?: string): Promise<AdminCubicleConfigDto[]> {
  const query = facilityId ? `?facilityId=${encodeURIComponent(facilityId)}` : '';
  const response = await apiClient<WrappedApiResponse<AdminCubicleConfigDto[]>>(
    `/admin/cubicles${query}`,
  );
  return unwrapApiData(response);
}

export async function assignCubiclePharmacist(
  cubicleId: string,
  dto: AssignCubiclePharmacistDto,
  signal?: AbortSignal,
): Promise<AdminCubicleConfigDto> {
  const response = await apiClient<WrappedApiResponse<AdminCubicleConfigDto>>(
    `/admin/cubicles/${encodeURIComponent(cubicleId)}/assign-pharmacist`,
    {
      method: 'PATCH',
      body: JSON.stringify(dto),
      signal,
    },
  );
  return unwrapApiData(response);
}

export async function updateAdminCubicleStatus(
  cubicleId: string,
  active: boolean,
): Promise<AdminCubicleConfigDto> {
  const response = await apiClient<WrappedApiResponse<AdminCubicleConfigDto>>(
    `/admin/cubicles/${encodeURIComponent(cubicleId)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    },
  );
  return unwrapApiData(response);
}

export function useAdminCubiclesQuery(
  facilityId?: string,
  options: { enabled?: boolean; retry?: boolean | number } = {},
) {
  const resolvedClient = useResolvedQueryClient();
  return useQuery(
    {
      queryKey: adminQueryKeys.cubicles(facilityId),
      queryFn: () => fetchAdminCubicles(facilityId),
      enabled: options.enabled ?? true,
      retry: options.retry ?? false,
    },
    resolvedClient,
  );
}

export function useAssignCubiclePharmacistMutation() {
  const resolvedClient = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: ({
        cubicleId,
        dto,
        signal,
      }: {
        cubicleId: string;
        dto: AssignCubiclePharmacistDto;
        signal?: AbortSignal;
      }) => assignCubiclePharmacist(cubicleId, dto, signal),
      onSuccess: () => {
        void resolvedClient.invalidateQueries({ queryKey: adminQueryKeys.all });
      },
    },
    resolvedClient,
  );
}

export function useUpdateAdminCubicleStatusMutation() {
  const resolvedClient = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: ({ cubicleId, active }: { cubicleId: string; active: boolean }) =>
        updateAdminCubicleStatus(cubicleId, active),
      onSuccess: () => {
        void resolvedClient.invalidateQueries({ queryKey: adminQueryKeys.all });
      },
    },
    resolvedClient,
  );
}

