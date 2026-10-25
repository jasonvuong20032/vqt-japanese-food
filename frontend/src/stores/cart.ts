import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProductCard } from '@/api/types'

export const MAX_QUANTITY = 99

/**
 * The browser only remembers what is in the cart (ids + quantities) plus a display snapshot.
 * Prices and stock are always re-checked by the server (/api/cart/quote) before checkout.
 */
export interface CartItem {
  productId: number
  quantity: number
  name: string
  slug: string
  imageUrl: string | null
  price: number
  stock: number
}

interface CartState {
  items: CartItem[]
  couponCode: string | null
  add: (product: ProductCard, quantity?: number) => void
  setQuantity: (productId: number, quantity: number) => void
  remove: (productId: number) => void
  clear: () => void
  setCoupon: (code: string | null) => void
}

const cap = (quantity: number, stock: number) =>
  Math.max(1, Math.min(quantity, MAX_QUANTITY, stock > 0 ? stock : MAX_QUANTITY))

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      couponCode: null,
      add: (product, quantity = 1) =>
        set((state) => {
          const existing = state.items.find((i) => i.productId === product.id)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === product.id
                  ? { ...i, quantity: cap(i.quantity + quantity, product.stock), price: product.effectivePrice, stock: product.stock }
                  : i,
              ),
            }
          }
          return {
            items: [
              ...state.items,
              {
                productId: product.id,
                quantity: cap(quantity, product.stock),
                name: product.name,
                slug: product.slug,
                imageUrl: product.imageUrl,
                price: product.effectivePrice,
                stock: product.stock,
              },
            ],
          }
        }),
      setQuantity: (productId, quantity) =>
        set((state) => ({
          items: state.items.map((i) => (i.productId === productId ? { ...i, quantity: cap(quantity, i.stock) } : i)),
        })),
      remove: (productId) => set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),
      clear: () => set({ items: [], couponCode: null }),
      setCoupon: (couponCode) => set({ couponCode }),
    }),
    { name: 'jf-cart', version: 1 },
  ),
)

export const useCartCount = () => useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0))
