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
    { key: 'team', label: 'Team & Users', icon: Users },
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

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put(`/channels/${config.key}`, { credentials: values, displayName: config.label })
      toast.success(`${config.label} connected successfully`)
      setExpanded(false)
    } catch {
      toast.error('Failed to save credentials')
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
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save & Connect'}
          </button>
        </div>
      )}
    </div>
  )
}

function TeamSettings() {
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data.data),
  })

  return (
    <div className="space-y-4">
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>{['Name', 'Email', 'Role', 'Status', 'Last Login'].map((h) => (
              <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {(users ?? []).map((u: any) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs">{u.role}</span></td>
                <td className="px-4 py-3"><span className={cn('rounded-full px-2 py-0.5 text-xs', u.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                <td className="px-4 py-3 text-muted-foreground">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
