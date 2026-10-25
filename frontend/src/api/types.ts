// Mirrors the JSON returned by JapaneseFood.Api (System.Text.Json, camelCase)

export interface Paged<T> {
  items: T[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export interface ProductCard {
  id: number
  slug: string
  code: string
  name: string
  shortDescription: string | null
  price: number
  effectivePrice: number
  discountPercent: number
  inStock: boolean
  stock: number
  imageUrl: string | null
  categoryId: number
  categoryName: string
  rating: number
  reviewCount: number
  soldCount: number
  tags: string[]
}

export interface ProductImage {
  id: number
  url: string
  alt: string | null
  /** "Photographer · licence · source" for openly licensed photos */
  credit: string | null
}

export interface PhotoCredit {
  name: string
  slug: string | null
  imageUrl: string
  credit: string
}

export interface ProductDetail {
  card: ProductCard
  description: string | null
  images: ProductImage[]
  catalogId: number
  catalogName: string
  metaTitle: string | null
  metaDescription: string | null
}

export interface BestSeller {
  product: ProductCard
  unitsSold: number
}

export interface CategoryNode {
  id: number
  name: string
  japaneseName: string | null
  description: string | null
  productCount: number
  imageUrl: string | null
}

export interface CatalogNode {
  id: number
  slug: string
  name: string
  japaneseName: string | null
  description: string | null
  productCount: number
  imageUrl: string | null
  categories: CategoryNode[]
}

export interface StoreInfo {
  name: string
  phone: string
  email: string
  address: string
  openingHours: string
  shippingFee: number
  freeShippingThreshold: number
}

export interface StoreResponse {
  info: StoreInfo
  languages: { code: string; name: string }[]
  defaultLanguage: string
}

export interface Policy {
  id: number
  topic: string
  title: string
  content: string
}

export interface CategorySuggestion {
  catalogId: number
  catalogSlug: string
  categoryId: number | null
  name: string
  japaneseName: string | null
  imageUrl: string | null
  productCount: number
}

export interface SearchSuggestions {
  query: string
  products: ProductCard[]
  totalProducts: number
  categories: CategorySuggestion[]
}

export interface QuoteLine {
  productId: number
  name: string
  slug: string
  imageUrl: string | null
  price: number
  unitPrice: number
  quantity: number
  availableStock: number
  lineTotal: number
  problem: 'unavailable' | 'out_of_stock' | 'insufficient_stock' | null
}

export interface CartQuote {
  lines: QuoteLine[]
  totalQuantity: number
  subtotal: number
  discount: number
  shippingFee: number
  total: number
  freeShippingThreshold: number
  amountToFreeShipping: number
  couponCode: string | null
  couponError: string | null
  canCheckout: boolean
}

export interface PlaceOrderRequest {
  items: { productId: number; quantity: number }[]
  fullName: string
  phone: string
  email?: string
  province?: string
  ward?: string
  street: string
  note?: string
  couponCode?: string | null
  paymentMethod: number
}

export interface PlacedOrder {
  id: number
  code: string
  total: number
  paymentMethod: number
}

export interface OrderLine {
  productId: number
  productName: string
  slug: string | null
  imageUrl: string | null
  unitPrice: number
  quantity: number
  lineTotal: number
}

export interface OrderEvent {
  fromStatus: number
  toStatus: number
  at: string
  note: string | null
}

export interface OrderView {
  id: number
  code: string
  status: number
  paymentMethod: number
  paymentStatus: number
  userId: number
  fullName: string | null
  phone: string | null
  email: string | null
  address: string | null
  province: string | null
  district: string | null
  ward: string | null
  note: string | null
  quantity: number
  subtotal: number
  discount: number
  shippingFee: number
  total: number
  couponCode: string | null
  createdAt: string
  paidAt: string | null
  lines: OrderLine[]
  history: OrderEvent[]
  allowedNextStatuses: number[]
}

export interface OrderSummary {
  id: number
  code: string
  status: number
  paymentMethod: number
  paymentStatus: number
  fullName: string | null
  phone: string | null
  total: number
  quantity: number
  createdAt: string
  firstProductName: string | null
  firstImageUrl: string | null
}

export interface AuthUser {
  id: number
  email: string
  fullName: string
  phone: string | null
  address: string | null
  avatar: string | null
  roleId: number
  role: 'Admin' | 'Staff' | 'Customer'
  preferredLanguage: string | null
  preferredTheme: string | null
}

export interface Profile {
  user: AuthUser
  birthDate: string | null
  gender: number
}

export interface Address {
  id: number
  fullName: string
  phone: string
  province: string | null
  district: string | null
  ward: string | null
  street: string
  isDefault: boolean
}

export interface Review {
  id: number
  authorName: string
  rating: number
  comment: string | null
  createdAt: string
  verifiedPurchase: boolean
}

export interface ReviewSummary {
  average: number
  count: number
  distribution: Record<string, number>
}

export interface ProductQuery {
  search?: string
  catalogId?: number
  categoryId?: number
  minPrice?: number
  maxPrice?: number
  tag?: string
  onSale?: boolean
  inStock?: boolean
  sort?: string
  page?: number
  pageSize?: number
}

/** "Our story" page, authored per language in the admin. Every section is optional. */
export interface AboutContent {
  isSample?: boolean
  hero?: { eyebrow?: string; title?: string; subtitle?: string; image?: string; imageCredit?: string }
  story?: { title?: string; paragraphs?: string[]; image?: string; imageCredit?: string }
  values?: { kanji: string; title: string; text: string }[]
  chef?: { title?: string; name?: string; role?: string; bio?: string[]; quote?: string; image?: string; imageCredit?: string; isSample?: boolean }
  journey?: { title?: string; steps?: { title: string; text: string }[] }
  sourcing?: { title?: string; text?: string; image?: string; imageCredit?: string }
  closing?: { title?: string; text?: string }
}
