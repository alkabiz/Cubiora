import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  AssignPharmacistToFacilityDto,
  CreateFacilityDto,
  FacilityDto,
  UpdateFacilityDto,
} from '@cubiora/shared';
import { apiClient, unwrapApiData, type WrappedApiResponse } from '../../lib/api';
import { adminQueryKeys, useResolvedQueryClient } from '../../lib/query-client';

export async function fetchFacilities(): Promise<FacilityDto[]> {
  const response = await apiClient<WrappedApiResponse<FacilityDto[]>>('/admin/facilities');
  return unwrapApiData(response);
}

export async function createFacility(dto: CreateFacilityDto): Promise<FacilityDto> {
  const response = await apiClient<WrappedApiResponse<FacilityDto>>('/admin/facilities', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
  return unwrapApiData(response);
}

export async function updateFacility(id: string, dto: UpdateFacilityDto): Promise<FacilityDto> {
  const response = await apiClient<WrappedApiResponse<FacilityDto>>(
    `/admin/facilities/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(dto),
    },
  );
  return unwrapApiData(response);
}

export async function activateFacility(id: string): Promise<FacilityDto> {
  const response = await apiClient<WrappedApiResponse<FacilityDto>>(
    `/admin/facilities/${encodeURIComponent(id)}/activate`,
    {
      method: 'POST',
    },
  );
  return unwrapApiData(response);
}

export async function assignPharmacistToFacility(
  facilityId: string,
  dto: AssignPharmacistToFacilityDto,
): Promise<FacilityDto> {
  const response = await apiClient<WrappedApiResponse<FacilityDto>>(
    `/admin/facilities/${encodeURIComponent(facilityId)}/assign-pharmacist`,
    {
      method: 'POST',
      body: JSON.stringify(dto),
    },
  );
  return unwrapApiData(response);
}

export async function deleteFacility(id: string): Promise<{ deleted: true; id: string }> {
  const response = await apiClient<WrappedApiResponse<{ deleted: true; id: string }>>(
    `/admin/facilities/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    },
  );
  return unwrapApiData(response);
}

export function useFacilitiesQuery(
  options: { enabled?: boolean; retry?: boolean | number } = {},
) {
  const resolvedClient = useResolvedQueryClient();
  return useQuery(
    {
      queryKey: adminQueryKeys.facilities(),
      queryFn: fetchFacilities,
      enabled: options.enabled ?? true,
      retry: options.retry ?? false,
    },
    resolvedClient,
  );
}

export function useCreateFacilityMutation() {
  const resolvedClient = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (dto: CreateFacilityDto) => createFacility(dto),
      onSuccess: () => {
        void resolvedClient.invalidateQueries({ queryKey: adminQueryKeys.all });
      },
    },
    resolvedClient,
  );
}

export function useUpdateFacilityMutation() {
  const resolvedClient = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: ({ id, dto }: { id: string; dto: UpdateFacilityDto }) => updateFacility(id, dto),
      onSuccess: () => {
        void resolvedClient.invalidateQueries({ queryKey: adminQueryKeys.all });
      },
    },
    resolvedClient,
  );
}

export function useActivateFacilityMutation() {
  const resolvedClient = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (id: string) => activateFacility(id),
      onSuccess: () => {
        void resolvedClient.invalidateQueries({ queryKey: adminQueryKeys.all });
      },
    },
    resolvedClient,
  );
}

export function useAssignPharmacistToFacilityMutation() {
  const resolvedClient = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: ({
        facilityId,
        dto,
      }: {
        facilityId: string;
        dto: AssignPharmacistToFacilityDto;
      }) => assignPharmacistToFacility(facilityId, dto),
      onSuccess: () => {
        void resolvedClient.invalidateQueries({ queryKey: adminQueryKeys.all });
      },
    },
    resolvedClient,
  );
}

export function useDeleteFacilityMutation() {
  const resolvedClient = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (id: string) => deleteFacility(id),
      onSuccess: () => {
        void resolvedClient.invalidateQueries({ queryKey: adminQueryKeys.all });
      },
    },
    resolvedClient,
  );
}

