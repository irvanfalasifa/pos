import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  Coffee,
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useThemeStore } from '../stores/themeStore'
import { workspaces, accessibleWorkspaces, visibleItems } from '../config/navigation'
import type { NavItem, Workspace, WorkspaceKey } from '../config/navigation'

type SidebarProps = {
  workspace: Workspace
  items: NavItem[]
  others: Workspace[]
  collapsed: boolean
  onNavigate?: () => void
}

function SidebarContent({ workspace, items, others, collapsed, onNavigate }: SidebarProps) {
  return (
    <div className="flex h-full flex-col">
      <div
        className={`flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 dark:border-slate-800 ${
          collapsed ? 'justify-center' : 'px-5'
        }`}
      >
        <div className="rounded-xl bg-amber-500 p-2 text-white">
          <Coffee className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <p className="font-bold text-slate-800 dark:text-white">POS Restoran</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{workspace.label}</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            onClick={onNavigate}
            title={item.label}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                collapsed ? 'justify-center' : ''
              } ${
                isActive
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {others.length > 0 && (
        <div className="shrink-0 border-t border-slate-200 p-3 dark:border-slate-800">
          {!collapsed && (
            <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              Ruang kerja lain
            </p>
          )}
          {others.map((w) => (
            <Link
              key={w.key}
              to={w.basePath}
              onClick={onNavigate}
              title={w.label}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 ${
                collapsed ? 'justify-center' : ''
              }`}
            >
              <w.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{w.label}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AppLayout({ workspace }: { workspace: WorkspaceKey }) {
  const { user, logout } = useAuthStore()
  const { theme, toggle } = useThemeStore()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  if (!user) return null

  const current = workspaces.find((w) => w.key === workspace)!
  const items = visibleItems(user, current)
  const others = accessibleWorkspaces(user).filter((w) => w.key !== workspace)
  const initial = user.name.charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden border-r border-slate-200 bg-white transition-all duration-300 lg:block dark:border-slate-800 dark:bg-slate-900 ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        <SidebarContent workspace={current} items={items} others={others} collapsed={collapsed} />
      </aside>

      {/* Sidebar ponsel/tablet (laci) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-2xl dark:bg-slate-900">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Tutup menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent
              workspace={current}
              items={items}
              others={others}
              collapsed={false}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className={`transition-all duration-300 ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur sm:px-6 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Buka menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:block dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
            >
              {collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
            </button>
            <h2 className="ml-1 font-semibold text-slate-800 dark:text-white">{current.label}</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              className="rounded-xl p-2.5 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Ganti tema"
              title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-3 transition hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500 font-semibold text-white">
                  {initial}
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-sm font-semibold text-slate-800 dark:text-white">
                    {user.name}
                  </span>
                  <span className="block text-xs capitalize text-slate-500 dark:text-slate-400">
                    {user.roles.join(', ')}
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-40 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    <div className="px-3 py-2">
                      <p className="text-sm font-semibold text-slate-800 dark:text-white">{user.name}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                    </div>
                    <button
                      onClick={logout}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-600 transition hover:bg-red-50 dark:hover:bg-red-500/10"
                    >
                      <LogOut className="h-4 w-4" />
                      Keluar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}