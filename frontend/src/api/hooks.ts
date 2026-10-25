import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, queryClient, refreshSession, toQueryString } from '@/api/client'
import type {
  AboutContent,
  Address,
  AuthUser,
  BestSeller,
  CartQuote,
  CatalogNode,
  OrderSummary,
  OrderView,
  Paged,
  PlacedOrder,
  PlaceOrderRequest,
  Policy,
  ProductCard,
  ProductDetail,
  ProductQuery,
  Profile,
  Review,
  ReviewSummary,
  SearchSuggestions,
  StoreResponse,
} from '@/api/types'
import { useCartStore } from '@/stores/cart'
import { useLang, useUiStore } from '@/stores/ui'
import { hasSessionHint, isLanguage, isTheme } from '@/lib/utils'

// ------------------------------------------------------------------ store / catalog

export function useStore() {
  const lang = useLang()
  return useQuery({ queryKey: ['store', lang], queryFn: () => api<StoreResponse>('/api/store'), staleTime: 10 * 60_000 })
}

export function useCatalog() {
  const lang = useLang()
  return useQuery({ queryKey: ['catalog', lang], queryFn: () => api<CatalogNode[]>('/api/catalog'), staleTime: 10 * 60_000 })
}

export function usePolicies() {
  const lang = useLang()
  return useQuery({ queryKey: ['policies', lang], queryFn: () => api<Policy[]>('/api/store/policies'), staleTime: 10 * 60_000 })
}

export function useAbout() {
  const lang = useLang()
  return useQuery({
    queryKey: ['about', lang],
    queryFn: () => api<AboutContent>('/api/store/content/about'),
    staleTime: 10 * 60_000,
  })
}

// ------------------------------------------------------------------ products

export function useProducts(params: ProductQuery, enabled = true) {
  const lang = useLang()
  return useQuery({
    queryKey: ['products', lang, params],
    queryFn: ({ signal }) => api<Paged<ProductCard>>(`/api/products${toQueryString(params)}`, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useBestSellers(limit = 12, catalogId?: number) {
  const lang = useLang()
  return useQuery({
    queryKey: ['best-sellers', lang, limit, catalogId],
    queryFn: () => api<BestSeller[]>(`/api/products/best-sellers${toQueryString({ limit, catalogId })}`),
    staleTime: 5 * 60_000,
  })
}

export function useProduct(slug: string | undefined) {
  const lang = useLang()
  return useQuery({
    queryKey: ['product', lang, slug],
    queryFn: () => api<ProductDetail>(`/api/products/${encodeURIComponent(slug!)}`),
    enabled: !!slug,
  })
}

export function useRelated(productId: number | undefined) {
  const lang = useLang()
  return useQuery({
    queryKey: ['related', lang, productId],
    queryFn: () => api<ProductCard[]>(`/api/products/${productId}/related?limit=8`),
    enabled: !!productId,
    staleTime: 5 * 60_000,
  })
}

export function useSearchSuggestions(query: string) {
  const lang = useLang()
  const q = query.trim()
  return useQuery({
    queryKey: ['search', lang, q],
    queryFn: ({ signal }) => api<SearchSuggestions>(`/api/search/suggest${toQueryString({ q, limit: 6 })}`, { signal }),
    enabled: q.length >= 1,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  })
}

export function recordProductView(productId: number) {
  const key = `jf-viewed-${productId}`
  if (sessionStorage.getItem(key)) return
  sessionStorage.setItem(key, '1')
  void api(`/api/products/${productId}/view`, { method: 'POST' }).catch(() => undefined)
}

// ------------------------------------------------------------------ reviews

export function useReviews(productId: number | undefined, page = 1) {
  return useQuery({
    queryKey: ['reviews', productId, page],
    queryFn: () => api<{ summary: ReviewSummary; reviews: Paged<Review> }>(`/api/products/${productId}/reviews?page=${page}`),
    enabled: !!productId,
    placeholderData: keepPreviousData,
  })
}

export function useReviewEligibility(productId: number | undefined, signedIn: boolean) {
  return useQuery({
    queryKey: ['review-eligibility', productId],
    queryFn: () => api<{ canReview: boolean }>(`/api/products/${productId}/reviews/eligibility`),
    enabled: !!productId && signedIn,
  })
}

export function useCreateReview(productId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { rating: number; comment?: string }) =>
      api<Review>(`/api/products/${productId}/reviews`, { method: 'POST', body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reviews', productId] })
      void qc.invalidateQueries({ queryKey: ['review-eligibility', productId] })
      void qc.invalidateQueries({ queryKey: ['product'] })
    },
  })
}

// ------------------------------------------------------------------ cart / checkout

export function useCartQuote() {
  const lang = useLang()
  const items = useCartStore((s) => s.items)
  const couponCode = useCartStore((s) => s.couponCode)
  const lines = items.map((i) => ({ productId: i.productId, quantity: i.quantity }))
  return useQuery({
    queryKey: ['quote', lang, lines, couponCode],
    queryFn: () => api<CartQuote>('/api/cart/quote', { method: 'POST', body: { items: lines, couponCode } }),
    enabled: lines.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })
}

export function usePlaceOrder() {
  return useMutation({
    mutationFn: (body: PlaceOrderRequest) => api<PlacedOrder>('/api/orders', { method: 'POST', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['product'] })
    },
  })
}

export function useTrackOrder() {
  return useMutation({
    mutationFn: (body: { code: string; phone: string }) => api<OrderView>('/api/orders/track', { method: 'POST', body }),
  })
}

// ------------------------------------------------------------------ auth

/** Current user, or null. Anonymous visitors (no session hint cookie) cost zero requests. */
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async (): Promise<AuthUser | null> => {
      if (!hasSessionHint()) return null
      const me = () => api<AuthUser>('/api/auth/me', { skipAuthRetry: true })
      try {
        return await me()
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error
        const refreshed = await refreshSession()
        if (refreshed === 'failed') return null
        try {
          return await me()
        } catch {
          return null
        }
      }
    },
    staleTime: 5 * 60_000,
  })
}

/** After sign-in, adopt the language/theme the user picked on another device. */
function applyServerPreferences(user: AuthUser) {
  const ui = useUiStore.getState()
  if (isLanguage(user.preferredLanguage) && user.preferredLanguage !== ui.language) ui.setLanguage(user.preferredLanguage)
  if (isTheme(user.preferredTheme) && user.preferredTheme !== ui.theme) ui.setTheme(user.preferredTheme)
}

function onSignedIn(user: AuthUser) {
  queryClient.setQueryData(['me'], user)
  applyServerPreferences(user)
  void queryClient.invalidateQueries({ queryKey: ['wishlist-ids'] })
}

export function useLogin() {
  return useMutation({
    mutationFn: (body: { email: string; password: string; rememberMe: boolean }) =>
      api<AuthUser>('/api/auth/login', { method: 'POST', body, skipAuthRetry: true }),
    onSuccess: onSignedIn,
  })
}

export function useRegister() {
  return useMutation({
    mutationFn: (body: { email: string; password: string; fullName: string; phone: string; language: string }) =>
      api<{ email: string }>('/api/auth/register', { method: 'POST', body, skipAuthRetry: true }),
  })
}

export function useActivate() {
  return useMutation({
    mutationFn: (body: { email: string; code: string }) =>
      api<AuthUser>('/api/auth/activate', { method: 'POST', body, skipAuthRetry: true }),
    onSuccess: onSignedIn,
  })
}

export function useResendActivation() {
  return useMutation({
    mutationFn: (email: string) => api('/api/auth/resend-activation', { method: 'POST', body: { email }, skipAuthRetry: true }),
  })
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => api('/api/auth/forgot-password', { method: 'POST', body: { email }, skipAuthRetry: true }),
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (body: { email: string; code: string; newPassword: string }) =>
      api('/api/auth/reset-password', { method: 'POST', body, skipAuthRetry: true }),
  })
}

export function useLogout() {
  return useMutation({
    mutationFn: () => api('/api/auth/logout', { method: 'POST', skipAuthRetry: true }),
    onSettled: () => {
      queryClient.setQueryData(['me'], null)
      for (const key of ['orders', 'order', 'addresses', 'profile', 'wishlist', 'wishlist-ids', 'review-eligibility', 'admin'])
        queryClient.removeQueries({ queryKey: [key] })
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api('/api/auth/change-password', { method: 'POST', body }),
  })
}

// ------------------------------------------------------------------ account

export function useProfile() {
  return useQuery({ queryKey: ['profile'], queryFn: () => api<Profile>('/api/account/profile') })
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api<Profile>('/api/account/profile', { method: 'PUT', body }),
    onSuccess: (profile) => {
      queryClient.setQueryData(['profile'], profile)
      queryClient.setQueryData(['me'], profile.user)
    },
  })
}

export function saveServerPreferences(language: string, theme: string) {
  void api('/api/account/preferences', { method: 'PUT', body: { language, theme } }).catch(() => undefined)
}

export function useMyOrders(page: number) {
  return useQuery({
    queryKey: ['orders', page],
    queryFn: () => api<Paged<OrderSummary>>(`/api/orders?page=${page}&pageSize=10`),
    placeholderData: keepPreviousData,
  })
}

export function useMyOrder(code: string | undefined) {
  return useQuery({ queryKey: ['order', code], queryFn: () => api<OrderView>(`/api/orders/${code}`), enabled: !!code })
}

export function useCancelOrder() {
  return useMutation({
    mutationFn: (code: string) => api(`/api/orders/${code}/cancel`, { method: 'POST' }),
    onSuccess: (_, code) => {
      void queryClient.invalidateQueries({ queryKey: ['order', code] })
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

export function useAddresses(enabled = true) {
  return useQuery({ queryKey: ['addresses'], queryFn: () => api<Address[]>('/api/account/addresses'), enabled })
}

export function useSaveAddress() {
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Address> & { id?: number }) =>
      api<Address>(id ? `/api/account/addresses/${id}` : '/api/account/addresses', { method: id ? 'PUT' : 'POST', body }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['addresses'] }),
  })
}

export function useDeleteAddress() {
  return useMutation({
    mutationFn: (id: number) => api(`/api/account/addresses/${id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['addresses'] }),
  })
}

export function useWishlist() {
  const lang = useLang()
  return useQuery({ queryKey: ['wishlist', lang], queryFn: () => api<ProductCard[]>('/api/account/wishlist') })
}

export function useWishlistIds(enabled: boolean) {
  return useQuery({
    queryKey: ['wishlist-ids'],
    queryFn: () => api<number[]>('/api/account/wishlist/ids'),
    enabled,
    staleTime: 5 * 60_000,
  })
}

export function useToggleWishlist() {
  return useMutation({
    mutationFn: ({ productId, add }: { productId: number; add: boolean }) =>
      api(`/api/account/wishlist/${productId}`, { method: add ? 'PUT' : 'DELETE' }),
    // Optimistic: the heart fills instantly, and rolls back if the request fails
    onMutate: async ({ productId, add }) => {
      await queryClient.cancelQueries({ queryKey: ['wishlist-ids'] })
      const previous = queryClient.getQueryData<number[]>(['wishlist-ids'])
      queryClient.setQueryData<number[]>(['wishlist-ids'], (ids = []) =>
        add ? [...new Set([...ids, productId])] : ids.filter((id) => id !== productId),
      )
      return { previous }
    },
    onError: (_error, _vars, context) => queryClient.setQueryData(['wishlist-ids'], context?.previous),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['wishlist'] }),
  })
}
