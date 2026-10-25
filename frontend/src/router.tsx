import type { ComponentType } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router'
import { RootLayout } from '@/components/layout/RootLayout'
import { RouteError } from '@/pages/NotFoundPage'
import HomePage from '@/pages/HomePage'

// Every page except the home page is its own chunk, loaded on first visit
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await load()).default })

const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'menu', lazy: page(() => import('@/pages/MenuPage')) },
      { path: 'menu/:catalogSlug', lazy: page(() => import('@/pages/MenuPage')) },
      { path: 'p/:slug', lazy: page(() => import('@/pages/ProductPage')) },
      { path: 'cart', lazy: page(() => import('@/pages/CartPage')) },
      { path: 'checkout', lazy: page(() => import('@/pages/CheckoutPage')) },
      { path: 'order-success/:code', lazy: page(() => import('@/pages/OrderSuccessPage')) },
      { path: 'track', lazy: page(() => import('@/pages/TrackOrderPage')) },
      { path: 'about', lazy: page(() => import('@/pages/AboutPage')) },
      { path: 'policies', lazy: page(() => import('@/pages/PoliciesPage')) },
      { path: 'credits', lazy: page(() => import('@/pages/CreditsPage')) },
      { path: 'login', lazy: page(() => import('@/pages/auth/LoginPage')) },
      { path: 'register', lazy: page(() => import('@/pages/auth/RegisterPage')) },
      { path: 'activate', lazy: page(() => import('@/pages/auth/ActivatePage')) },
      { path: 'forgot-password', lazy: page(() => import('@/pages/auth/ForgotPasswordPage')) },
      {
        path: 'account',
        lazy: page(() => import('@/pages/account/AccountLayout')),
        children: [
          { index: true, lazy: page(() => import('@/pages/account/ProfilePage')) },
          { path: 'orders', lazy: page(() => import('@/pages/account/OrdersPage')) },
          { path: 'orders/:code', lazy: page(() => import('@/pages/account/OrderDetailPage')) },
          { path: 'addresses', lazy: page(() => import('@/pages/account/AddressesPage')) },
          { path: 'wishlist', lazy: page(() => import('@/pages/account/WishlistPage')) },
          { path: 'security', lazy: page(() => import('@/pages/account/SecurityPage')) },
        ],
      },
      { path: '*', lazy: page(() => import('@/pages/NotFoundPage')) },
    ],
  },
  {
    // Back office: its own shell (no storefront header/footer), staff and admins only
    path: 'admin',
    lazy: page(() => import('@/admin/AdminLayout')),
    errorElement: <RouteError />,
    children: [
      { index: true, lazy: page(() => import('@/admin/pages/DashboardPage')) },
      { path: 'orders', lazy: page(() => import('@/admin/pages/OrdersPage')) },
      { path: 'orders/:id', lazy: page(() => import('@/admin/pages/OrderDetailPage')) },
      { path: 'products', lazy: page(() => import('@/admin/pages/ProductsPage')) },
      { path: 'products/new', lazy: page(() => import('@/admin/pages/ProductEditPage')) },
      { path: 'products/:id', lazy: page(() => import('@/admin/pages/ProductEditPage')) },
      { path: 'catalog', lazy: page(() => import('@/admin/pages/CatalogPage')) },
      { path: 'customers', lazy: page(() => import('@/admin/pages/CustomersPage')) },
      { path: 'customers/:id', lazy: page(() => import('@/admin/pages/CustomerDetailPage')) },
      { path: 'coupons', lazy: page(() => import('@/admin/pages/CouponsPage')) },
      { path: 'reviews', lazy: page(() => import('@/admin/pages/ReviewsPage')) },
      { path: 'policies', lazy: page(() => import('@/admin/pages/PoliciesPage')) },
      { path: 'settings', lazy: page(() => import('@/admin/pages/SettingsPage')) },
      { path: 'staff', lazy: page(() => import('@/admin/pages/StaffPage')) },
      { path: '*', lazy: page(() => import('@/admin/pages/AdminNotFound')) },
    ],
  },
]

export const router = createBrowserRouter(routes)
