import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore, homePathFor } from '../stores/authStore'
import ForcePasswordChange from '../pages/ForcePasswordChange'

export default function ProtectedRoute({ allowedRoles }: { allowedRoles?: string[] }) {
  const { user, loading } = useAuthStore()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Memuat...
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  // Password sementara wajib diganti sebelum memakai aplikasi
  if (user.mustChangePassword) return <ForcePasswordChange />

  if (
    allowedRoles &&
    !user.roles.includes('owner') &&
    !user.roles.some((r) => allowedRoles.includes(r))
  ) {
    return <Navigate to={homePathFor(user)} replace />
  }

  return <Outlet />
}