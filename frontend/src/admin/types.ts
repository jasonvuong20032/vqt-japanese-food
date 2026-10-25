import type { OrderSummary } from '@/api/types'

// Mirrors of the C# records behind /api/admin/* (camelCase).

export interface KpiPeriod {
  revenue: number
  orders: number
  averageOrderValue: number
}

export interface DailyRevenue {
  date: string
  revenue: number
  orders: number
}

export interface TopProduct {
  productId: number
  name: string
  imageUrl: string | null
  unitsSold: number
  revenue: number
}

export interface LowStockProduct {
  productId: number
  name: string
  code: string
  quantity: number
}

export interface DashboardView {
  today: KpiPeriod
  last7Days: KpiPeriod
  last30Days: KpiPeriod
  previous30Days: KpiPeriod
  pendingOrders: number
  newCustomers30Days: number
  revenueByDay: DailyRevenue[]
  topProducts: TopProduct[]
  lowStock: LowStockProduct[]
  /** status code -> count (JSON object keys are strings) */
  ordersByStatus: Record<string, number>
}

export interface AdminOrderQuery {
  status?: number
  search?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export type ProductStatusFilter = 'all' | 'active' | 'inactive' | 'out_of_stock' | 'low_stock' | 'on_sale'
export type ProductSort = 'newest' | 'name' | 'price_asc' | 'price_desc' | 'stock_asc' | 'best_selling'

export interface AdminProductQuery {
  search?: string
  categoryId?: number
  status?: ProductStatusFilter
  sort?: ProductSort
  page?: number
  pageSize?: number
}

export interface AdminProductRow {
  id: number
  code: string
  name: string
  slug: string
  imageUrl: string | null
  categoryId: number
  categoryName: string
  price: number
  salePrice: number | null
  isOnSale: boolean
  quantity: number
  soldCount: number
  isActive: boolean
  isAvailable: boolean
  updatedAt: string
}

export interface TranslationInput {
  languageCode: string
  name: string
  shortDescription: string | null
  description: string | null
}

export interface AdminProductInput {
  code: string | null
  name: string
  slug: string | null
  categoryId: number
  shortDescription: string | null
  description: string | null
  price: number
  salePrice: number | null
  isOnSale: boolean
  quantity: number
  isAvailable: boolean
  isActive: boolean
  tags: string[]
  metaTitle: string | null
  metaDescription: string | null
  translations: TranslationInput[]
}

export interface AdminImage {
  id: number
  url: string
  alt: string | null
  sortOrder: number
}

export interface AdminProductEdit {
  id: number
  data: AdminProductInput
  images: AdminImage[]
  soldCount: number
  createdAt: string
  updatedAt: string
}

export interface LocalizedText {
  name: string
  description: string | null
}

export interface AdminCategory {
  id: number
  catalogId: number
  name: string
  description: string | null
  isActive: boolean
  sortOrder: number
  productCount: number
  translations: Record<string, LocalizedText>
}

export interface AdminCatalog {
  id: number
  slug: string | null
  name: string
  description: string | null
  coverImageUrl: string | null
  isActive: boolean
  sortOrder: number
  translations: Record<string, LocalizedText>
  categories: AdminCategory[]
}

/** Body for creating/updating a catalog (section) or a category. */
export interface NameInput {
  name: string
  description: string | null
  isActive: boolean
  sortOrder: number
  slug?: string | null
  coverImageUrl?: string | null
  catalogId?: number
  translations: Record<string, LocalizedText>
}

// ------------------------------------------------------------------ customers & staff

export type Role = 'Admin' | 'Staff' | 'Customer'

export interface AdminCustomerQuery {
  search?: string
  role?: 'customer' | 'staff'
  status?: 'active' | 'locked' | 'unverified'
  sort?: 'newest' | 'spent' | 'orders' | 'name'
  page?: number
  pageSize?: number
}

export interface AdminCustomerRow {
  id: number
  fullName: string
  email: string
  phone: string | null
  role: Role
  isVerified: boolean
  isLocked: boolean
  createdAt: string
  orderCount: number
  totalSpent: number
  lastOrderAt: string | null
}

export interface AdminAddress {
  id: number
  fullName: string
  phone: string
  street: string
  ward: string | null
  province: string | null
  isDefault: boolean
}

export interface AdminCustomerDetail {
  customer: AdminCustomerRow
  preferredLanguage: string | null
  addresses: AdminAddress[]
  recentOrders: OrderSummary[]
}

// ------------------------------------------------------------------ coupons

export type CouponState = 'active' | 'scheduled' | 'expired' | 'used_up' | 'disabled'

export interface CouponInput {
  code: string
  description: string | null
  /** 1 = percentage, 2 = fixed amount */
  type: 1 | 2
  value: number
  minOrderAmount: number
  maxDiscountAmount: number | null
  usageLimit: number | null
  startsAt: string | null
  expiresAt: string | null
  isActive: boolean
}

export interface AdminCoupon extends CouponInput {
  id: number
  usedCount: number
  state: CouponState
  createdAt: string
}

// ------------------------------------------------------------------ reviews, policies, settings

export interface AdminReview {
  id: number
  productId: number
  productName: string
  productImage: string | null
  userId: number
  authorName: string
  authorEmail: string
  rating: number
  comment: string | null
  isVisible: boolean
  createdAt: string
}

export interface PolicyText {
  title: string
  content: string
}

export interface PolicyInput {
  topic: string
  title: string
  content: string
  sortOrder: number
  isActive: boolean
  translations: Record<string, PolicyText>
}

export interface AdminPolicy extends PolicyInput {
  id: number
  updatedAt: string
}

export interface StoreSettings {
  storeName: string
  storePhone: string
  storeEmail: string
  storeAddress: string
  openingHours: string
  shippingFee: number
  freeShippingThreshold: number
  lowStockThreshold: number
  /** Public address of the site, used for links in customer emails */
  websiteUrl: string
}

// ------------------------------------------------------------------ AI

export interface Capabilities {
  aiTranslate: boolean
}

export type TranslateKind = 'dish' | 'category' | 'section' | 'policy'
/** language -> field -> text */
export type Translations = Record<string, Record<string, string>>
