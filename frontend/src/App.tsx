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

export default function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe)

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

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
                <PlaceholderPage title="Produk" description="Kelola produk, kategori, varian, dan modifier." />
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
                <PlaceholderPage title="Pengguna" description="Kelola akun, role, dan izin." />
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
                <PlaceholderPage title="Kasir" description="Pilih produk dan buat pesanan." />
              </RequirePermission>
            }
          />
          <Route
            path="/pos/meja"
            element={
              <RequirePermission code="order.view">
                <PlaceholderPage title="Meja" description="Pantau status meja restoran." />
              </RequirePermission>
            }
          />
          <Route
            path="/pos/transaksi"
            element={
              <RequirePermission code="order.view">
                <PlaceholderPage title="Transaksi" description="Riwayat transaksi dan struk." />
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
                <PlaceholderPage title="Antrean Pesanan" description="Tiket pesanan untuk dapur dan bar." />
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