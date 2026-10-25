import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, toQueryString } from '@/api/client'
import type { OrderSummary, OrderView, Paged } from '@/api/types'
import type {
  AdminCatalog,
  AdminImage,
  AdminOrderQuery,
  AdminProductEdit,
  AdminProductInput,
  AdminProductQuery,
  AdminProductRow,
  DashboardView,
  NameInput,
} from './types'

// Admin data is always fresh enough for a back office but never cached across sign-outs
const ADMIN = 'admin'

export function useDashboard() {
  return useQuery({
    queryKey: [ADMIN, 'dashboard'],
    queryFn: () => api<DashboardView>('/api/admin/dashboard'),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

// ------------------------------------------------------------------ orders

export function useAdminOrders(query: AdminOrderQuery) {
  return useQuery({
    queryKey: [ADMIN, 'orders', query],
    queryFn: () => api<Paged<OrderSummary>>(`/api/admin/orders${toQueryString(query)}`),
    placeholderData: keepPreviousData,
  })
}

export function useOrderCounts() {
  return useQuery({
    queryKey: [ADMIN, 'order-counts'],
    queryFn: () => api<Record<string, number>>('/api/admin/orders/counts'),
    staleTime: 15_000,
  })
}

export function useAdminOrder(id: number) {
  return useQuery({ queryKey: [ADMIN, 'order', id], queryFn: () => api<OrderView>(`/api/admin/orders/${id}`) })
}

export function useUpdateOrderStatus(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { status: number; note: string | null }) =>
      api<OrderView>(`/api/admin/orders/${id}/status`, { method: 'POST', body }),
    onSuccess: (order) => {
      qc.setQueryData([ADMIN, 'order', id], order)
      void qc.invalidateQueries({ queryKey: [ADMIN, 'orders'] })
      void qc.invalidateQueries({ queryKey: [ADMIN, 'order-counts'] })
      void qc.invalidateQueries({ queryKey: [ADMIN, 'dashboard'] })
    },
  })
}

// ------------------------------------------------------------------ products

export function useAdminProducts(query: AdminProductQuery) {
  return useQuery({
    queryKey: [ADMIN, 'products', query],
    queryFn: () => api<Paged<AdminProductRow>>(`/api/admin/products${toQueryString(query)}`),
    placeholderData: keepPreviousData,
  })
}

export function useAdminProduct(id: number | null) {
  return useQuery({
    queryKey: [ADMIN, 'product', id],
    queryFn: () => api<AdminProductEdit>(`/api/admin/products/${id}`),
    enabled: id !== null,
  })
}

/** After any product write the storefront caches are stale too (the API evicts its output cache). */
function invalidateProducts(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: [ADMIN, 'products'] })
  void qc.invalidateQueries({ queryKey: [ADMIN, 'dashboard'] })
  void qc.invalidateQueries({ queryKey: ['products'] })
  void qc.invalidateQueries({ queryKey: ['product'] })
}

export function useSaveProduct(id: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AdminProductInput) =>
      id === null
        ? api<AdminProductEdit>('/api/admin/products', { method: 'POST', body: input })
        : api<AdminProductEdit>(`/api/admin/products/${id}`, { method: 'PUT', body: input }),
    onSuccess: (saved) => {
      qc.setQueryData([ADMIN, 'product', saved.id], saved)
      invalidateProducts(qc)
    },
  })
}

export function useBulkProducts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { ids: number[]; action: 'activate' | 'deactivate' | 'delete' }) =>
      api<{ affected: number }>('/api/admin/products/bulk', { method: 'POST', body }),
    onSuccess: () => invalidateProducts(qc),
  })
}

export function useProductImages(productId: number) {
  const qc = useQueryClient()
  const key = [ADMIN, 'product', productId]
  const patchImages = (fn: (images: AdminImage[]) => AdminImage[]) =>
    qc.setQueryData<AdminProductEdit>(key, (old) => (old ? { ...old, images: fn(old.images) } : old))

  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return api<AdminImage>(`/api/admin/products/${productId}/images`, { method: 'POST', formData: form })
    },
    onSuccess: (image) => {
      patchImages((images) => [...images, image])
      invalidateProducts(qc)
    },
  })
  const remove = useMutation({
    mutationFn: (imageId: number) => api(`/api/admin/products/${productId}/images/${imageId}`, { method: 'DELETE' }),
    onSuccess: (_, imageId) => {
      patchImages((images) => images.filter((i) => i.id !== imageId))
      invalidateProducts(qc)
    },
  })
  const reorder = useMutation({
    mutationFn: (ids: number[]) => api(`/api/admin/products/${productId}/images/order`, { method: 'PUT', body: ids }),
    // Optimistic: show the new order right away; the refetch after settling corrects any mismatch
    onMutate: (ids) =>
      patchImages((images) =>
        ids.flatMap((id, i) => {
          const image = images.find((x) => x.id === id)
          return image ? [{ ...image, sortOrder: i }] : []
        }),
      ),
    onSettled: () => invalidateProducts(qc),
  })
  return { upload, remove, reorder }
}

// ------------------------------------------------------------------ catalog

export function useAdminCatalog() {
  return useQuery({ queryKey: [ADMIN, 'catalog'], queryFn: () => api<AdminCatalog[]>('/api/admin/catalog') })
}

export function useSaveCatalogNode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ kind, id, input }: { kind: 'catalogs' | 'categories'; id: number | null; input: NameInput }) =>
      id === null
        ? api<{ id: number }>(`/api/admin/catalog/${kind}`, { method: 'POST', body: input })
        : api<{ id: number }>(`/api/admin/catalog/${kind}/${id}`, { method: 'PUT', body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [ADMIN, 'catalog'] })
      void qc.invalidateQueries({ queryKey: ['catalog'] })
    },
  })
}

export function useDeleteCatalogNode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ kind, id }: { kind: 'catalogs' | 'categories'; id: number }) =>
      api(`/api/admin/catalog/${kind}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [ADMIN, 'catalog'] })
      void qc.invalidateQueries({ queryKey: ['catalog'] })
    },
  })
}
