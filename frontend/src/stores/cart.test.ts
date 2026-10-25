import { beforeEach, describe, expect, it } from 'vitest'
import type { ProductCard } from '@/api/types'
import { MAX_QUANTITY, useCartStore } from './cart'

function product(overrides: Partial<ProductCard> = {}): ProductCard {
  return {
    id: 1,
    slug: 'sashimi-otoro',
    code: 'JF-OTORO',
    name: 'Sashimi Otoro',
    shortDescription: null,
    price: 890_000,
    effectivePrice: 790_000,
    discountPercent: 11,
    inStock: true,
    stock: 10,
    imageUrl: null,
    categoryId: 2,
    categoryName: 'Sashimi',
    rating: 5,
    reviewCount: 3,
    soldCount: 40,
    tags: [],
    ...overrides,
  }
}

const cart = () => useCartStore.getState()

describe('cart store', () => {
  beforeEach(() => cart().clear())

  it('adds a product with its effective (sale) price', () => {
    cart().add(product())
    expect(cart().items).toEqual([expect.objectContaining({ productId: 1, quantity: 1, price: 790_000 })])
  })

  it('merges repeated adds into one line', () => {
    cart().add(product(), 2)
    cart().add(product(), 3)
    expect(cart().items).toHaveLength(1)
    expect(cart().items[0].quantity).toBe(5)
  })

  it('refreshes price and stock from the latest card when merging', () => {
    cart().add(product())
    cart().add(product({ effectivePrice: 650_000, stock: 4 }))
    expect(cart().items[0]).toMatchObject({ quantity: 2, price: 650_000, stock: 4 })
  })

  it('never goes above the stock on hand', () => {
    cart().add(product({ stock: 3 }), 5)
    expect(cart().items[0].quantity).toBe(3)
    cart().setQuantity(1, 10)
    expect(cart().items[0].quantity).toBe(3)
  })

  it(`caps at ${MAX_QUANTITY} and never drops below 1`, () => {
    cart().add(product({ stock: 500 }), 250)
    expect(cart().items[0].quantity).toBe(MAX_QUANTITY)
    cart().setQuantity(1, 0)
    expect(cart().items[0].quantity).toBe(1)
  })

  it('removes lines and clears the coupon with the cart', () => {
    cart().add(product())
    cart().add(product({ id: 2, slug: 'mochi' }))
    cart().setCoupon('WELCOME10')
    cart().remove(1)
    expect(cart().items.map((i) => i.productId)).toEqual([2])
    cart().clear()
    expect(cart()).toMatchObject({ items: [], couponCode: null })
  })

  it('persists to localStorage under jf-cart', () => {
    cart().add(product())
    const saved = JSON.parse(localStorage.getItem('jf-cart') ?? '{}')
    expect(saved.state.items[0].productId).toBe(1)
  })
})
