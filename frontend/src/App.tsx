import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import LoginPage from './pages/LoginPage'
import WorkspacePage from './pages/WorkspacePage'
import DashboardPage from './pages/DashboardPage'
import PlaceholderPage from './pages/PlaceholderPage'
import ProtectedRoute from './components/ProtectedRoute'
import RequirePermission from './components/RequirePermission'
import AppLayout from './components/AppLayout'
import ProductsPage from './pages/ProductsPage'
import CashierPage from './pages/CashierPage'
import TablesPage from './pages/TablesPage'
import OrdersPage from './pages/OrdersPage'
import KdsPage from './pages/KdsPage'
import AuditPage from './pages/AuditPage'
import SettingsPage from './pages/SettingsPage'
import TablesAdminPage from './pages/TablesAdminPage'
import UsersPage from './pages/UsersPage'
import RolesPage from './pages/RolesPage'
import { useToastStore } from './stores/toastStore'
import ShiftPage from './pages/ShiftPage'
import ShiftsAdminPage from './pages/ShiftsAdminPage'

export default function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe)

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

    // Sesi berakhir (token dicabut, akun dinonaktifkan, atau password diganti di perangkat lain)
  useEffect(() => {
    const onExpired = () => {
      if (useAuthStore.getState().user) {
        useAuthStore.setState({ user: null })
        useToastStore.getState().push('error', 'Sesi Anda berakhir, silakan masuk kembali')
      }
    }
    window.addEventListener('auth:expired', onExpired)
    return () => window.removeEventListener('auth:expired', onExpired)
  }, [])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Dashboard Manajemen */}
      <Route element={<ProtectedRoute allowedRoles={['admin', 'inventory']} />}>
        <Route element={<AppLayout workspace="manajemen" />}>
          <Route path="/manajemen" element={<DashboardPage />} />
          <Route
            path="/manajemen/produk"
            element={
              <RequirePermission code="product.view">
                <ProductsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/manajemen/inventori"
            element={
              <RequirePermission code="product.view">
                <PlaceholderPage title="Inventori" description="Kelola bahan baku, resep, dan stok." />
              </RequirePermission>
            }
          />
          <Route
            path="/manajemen/laporan"
            element={
              <RequirePermission code="report.view">
                <PlaceholderPage title="Laporan" description="Laporan penjualan dan analitik." />
              </RequirePermission>
            }
          />
          <Route
            path="/manajemen/pengguna"
            element={
              <RequirePermission code="user.manage">
                <UsersPage />
              </RequirePermission>
            }
          />
          <Route
            path="/manajemen/role"
            element={
              <RequirePermission code="role.manage">
                <RolesPage />
              </RequirePermission>
            }
          />
          <Route
            path="/manajemen/audit"
            element={
              <RequirePermission code="audit.view">
                <AuditPage />
              </RequirePermission>
            }
          />
                    <Route
            path="/manajemen/meja"
            element={
              <RequirePermission code="table.manage">
                <TablesAdminPage />
              </RequirePermission>
            }
          />
          <Route
            path="/manajemen/pengaturan"
            element={
              <RequirePermission code="settings.manage">
                <SettingsPage />
              </RequirePermission>
            }
          />
        </Route>
      </Route>

      {/* Operasional POS */}
      <Route element={<ProtectedRoute allowedRoles={['cashier', 'waiter']} />}>
        <Route element={<AppLayout workspace="pos" />}>
          <Route
            path="/pos"
            element={
              <RequirePermission code="order.create">
                <CashierPage />
              </RequirePermission>
            }
          />
          <Route
            path="/pos/meja"
            element={
              <RequirePermission code="order.view">
                <TablesPage />
              </RequirePermission>
            }
          />
          <Route
            path="/pos/transaksi"
            element={
              <RequirePermission code="order.view">
                <OrdersPage />
              </RequirePermission>
            }
          />
          <Route
            path="/pos/shift"
            element={
              <RequirePermission code="shift.operate">
                <ShiftPage />
              </RequirePermission>
            }
          />
        </Route>
      </Route>

      {/* Dapur */}
      <Route element={<ProtectedRoute allowedRoles={['kitchen']} />}>
        <Route element={<AppLayout workspace="dapur" />}>
          <Route
            path="/dapur"
            element={
              <RequirePermission code="order.view">
                <KdsPage />
              </RequirePermission>
            }
          />
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route
          path="/tanpa-akses"
          element={<WorkspacePage title="Belum ada akses" description="Akun Anda belum diberi role. Hubungi owner." />}
        />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}