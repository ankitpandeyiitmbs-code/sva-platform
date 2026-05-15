'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, ShoppingCart, Package, Headphones,
  BarChart3, Megaphone, FolderKanban, MessageSquare, Zap,
  Settings, LogOut, LineChart,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useState } from 'react'

const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', permission: 'dashboard:read' },
      { href: '/analytics', icon: LineChart, label: 'Analytics', permission: 'dashboard:read' },
      { href: '/orders', icon: ShoppingCart, label: 'Orders', permission: 'orders:read' },
      { href: '/inventory', icon: Package, label: 'Inventory', permission: 'inventory:read' },
    ],
  },
  {
    label: 'Growth',
    items: [
      { href: '/crm', icon: Users, label: 'CRM', permission: 'crm:read' },
      { href: '/marketing', icon: Megaphone, label: 'Marketing', permission: 'marketing:read' },
      { href: '/support', icon: Headphones, label: 'Support', permission: 'support:read' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/finance', icon: BarChart3, label: 'Finance', permission: 'finance:read' },
    ],
  },
  {
    label: 'Team',
    items: [
      { href: '/projects', icon: FolderKanban, label: 'Projects', permission: 'projects:read' },
      { href: '/chat', icon: MessageSquare, label: 'Chat', permission: 'chat:read' },
      { href: '/automations', icon: Zap, label: 'Automations', permission: 'automation:read' },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()
  const [collapsed, setCollapsed] = useState(false)

  const userPermissions = user?.permissions ?? []

  return (
    <aside className={cn(
      'flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200',
      collapsed ? 'w-16' : 'w-60'
    )}>
      {/* Logo */}
      <div className={cn('flex items-center gap-3 px-4 py-4 border-b border-sidebar-border', collapsed && 'justify-center px-0')}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
          <span className="text-sm font-bold text-white">S</span>
        </div>
        {!collapsed && (
          <div>
            <p className="text-sm font-bold text-white leading-tight">SVA Platform</p>
            <p className="text-xs text-sidebar-foreground/60">SVA Organics</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) =>
            !item.permission || userPermissions.includes(item.permission as any)
          )
          if (!visibleItems.length) return null
          return (
            <div key={section.label} className="mb-4">
              {!collapsed && (
                <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  {section.label}
                </p>
              )}
              {visibleItems.map((item) => {
                const active = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      collapsed && 'justify-center px-2',
                      active
                        ? 'bg-sidebar-accent text-white'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className={cn('shrink-0', collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Bottom — User + Settings */}
      <div className="border-t border-sidebar-border p-2">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
            collapsed && 'justify-center px-2'
          )}
        >
          <Settings className={cn('shrink-0', collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
          {!collapsed && <span>Settings</span>}
        </Link>

        {!collapsed && user && (
          <div className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              {user.email[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-medium text-white">{user.email}</p>
              <p className="text-xs text-sidebar-foreground/50">{user.role}</p>
            </div>
            <button onClick={() => logout()} className="text-sidebar-foreground/40 hover:text-sidebar-foreground">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
