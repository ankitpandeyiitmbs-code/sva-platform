'use client'
export const dynamic = 'force-dynamic'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Link2, Users, Shield, Bell, RefreshCw, CheckCircle2, XCircle, Loader2 } from 'lucide-react'

const CHANNEL_CONFIGS = [
  { key: 'TIKTOK_SHOP', label: 'TikTok Shop', oauth: true, fields: [] },
  { key: 'AMAZON_US', label: 'Amazon US', fields: ['clientId', 'clientSecret', 'refreshToken'] },
  { key: 'AMAZON_IN', label: 'Amazon India', fields: ['clientId', 'clientSecret', 'refreshToken'] },
  { key: 'AMAZON_AE', label: 'Amazon UAE', fields: ['clientId', 'clientSecret', 'refreshToken'] },
  { key: 'AMAZON_UK', label: 'Amazon UK', fields: ['clientId', 'clientSecret', 'refreshToken'] },
  { key: 'AMAZON_AU', label: 'Amazon Australia', fields: ['clientId', 'clientSecret', 'refreshToken'] },
  { key: 'WALMART', label: 'Walmart', fields: ['clientId', 'clientSecret'] },
  { key: 'SHOPIFY', label: 'Shopify', fields: ['storeUrl', 'accessToken'] },
  { key: 'MYNTRA', label: 'Myntra', fields: ['partnerId', 'apiKey'] },
  { key: 'FLIPKART', label: 'Flipkart', fields: ['appId', 'appSecret'] },
]

export default function SettingsPage() {
  const [tab, setTab] = useState<'channels' | 'team' | 'security' | 'notifications'>('channels')
  const queryClient = useQueryClient()

  const { data: channels, refetch: refetchChannels } = useQuery({
    queryKey: ['channels'],
    queryFn: () => api.get('/channels').then((r) => r.data.data),
  })

  const { data: tiktokStatus, refetch: refetchTiktok } = useQuery({
    queryKey: ['tiktok-status'],
    queryFn: () => api.get('/tiktok/status').then((r) => r.data.data),
    refetchInterval: 10000,
  })

  // Handle TikTok OAuth callback result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tiktok = params.get('tiktok')
    if (tiktok === 'connected') {
      toast.success('TikTok Shop connected! Syncing your data...')
      refetchTiktok()
      refetchChannels()
      window.history.replaceState({}, '', '/settings')
    } else if (tiktok === 'error') {
      const reason = params.get('reason') ?? 'Unknown error'
      toast.error(`TikTok connection failed: ${reason}`)
      window.history.replaceState({}, '', '/settings')
    }
  }, [])

  const tabs = [
    { key: 'channels', label: 'Channel Integrations', icon: Link2 },
    { key: 'team', label: 'Team', icon: Users },
    { key: 'security', label: 'Security & 2FA', icon: Shield },
    { key: 'notifications', label: 'Notifications', icon: Bell },
  ]

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-lg border bg-muted/40 p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={cn('flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === t.key ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'channels' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {CHANNEL_CONFIGS.map((cfg) => {
            const existing = (channels ?? []).find((c: any) => c.channel === cfg.key)
            const isConnected = existing?.status === 'CONNECTED'
            return (
              <ChannelCard key={cfg.key} config={cfg} existing={existing} isConnected={isConnected}
                tiktokStatus={cfg.key === 'TIKTOK_SHOP' ? tiktokStatus : undefined} />
            )
          })}
        </div>
      )}

      {tab === 'team' && (
        <TeamSettings />
      )}

      {tab === 'security' && (
        <SecuritySettings />
      )}

      {tab === 'notifications' && (
        <div className="rounded-xl border p-6 text-center text-muted-foreground">Notification preferences — coming soon</div>
      )}
    </div>
  )
}

function ChannelCard({ config, existing, isConnected, tiktokStatus }: any) {
  const [expanded, setExpanded] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // ── TikTok OAuth flow ──────────────────────────────
  if (config.oauth) {
    const connected = tiktokStatus?.connected
    const handleConnect = async () => {
      try {
        const { data } = await api.get('/tiktok/connect')
        window.location.href = data.data.authUrl
      } catch { toast.error('Failed to start TikTok connection') }
    }
    const handleSync = async () => {
      setSyncing(true)
      try {
        const { data } = await api.post('/tiktok/sync')
        toast.success(`Synced ${data.data.orders.synced} orders & ${data.data.products.synced} products`)
      } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Sync failed') }
      finally { setSyncing(false) }
    }
    const handleDisconnect = async () => {
      await api.delete('/tiktok/disconnect')
      toast.success('Disconnected')
      window.location.reload()
    }
    return (
      <div className={cn('rounded-xl border-2 p-4', connected ? 'border-[#fe2c55]/40 bg-[#fe2c55]/5' : 'border-border')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black text-white font-bold">T</div>
            <div>
              <p className="font-semibold">TikTok Shop</p>
              <p className={cn('text-xs font-medium', connected ? 'text-green-600' : 'text-muted-foreground')}>
                {connected ? `✓ Connected — ${tiktokStatus.shopName}` : 'Not connected'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {connected ? (
              <>
                <button onClick={handleSync} disabled={syncing}
                  className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50">
                  {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  {syncing ? 'Syncing...' : 'Sync'}
                </button>
                <button onClick={handleDisconnect}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50">
                  Disconnect
                </button>
              </>
            ) : (
              <button onClick={handleConnect}
                className="flex items-center gap-2 rounded-lg bg-[#fe2c55] px-4 py-2 text-sm font-semibold text-white hover:bg-[#fe2c55]/90">
                Connect TikTok Shop
              </button>
            )}
          </div>
        </div>
        {connected && tiktokStatus?.lastSyncAt && (
          <p className="mt-2 text-xs text-muted-foreground border-t pt-2">
            Last sync: {new Date(tiktokStatus.lastSyncAt).toLocaleString()}
          </p>
        )}
      </div>
    )
  }

  // ── Regular credential-based channels ─────────────
  const isAmazon = config.key.startsWith('AMAZON_')
  const isWalmart = config.key === 'WALMART'

  const handleSave = async () => {
    setSaving(true)
    try {
      if (isWalmart) {
        const { data: validation } = await api.post('/walmart/validate', values)
        if (!validation.success) {
          toast.error(validation.message ?? 'Invalid credentials')
          setSaving(false)
          return
        }
      }
      await api.put(`/channels/${config.key}`, { credentials: values, displayName: config.label })
      toast.success(`${config.label} connected successfully`)
      setExpanded(false)
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to save credentials')
    } finally {
      setSaving(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      if (isAmazon) {
        const { data } = await api.post(`/amazon/${config.key}/sync`)
        toast.success(`Synced ${data.data.orders.synced} orders & ${data.data.inventory.synced} products`)
      } else if (isWalmart) {
        const { data } = await api.post('/walmart/sync')
        toast.success(`Synced ${data.data.orders.synced} orders & ${data.data.inventory.synced} products`)
      } else {
        await api.post(`/channels/${config.key}/sync`)
        toast.success(`${config.label} sync started`)
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className={cn('rounded-xl border p-4', isConnected && 'border-green-200 dark:border-green-900')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('h-2.5 w-2.5 rounded-full', isConnected ? 'bg-green-500' : 'bg-muted-foreground/30')} />
          <div>
            <p className="font-medium">{config.label}</p>
            <p className="text-xs text-muted-foreground">{isConnected ? 'Connected' : 'Not connected'}</p>
            {isConnected && existing?.lastSyncAt && (
              <p className="text-xs text-muted-foreground/60">
                Last sync: {new Date(existing.lastSyncAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {isConnected && (
            <button onClick={handleSync} disabled={syncing}
              className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50">
              {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
          )}
          <button onClick={() => setExpanded(!expanded)} className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted">
            {isConnected ? 'Edit' : 'Connect'}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-4 space-y-3 border-t pt-4">
          {config.fields.map((field: string) => (
            <div key={field} className="space-y-1">
              <label className="text-xs font-medium capitalize">{field.replace(/([A-Z])/g, ' $1')}</label>
              <input type="password" value={values[field] ?? ''}
                onChange={(e) => setValues({ ...values, [field]: e.target.value })}
                placeholder={`Enter ${field}`}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          ))}
          {isAmazon && (
            <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 p-3">
              Get credentials from <strong>Amazon Seller Central → Apps & Services → Develop Apps</strong>.
              You need: Client ID, Client Secret, and Refresh Token from your SP-API app.
            </p>
          )}
          {isWalmart && (
            <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 p-3">
              Get credentials from{' '}
              <a href="https://developer.walmart.com" target="_blank" className="underline font-medium">
                developer.walmart.com
              </a>{' '}
              → My Applications → Create New App. You need: <strong>Client ID</strong> and <strong>Client Secret</strong>.
            </p>
          )}
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save & Connect'}
          </button>
        </div>
      )}
    </div>
  )
}

const ALL_ROLES = ['SUPER_ADMIN','ADMIN','MANAGER','FINANCE','MARKETING','SUPPORT','WAREHOUSE','SALES','VIEWER','GUEST'] as const
const ROLE_COLORS: Record<string,string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-700', ADMIN: 'bg-orange-100 text-orange-700',
  MANAGER: 'bg-blue-100 text-blue-700', FINANCE: 'bg-emerald-100 text-emerald-700',
  MARKETING: 'bg-purple-100 text-purple-700', SUPPORT: 'bg-cyan-100 text-cyan-700',
  WAREHOUSE: 'bg-amber-100 text-amber-700', SALES: 'bg-pink-100 text-pink-700',
  VIEWER: 'bg-gray-100 text-gray-700', GUEST: 'bg-gray-100 text-gray-500',
}

function TeamSettings() {
  const qc = useQueryClient()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'VIEWER', password: '' })
  const [inviting, setInviting] = useState(false)
  const [createdUser, setCreatedUser] = useState<any>(null)
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [resetPwdUser, setResetPwdUser] = useState<any>(null)
  const [newPwd, setNewPwd] = useState('')
  const [resetting, setResetting] = useState(false)

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data.data),
  })
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me').then((r) => r.data.data),
  })
  const users = usersData ?? []
  const isSuperAdmin = me?.role === 'SUPER_ADMIN'
  const isAdmin = me?.role === 'SUPER_ADMIN' || me?.role === 'ADMIN'

  const inviteUser = async () => {
    if (!inviteForm.name || !inviteForm.email) return toast.error('Name and email required')
    setInviting(true)
    try {
      const { data } = await api.post('/users/invite', inviteForm)
      setCreatedUser(data.data)
      toast.success(`${data.data.name} invited! Temp password: ${data.data.tempPassword ?? inviteForm.password}`)
      qc.invalidateQueries({ queryKey: ['users'] })
      setInviteForm({ name: '', email: '', role: 'VIEWER', password: '' })
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to invite')
    } finally { setInviting(false) }
  }

  const updateRole = async (userId: string, role: string) => {
    try {
      await api.patch(`/users/${userId}`, { role })
      qc.invalidateQueries({ queryKey: ['users'] })
      setEditingRole(null)
      toast.success('Role updated')
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Failed') }
  }

  const resetPassword = async () => {
    if (!resetPwdUser || newPwd.length < 8) return toast.error('Password must be at least 8 characters')
    setResetting(true)
    try {
      await api.patch(`/users/${resetPwdUser.id}`, { newPassword: newPwd })
      toast.success(`Password updated for ${resetPwdUser.name}`)
      setResetPwdUser(null); setNewPwd('')
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Failed') }
    finally { setResetting(false) }
  }

  const toggleActive = async (userId: string, isActive: boolean) => {
    try {
      await api.patch(`/users/${userId}`, { isActive })
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success(isActive ? 'User activated' : 'User deactivated')
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Failed') }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Team</h3>
          <p className="text-sm text-muted-foreground">{users.length} member{users.length !== 1 ? 's' : ''} in your workspace</p>
        </div>
        {isAdmin && (
          <button onClick={() => setInviteOpen(!inviteOpen)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 transition-colors">
            <Users className="h-4 w-4" /> Invite Member
          </button>
        )}
      </div>

      {/* Invite form */}
      {inviteOpen && isAdmin && (
        <div className="rounded-xl border bg-muted/20 p-5 space-y-4">
          <h4 className="font-medium text-sm">Add Team Member</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Full Name</label>
              <input value={inviteForm.name} onChange={e => setInviteForm(f => ({...f, name: e.target.value}))}
                placeholder="John Doe" className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Email</label>
              <input type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({...f, email: e.target.value}))}
                placeholder="john@company.com" className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Role</label>
              <select value={inviteForm.role} onChange={e => setInviteForm(f => ({...f, role: e.target.value}))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
                {ALL_ROLES.filter(r => isSuperAdmin || r !== 'SUPER_ADMIN').map(r => (
                  <option key={r} value={r}>{r.replace('_',' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Password (min 8 chars, or leave blank to auto-generate)</label>
              <input value={inviteForm.password} onChange={e => setInviteForm(f => ({...f, password: e.target.value}))}
                placeholder="Min 8 characters" type="text"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={inviteUser} disabled={inviting}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
              {inviting && <Loader2 className="h-3 w-3 animate-spin" />} Add Member
            </button>
            <button onClick={() => setInviteOpen(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
          </div>
          {createdUser && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
              ✓ <strong>{createdUser.name}</strong> added. Share their login credentials securely.
            </div>
          )}
        </div>
      )}

      {/* Reset password modal */}
      {resetPwdUser && (
        <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/20 border-amber-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Reset password for <strong>{resetPwdUser.name}</strong></h4>
            <button onClick={() => { setResetPwdUser(null); setNewPwd('') }} className="text-muted-foreground hover:text-foreground text-xs">✕ Cancel</button>
          </div>
          <div className="flex gap-2">
            <input value={newPwd} onChange={e => setNewPwd(e.target.value)} type="text"
              placeholder="New password (min 8 characters)"
              className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
            <button onClick={resetPassword} disabled={resetting || newPwd.length < 8}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap">
              {resetting && <Loader2 className="h-3 w-3 animate-spin" />} Set Password
            </button>
          </div>
          {newPwd.length > 0 && newPwd.length < 8 && <p className="text-xs text-amber-700">Need {8 - newPwd.length} more characters</p>}
        </div>
      )}

      {/* Users table */}
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>{['Member','Email',...(isAdmin ? ['Role'] : []),'Status','Last Login',...(isAdmin ? ['Actions'] : [])].map((h) => (
              <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {users.map((u: any) => (
              <tr key={u.id} className="border-t hover:bg-muted/10">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {u.name?.[0]?.toUpperCase()}
                    </div>
                    <span className="font-medium">{u.name}</span>
                    {u.id === me?.id && <span className="text-xs text-muted-foreground">(you)</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{u.email}</td>
                {isAdmin && (<td className="px-4 py-3">
                  {isAdmin && editingRole === u.id ? (
                    <select autoFocus defaultValue={u.role}
                      onChange={e => updateRole(u.id, e.target.value)}
                      onBlur={() => setEditingRole(null)}
                      className="rounded-lg border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-primary">
                      {ALL_ROLES.filter(r => isSuperAdmin || r !== 'SUPER_ADMIN').map(r => (
                        <option key={r} value={r}>{r.replace('_',' ')}</option>
                      ))}
                    </select>
                  ) : (
                    <button onClick={() => isAdmin && u.id !== me?.id && u.role !== 'SUPER_ADMIN' && setEditingRole(u.id)}
                      className={cn('rounded-full px-2 py-0.5 text-xs font-medium', ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-700',
                        isAdmin && u.id !== me?.id && u.role !== 'SUPER_ADMIN' ? 'cursor-pointer hover:opacity-80' : 'cursor-default')}>
                      {u.role.replace('_',' ')}
                      {isAdmin && u.id !== me?.id && u.role !== 'SUPER_ADMIN' && <span className="ml-1 opacity-50">▾</span>}
                    </button>
                  )}
                </td>)}
                <td className="px-4 py-3">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs', u.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {u.id !== me?.id && (
                      <a href={`/chat?dm=${u.id}`}
                        className="rounded-lg border px-2 py-1 text-xs hover:bg-muted transition-colors flex items-center gap-1">
                        💬 Chat
                      </a>
                    )}
                    {/* Enable/Disable */}
                    {isAdmin && u.id !== me?.id && u.role !== 'SUPER_ADMIN' && (
                      <button onClick={() => toggleActive(u.id, !u.isActive)}
                        className={cn('rounded-lg border px-2 py-1 text-xs transition-colors',
                          u.isActive ? 'hover:bg-red-50 hover:text-red-600 hover:border-red-200' : 'hover:bg-green-50 hover:text-green-600 hover:border-green-200')}>
                        {u.isActive ? 'Disable' : 'Enable'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role legend - only for admins */}
      {isAdmin && <div className="rounded-xl border p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Role Access Levels</p>
        <div className="grid grid-cols-2 gap-y-1 text-xs text-muted-foreground">
          <span><span className="font-medium text-red-700">SUPER_ADMIN</span> — Full access, manage users & roles</span>
          <span><span className="font-medium text-orange-700">ADMIN</span> — Manage team, all data, no billing</span>
          <span><span className="font-medium text-blue-700">MANAGER</span> — Orders, inventory, CRM, reports</span>
          <span><span className="font-medium text-emerald-700">FINANCE</span> — Financial data, orders, read-only</span>
          <span><span className="font-medium text-purple-700">MARKETING</span> — CRM, campaigns, analytics</span>
          <span><span className="font-medium text-gray-700">VIEWER</span> — Read-only access to all sections</span>
        </div>
      </div>}
    </div>
  )
}

function SecuritySettings() {
  return (
    <div className="space-y-4 max-w-lg">
      <div className="rounded-xl border p-5 space-y-3">
        <h3 className="font-semibold">Two-Factor Authentication</h3>
        <p className="text-sm text-muted-foreground">Add an extra layer of security to your account using an authenticator app.</p>
        <button
          onClick={async () => {
            const { data } = await api.post('/auth/2fa/setup')
            toast.info('Scan the QR code with your authenticator app')
          }}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90"
        >
          Set Up 2FA
        </button>
      </div>
      <div className="rounded-xl border p-5 space-y-3">
        <h3 className="font-semibold">Audit Log</h3>
        <p className="text-sm text-muted-foreground">Every action in the platform is logged — who did what, when, and what changed.</p>
        <button className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">View Audit Log</button>
      </div>
    </div>
  )
}
