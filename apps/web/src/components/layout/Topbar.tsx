'use client'
import { Bell, Search, HelpCircle } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/analytics': 'Analytics',
  '/crm': 'CRM',
  '/orders': 'Orders',
  '/inventory': 'Inventory',
  '/support': 'Support',
  '/finance': 'Finance',
  '/marketing': 'Marketing',
  '/projects': 'Projects',
  '/chat': 'Team Chat',
  '/automations': 'Automations',
  '/settings': 'Settings',
}

export function Topbar() {
  const pathname = usePathname()
  const [searchOpen, setSearchOpen] = useState(false)

  const title = Object.entries(PAGE_TITLES).find(([path]) => pathname.startsWith(path))?.[1] ?? 'SVA Platform'

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b px-6">
      <h1 className="text-base font-semibold">{title}</h1>

      <div className="flex flex-1 items-center gap-2">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors ml-4"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search anything...</span>
          <kbd className="ml-4 rounded border bg-background px-1.5 text-xs">⌘K</kbd>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button className="relative flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />
        </button>
        <button className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors">
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </header>
  )
}
