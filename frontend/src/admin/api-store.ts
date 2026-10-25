// Back-office hooks for customers, coupons, reviews, policies, settings and AI translation.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, toQueryString } from '@/api/client'
import type { Paged } from '@/api/types'
import type {
  AdminCoupon,
  AdminCustomerDetail,
  AdminCustomerQuery,
  AdminCustomerRow,
  AdminPolicy,
  AdminReview,
  Capabilities,
  CouponInput,
  PolicyInput,
  Role,
  StoreSettings,
  TranslateKind,
  Translations,
} from './types'

const ADMIN = 'admin'
type Client = ReturnType<typeof useQueryClient>

// ------------------------------------------------------------------ capabilities & AI

export function useCapabilities() {
  return useQuery({ queryKey: [ADMIN, 'capabilities'], queryFn: () => api<Capabilities>('/api/admin/capabilities'), staleTime: 5 * 60_000 })
}

export function useTranslate() {
  return useMutation({
    mutationFn: (body: { kind: TranslateKind; fields: Record<string, string>; targets: string[] }) =>
      api<{ translations: Translations }>('/api/admin/translate', { method: 'POST', body }),
  })
}

// ------------------------------------------------------------------ customers & staff

export function useCustomers(query: AdminCustomerQuery) {
  return useQuery({
    queryKey: [ADMIN, 'customers', query],
    queryFn: () => api<Paged<AdminCustomerRow>>(`/api/admin/customers${toQueryString(query)}`),
    placeholderData: keepPreviousData,
  })
}

export function useCustomer(id: number) {
  return useQuery({ queryKey: [ADMIN, 'customer', id], queryFn: () => api<AdminCustomerDetail>(`/api/admin/customers/${id}`) })
}

function invalidateCustomers(qc: Client) {
  void qc.invalidateQueries({ queryKey: [ADMIN, 'customers'] })
  void qc.invalidateQueries({ queryKey: [ADMIN, 'customer'] })
}

export function useLockCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, locked }: { id: number; locked: boolean }) => api(`/api/admin/customers/${id}/lock`, { method: 'POST', body: { locked } }),
    onSuccess: () => invalidateCustomers(qc),
  })
}

export function useSetRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }: { id: number; role: Role }) => api(`/api/admin/customers/${id}/role`, { method: 'POST', body: { role } }),
    onSuccess: () => invalidateCustomers(qc),
  })
}

export function useAddStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { email: string; role: Role }) => api<{ id: number }>('/api/admin/customers/staff', { method: 'POST', body }),
    onSuccess: () => invalidateCustomers(qc),
  })
}

// ------------------------------------------------------------------ coupons

export function useCoupons(query: { search?: string; state?: string; page?: number }) {
  return useQuery({
    queryKey: [ADMIN, 'coupons', query],
    queryFn: () => api<Paged<AdminCoupon>>(`/api/admin/coupons${toQueryString({ ...query, pageSize: 20 })}`),
    placeholderData: keepPreviousData,
  })
}

export function useSaveCoupon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number | null; input: CouponInput }) =>
      id === null
        ? api<AdminCoupon>('/api/admin/coupons', { method: 'POST', body: input })
        : api<AdminCoupon>(`/api/admin/coupons/${id}`, { method: 'PUT', body: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [ADMIN, 'coupons'] }),
  })
}

export function useDeleteCoupon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api(`/api/admin/coupons/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [ADMIN, 'coupons'] }),
  })
}

// ------------------------------------------------------------------ reviews

export function useAdminReviews(query: { status?: string; rating?: number; search?: string; page?: number }) {
  return useQuery({
    queryKey: [ADMIN, 'reviews', query],
    queryFn: () => api<Paged<AdminReview>>(`/api/admin/reviews${toQueryString({ ...query, pageSize: 20 })}`),
    placeholderData: keepPreviousData,
  })
}

export function useBulkReviews() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { ids: number[]; action: 'show' | 'hide' | 'delete' }) =>
      api<{ affected: number }>('/api/admin/reviews/bulk', { method: 'POST', body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [ADMIN, 'reviews'] })
      // Storefront ratings and review lists change too
      void qc.invalidateQueries({ queryKey: ['reviews'] })
      void qc.invalidateQueries({ queryKey: ['product'] })
    },
  })
}

// ------------------------------------------------------------------ policies & settings

export function useAdminPolicies() {
  return useQuery({ queryKey: [ADMIN, 'policies'], queryFn: () => api<AdminPolicy[]>('/api/admin/policies') })
}

function invalidatePolicies(qc: Client) {
  void qc.invalidateQueries({ queryKey: [ADMIN, 'policies'] })
  void qc.invalidateQueries({ queryKey: ['policies'] })
}

export function useSavePolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number | null; input: PolicyInput }) =>
      id === null
        ? api<AdminPolicy>('/api/admin/policies', { method: 'POST', body: input })
        : api<AdminPolicy>(`/api/admin/policies/${id}`, { method: 'PUT', body: input }),
    onSuccess: () => invalidatePolicies(qc),
  })
}

export function useDeletePolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api(`/api/admin/policies/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidatePolicies(qc),
  })
}

export function useSettings() {
  return useQuery({ queryKey: [ADMIN, 'settings'], queryFn: () => api<StoreSettings>('/api/admin/settings') })
}

export function useSaveSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: StoreSettings) => api<StoreSettings>('/api/admin/settings', { method: 'PUT', body: input }),
    onSuccess: (saved) => {
      qc.setQueryData([ADMIN, 'settings'], saved)
      void qc.invalidateQueries({ queryKey: ['store'] })
      void qc.invalidateQueries({ queryKey: [ADMIN, 'dashboard'] })
    },
  })
}
