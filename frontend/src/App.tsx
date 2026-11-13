import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import LoginPage from './pages/LoginPage'
import WorkspacePage from './pages/WorkspacePage'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe)

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute allowedRoles={['admin', 'inventory']} />}>
        <Route
          path="/manajemen"
          element={<WorkspacePage title="Dashboard Manajemen" description="Ruang kerja Owner, Admin, dan Manager." />}
        />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['cashier', 'waiter']} />}>
        <Route
          path="/pos"
          element={<WorkspacePage title="Dashboard Operasional POS" description="Ruang kerja Kasir dan Pelayan." />}
        />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['kitchen']} />}>
        <Route
          path="/dapur"
          element={<WorkspacePage title="Dashboard Dapur (KDS)" description="Ruang kerja Staf Dapur." />}
        />
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