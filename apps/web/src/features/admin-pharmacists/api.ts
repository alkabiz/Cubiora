import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  CreatePharmacistDto,
  PharmacistDto,
  PharmacistsListResponseDto,
  PharmacistStatus,
  UpdatePharmacistDto,
} from '@cubiora/shared';
import { apiClient, unwrapApiData, type WrappedApiResponse } from '../../lib/api';
import { adminQueryKeys, useResolvedQueryClient } from '../../lib/query-client';

export interface PharmacistQueryFilters {
  search?: string;
  facilityId?: string;
  operationalRole?: string;
  status?: string;
}

export async function fetchPharmacists(
  filters: PharmacistQueryFilters = {},
): Promise<PharmacistsListResponseDto> {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.facilityId && filters.facilityId !== 'ALL') {
    params.set('facilityId', filters.facilityId);
  }
  if (filters.operationalRole && filters.operationalRole !== 'ALL') {
    params.set('operationalRole', filters.operationalRole);
  }
  if (filters.status && filters.status !== 'ALL') {
    params.set('status', filters.status);
  }

  const query = params.toString();
  const path = query ? `/admin/pharmacists?${query}` : '/admin/pharmacists';
  const response = await apiClient<WrappedApiResponse<PharmacistsListResponseDto>>(path);
  return unwrapApiData(response);
}

export async function createPharmacist(dto: CreatePharmacistDto): Promise<PharmacistDto> {
  const response = await apiClient<WrappedApiResponse<PharmacistDto>>('/admin/pharmacists', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
  return unwrapApiData(response);
}

export async function updatePharmacist(
  id: string,
  dto: UpdatePharmacistDto,
): Promise<PharmacistDto> {
  const response = await apiClient<WrappedApiResponse<PharmacistDto>>(
    `/admin/pharmacists/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(dto),
    },
  );
  return unwrapApiData(response);
}

export async function updatePharmacistStatus(
  id: string,
  status: PharmacistStatus,
): Promise<PharmacistDto> {
  const response = await apiClient<WrappedApiResponse<PharmacistDto>>(
    `/admin/pharmacists/${encodeURIComponent(id)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
  );
  return unwrapApiData(response);
}

export async function deletePharmacist(id: string): Promise<{ deleted: true; id: string }> {
  const response = await apiClient<WrappedApiResponse<{ deleted: true; id: string }>>(
    `/admin/pharmacists/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    },
  );
  return unwrapApiData(response);
}

export function usePharmacistsQuery(
  filters: PharmacistQueryFilters = {},
  options: { enabled?: boolean; retry?: boolean | number } = {},
) {
  const resolvedClient = useResolvedQueryClient();
  return useQuery(
    {
      queryKey: adminQueryKeys.pharmacists(filters),
      queryFn: () => fetchPharmacists(filters),
      enabled: options.enabled ?? true,
      retry: options.retry ?? false,
    },
    resolvedClient,
  );
}

export function useCreatePharmacistMutation() {
  const resolvedClient = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (dto: CreatePharmacistDto) => createPharmacist(dto),
      onSuccess: () => {
        void resolvedClient.invalidateQueries({ queryKey: adminQueryKeys.all });
      },
    },
    resolvedClient,
  );
}

export function useUpdatePharmacistMutation() {
  const resolvedClient = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: ({ id, dto }: { id: string; dto: UpdatePharmacistDto }) =>
        updatePharmacist(id, dto),
      onSuccess: () => {
        void resolvedClient.invalidateQueries({ queryKey: adminQueryKeys.all });
      },
    },
    resolvedClient,
  );
}

export function useUpdatePharmacistStatusMutation() {
  const resolvedClient = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: ({ id, status }: { id: string; status: PharmacistStatus }) =>
        updatePharmacistStatus(id, status),
      onSuccess: () => {
        void resolvedClient.invalidateQueries({ queryKey: adminQueryKeys.all });
      },
    },
    resolvedClient,
  );
}

export function useDeletePharmacistMutation() {
  const resolvedClient = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (id: string) => deletePharmacist(id),
      onSuccess: () => {
        void resolvedClient.invalidateQueries({ queryKey: adminQueryKeys.all });
      },
    },
    resolvedClient,
  );
}

