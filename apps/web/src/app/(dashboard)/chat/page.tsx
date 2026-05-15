'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  Hash, Plus, Send, Lock, X, Search, MessageSquare, Users, Phone, Video,
  Paperclip, Smile, MoreHorizontal, Edit2, Trash2, Pin, Check, ChevronDown,
  Mic, MicOff, VideoOff, PhoneOff, Volume2, UserPlus, Settings2, Image,
  FileText, Film, Music, Download, CheckCheck, Bell, AtSign,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth'

const EMOJI_LIST = ['👍','❤️','😂','😮','😢','🔥','✅','👏','🙏','💯']

// ── Helpers ──────────────────────────────────────────────
function timeAgo(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(d).toLocaleDateString()
}
function formatTime(d: string) {
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}
function getColor(id: string) {
  const colors = ['bg-blue-500','bg-green-500','bg-purple-500','bg-orange-500','bg-pink-500','bg-teal-500','bg-red-500','bg-indigo-500']
  let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % colors.length
  return colors[h]
}

// ── Avatar ────────────────────────────────────────────────
function Avatar({ name, id, size = 8, url }: { name: string; id: string; size?: number; url?: string }) {
  if (url) return <img src={url} className={`h-${size} w-${size} rounded-full object-cover shrink-0`} alt={name} />
  return (
    <div className={cn(`h-${size} w-${size} rounded-full shrink-0 flex items-center justify-center text-white font-semibold`, getColor(id))}
      style={{ fontSize: size * 1.5 + 'px' }}>
      {getInitials(name)}
    </div>
  )
}

// ── Create DM Modal ───────────────────────────────────────
function NewDMModal({ users, onClose, onCreate }: { users: any[]; onClose: () => void; onCreate: (userId: string) => void }) {
  const [q, setQ] = useState('')
  const filtered = users.filter(u => u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl border bg-background p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">New Direct Message</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search people..."
          className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary mb-3" />
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {filtered.map(u => (
            <button key={u.id} onClick={() => { onCreate(u.id); onClose() }}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted text-left">
              <Avatar name={u.name} id={u.id} url={u.avatarUrl} size={8} />
              <div>
                <p className="text-sm font-medium">{u.name}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No users found</p>}
        </div>
      </div>
    </div>
  )
}

// ── Create Group Modal ────────────────────────────────────
function NewGroupModal({ users, currentUserId, onClose, onCreate }: { users: any[]; currentUserId: string; onClose: () => void; onCreate: (d: any) => void }) {
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [q, setQ] = useState('')
  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const filtered = users.filter(u => u.id !== currentUserId && (u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase())))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">New Group</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Group name"
          className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary mb-3" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Add people..."
          className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary mb-2" />
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {selected.map(id => {
              const u = users.find(x => x.id === id)
              return <span key={id} className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {u?.name} <button onClick={() => toggle(id)}><X className="h-3 w-3" /></button>
              </span>
            })}
          </div>
        )}
        <div className="space-y-1 max-h-48 overflow-y-auto mb-4">
          {filtered.map(u => (
            <button key={u.id} onClick={() => toggle(u.id)}
              className={cn('w-full flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted text-left', selected.includes(u.id) && 'bg-primary/5')}>
              <Avatar name={u.name} id={u.id} url={u.avatarUrl} size={7} />
              <span className="text-sm flex-1">{u.name}</span>
              {selected.includes(u.id) && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
        <button
          disabled={!name.trim() || selected.length === 0}
          onClick={() => { onCreate({ name, type: 'GROUP', memberIds: selected }); onClose() }}
          className="w-full rounded-lg bg-primary py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50">
          Create Group ({selected.length} people)
        </button>
      </div>
    </div>
  )
}

// ── Call Modal ────────────────────────────────────────────
function CallModal({ callType, channelName, onEnd }: { callType: 'video' | 'audio'; channelName: string; onEnd: () => void }) {
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [duration, setDuration] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setDuration(d => d + 1), 1000)
    if (callType === 'video') {
      navigator.mediaDevices?.getUserMedia({ video: true, audio: true }).then(stream => {
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      }).catch(() => {})
    } else {
      navigator.mediaDevices?.getUserMedia({ audio: true }).then(stream => {
        streamRef.current = stream
      }).catch(() => {})
    }
    return () => {
      clearInterval(timer)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [callType])

  const toggleMute = () => {
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = muted; })
    setMuted(m => !m)
  }
  const toggleCam = () => {
    streamRef.current?.getVideoTracks().forEach(t => { t.enabled = camOff; })
    setCamOff(c => !c)
  }

  const fmt = (s: number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900 text-white">
      {callType === 'video' ? (
        <div className="relative w-full max-w-3xl h-[60vh] rounded-2xl overflow-hidden bg-gray-800 mb-6">
          <video ref={videoRef} autoPlay muted playsInline className={cn('w-full h-full object-cover', camOff && 'hidden')} />
          {camOff && (
            <div className="absolute inset-0 flex items-center justify-center">
              <VideoOff className="h-16 w-16 text-gray-500" />
            </div>
          )}
          <div className="absolute bottom-3 left-3 bg-black/50 rounded-lg px-3 py-1 text-sm">You</div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="h-24 w-24 rounded-full bg-gray-700 flex items-center justify-center">
            <Volume2 className="h-12 w-12 text-gray-400" />
          </div>
        </div>
      )}
      <h2 className="text-xl font-semibold mb-1">{channelName}</h2>
      <p className="text-gray-400 text-sm mb-8">{fmt(duration)} • {callType === 'video' ? 'Video Call' : 'Voice Call'}</p>
      <div className="flex items-center gap-4">
        <button onClick={toggleMute}
          className={cn('h-14 w-14 rounded-full flex items-center justify-center transition-colors', muted ? 'bg-red-500' : 'bg-gray-700 hover:bg-gray-600')}>
          {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </button>
        {callType === 'video' && (
          <button onClick={toggleCam}
            className={cn('h-14 w-14 rounded-full flex items-center justify-center transition-colors', camOff ? 'bg-red-500' : 'bg-gray-700 hover:bg-gray-600')}>
            {camOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
          </button>
        )}
        <button onClick={onEnd} className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center">
          <PhoneOff className="h-6 w-6" />
        </button>
      </div>
    </div>
  )
}

// ── Task Detected Banner ──────────────────────────────────
function TaskBanner({ task, onDismiss }: { task: { title: string; dueDate?: string }; onDismiss: () => void }) {
  return (
    <div className="mx-4 mb-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start gap-3 dark:bg-emerald-950/30 dark:border-emerald-800">
      <CheckCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Task auto-detected & created!</p>
        <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5 truncate">{task.title}</p>
        {task.dueDate && <p className="text-xs text-emerald-600 mt-0.5">Due: {new Date(task.dueDate).toLocaleDateString()}</p>}
      </div>
      <button onClick={onDismiss}><X className="h-4 w-4 text-emerald-600" /></button>
    </div>
  )
}

// ── File type icon ────────────────────────────────────────
function AttachIcon({ type }: { type: string }) {
  if (type.startsWith('image')) return <Image className="h-4 w-4" />
  if (type.startsWith('video')) return <Film className="h-4 w-4" />
  if (type.startsWith('audio')) return <Music className="h-4 w-4" />
  return <FileText className="h-4 w-4" />
}

// ── Main Page ─────────────────────────────────────────────
export default function ChatPage() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const userId = (user as any)?.sub ?? ''

  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [showNewDM, setShowNewDM] = useState(false)
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [emojiTarget, setEmojiTarget] = useState<string | null>(null)
  const [call, setCall] = useState<{ type: 'video' | 'audio'; channelName: string } | null>(null)
  const [detectedTask, setDetectedTask] = useState<any>(null)
  const [attachments, setAttachments] = useState<any[]>([])
  const [sidebarSection, setSidebarSection] = useState<'all' | 'dms' | 'groups' | 'channels'>('all')

  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Queries ──
  const { data: channels = [] } = useQuery({
    queryKey: ['chat', 'channels'],
    queryFn: () => api.get('/chat/channels').then(r => r.data.data),
    refetchInterval: 3000,
  })

  const { data: orgUsers = [] } = useQuery({
    queryKey: ['org', 'users'],
    queryFn: () => api.get('/users').then(r => r.data.data),
  })

  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ['chat', 'messages', activeChannelId],
    queryFn: () => activeChannelId
      ? api.get(`/chat/channels/${activeChannelId}/messages`).then(r => r.data.data)
      : [],
    enabled: !!activeChannelId,
    refetchInterval: 2000,
  })

  const activeChannel = channels.find((c: any) => c.id === activeChannelId)

  // Scroll to bottom when messages load
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // ── Mutations ──
  const sendMsg = useMutation({
    mutationFn: (data: any) => api.post(`/chat/channels/${activeChannelId}/messages`, data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['chat', 'messages', activeChannelId] })
      qc.invalidateQueries({ queryKey: ['chat', 'channels'] })
      setMessage(''); setAttachments([])
      if (res.data.detectedTask) {
        setDetectedTask(res.data.detectedTask)
        setTimeout(() => setDetectedTask(null), 8000)
      }
    },
  })

  const editMsg = useMutation({
    mutationFn: ({ id, body }: any) => api.patch(`/chat/messages/${id}`, { body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['chat', 'messages', activeChannelId] }); setEditingId(null) },
  })

  const deleteMsg = useMutation({
    mutationFn: (id: string) => api.delete(`/chat/messages/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', 'messages', activeChannelId] }),
  })

  const reactMsg = useMutation({
    mutationFn: ({ id, emoji }: any) => api.post(`/chat/messages/${id}/react`, { emoji }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['chat', 'messages', activeChannelId] }); setEmojiTarget(null) },
  })

  const createChannel = useMutation({
    mutationFn: (data: any) => api.post('/chat/channels', data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['chat', 'channels'] })
      setActiveChannelId(res.data.data.id)
      toast.success('Created!')
    },
    onError: () => toast.error('Failed to create'),
  })

  const startCall = useMutation({
    mutationFn: ({ channelId, callType }: any) => api.post(`/chat/channels/${channelId}/call`, { action: 'start', callType }),
    onSuccess: (_r, vars) => {
      setCall({ type: vars.callType, channelName: activeChannel?.name ?? '' })
      qc.invalidateQueries({ queryKey: ['chat', 'messages', activeChannelId] })
    },
  })

  // ── File upload handler ──
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => {
        setAttachments(a => [...a, {
          name: file.name,
          size: file.size,
          type: file.type,
          url: ev.target?.result as string,
        }])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const handleSend = () => {
    if ((!message.trim() && attachments.length === 0) || !activeChannelId) return
    sendMsg.mutate({ body: message.trim() || '📎 Attachment', attachments })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // ── Filtered channels ──
  const filtered = channels.filter((c: any) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    if (sidebarSection === 'dms') return c.type === 'DM'
    if (sidebarSection === 'groups') return c.type === 'GROUP'
    if (sidebarSection === 'channels') return c.type === 'CHANNEL'
    return true
  })

  const dms = channels.filter((c: any) => c.type === 'DM')
  const groups = channels.filter((c: any) => c.type === 'GROUP')
  const publicChannels = channels.filter((c: any) => c.type === 'CHANNEL')

  const getChannelLabel = (c: any) => {
    if (c.type === 'DM') {
      const otherId = c.memberIds?.find((id: string) => id !== userId)
      const other = orgUsers.find((u: any) => u.id === otherId)
      return other?.name ?? c.name
    }
    return c.name
  }

  return (
    <>
      {call && <CallModal callType={call.type} channelName={call.channelName} onEnd={() => setCall(null)} />}

      <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-xl border bg-background">
        {/* ── Sidebar ── */}
        <div className="w-64 shrink-0 flex flex-col border-r bg-muted/20">
          {/* Search */}
          <div className="p-3 border-b">
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            </div>
          </div>

          {/* Section tabs */}
          <div className="flex border-b text-xs">
            {(['all','dms','groups','channels'] as const).map(s => (
              <button key={s} onClick={() => setSidebarSection(s)}
                className={cn('flex-1 py-2 capitalize font-medium transition-colors', sidebarSection === s ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground')}>
                {s}
              </button>
            ))}
          </div>

          <nav className="flex-1 overflow-y-auto py-2">
            {/* DMs */}
            {(sidebarSection === 'all' || sidebarSection === 'dms') && (
              <div className="mb-2">
                <div className="flex items-center justify-between px-3 py-1">
                  <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Direct Messages</span>
                  <button onClick={() => setShowNewDM(true)} className="rounded p-0.5 hover:bg-muted"><Plus className="h-3.5 w-3.5 text-muted-foreground" /></button>
                </div>
                {dms.map((c: any) => (
                  <ChannelItem key={c.id} channel={c} active={c.id === activeChannelId}
                    label={getChannelLabel(c)} onClick={() => setActiveChannelId(c.id)}
                    icon={<div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">
                      {getInitials(getChannelLabel(c))}
                    </div>} />
                ))}
              </div>
            )}

            {/* Groups */}
            {(sidebarSection === 'all' || sidebarSection === 'groups') && (
              <div className="mb-2">
                <div className="flex items-center justify-between px-3 py-1">
                  <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Groups</span>
                  <button onClick={() => setShowNewGroup(true)} className="rounded p-0.5 hover:bg-muted"><Plus className="h-3.5 w-3.5 text-muted-foreground" /></button>
                </div>
                {groups.map((c: any) => (
                  <ChannelItem key={c.id} channel={c} active={c.id === activeChannelId}
                    label={c.name} onClick={() => setActiveChannelId(c.id)}
                    icon={<Users className="h-4 w-4 text-muted-foreground" />} />
                ))}
              </div>
            )}

            {/* Channels */}
            {(sidebarSection === 'all' || sidebarSection === 'channels') && (
              <div className="mb-2">
                <div className="flex items-center justify-between px-3 py-1">
                  <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Channels</span>
                  <button onClick={() => setShowNewChannel(true)} className="rounded p-0.5 hover:bg-muted"><Plus className="h-3.5 w-3.5 text-muted-foreground" /></button>
                </div>
                {publicChannels.map((c: any) => (
                  <ChannelItem key={c.id} channel={c} active={c.id === activeChannelId}
                    label={c.name} onClick={() => setActiveChannelId(c.id)}
                    icon={c.isPrivate ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : <Hash className="h-3.5 w-3.5 text-muted-foreground" />} />
                ))}
              </div>
            )}
          </nav>
        </div>

        {/* ── Main chat area ── */}
        {activeChannel ? (
          <div className="flex flex-1 flex-col min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {activeChannel.type === 'DM'
                  ? <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {getInitials(getChannelLabel(activeChannel))}
                    </div>
                  : activeChannel.type === 'GROUP'
                    ? <Users className="h-5 w-5 text-muted-foreground shrink-0" />
                    : <Hash className="h-5 w-5 text-muted-foreground shrink-0" />
                }
                <div className="min-w-0">
                  <h2 className="font-semibold text-sm truncate">{getChannelLabel(activeChannel)}</h2>
                  {activeChannel.description && <p className="text-xs text-muted-foreground truncate">{activeChannel.description}</p>}
                  {activeChannel.memberIds?.length > 0 && activeChannel.type !== 'DM' && (
                    <p className="text-xs text-muted-foreground">{activeChannel.memberIds.length} members</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => startCall.mutate({ channelId: activeChannelId, callType: 'audio' })}
                  title="Voice call"
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <Phone className="h-4 w-4" />
                </button>
                <button onClick={() => startCall.mutate({ channelId: activeChannelId, callType: 'video' })}
                  title="Video call"
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <Video className="h-4 w-4" />
                </button>
                <button title="Members" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <UserPlus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
              {(messages as any[]).map((msg: any, i: number) => {
                const isMine = msg.userId === userId
                const isDeleted = !!msg.deletedAt
                const prevMsg = i > 0 ? (messages as any[])[i - 1] : null
                const showHeader = !prevMsg || prevMsg.userId !== msg.userId ||
                  (new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) > 300000

                if (isDeleted) return (
                  <div key={msg.id} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
                    <span className="text-xs text-muted-foreground italic px-3 py-1">🚫 This message was deleted</span>
                  </div>
                )

                // Check if call message
                const callAttach = msg.attachments?.[0]?.type === 'call' ? msg.attachments[0] : null

                return (
                  <div key={msg.id} className={cn('group flex gap-2', isMine ? 'flex-row-reverse' : 'flex-row')}>
                    {/* Avatar */}
                    {showHeader && !isMine ? (
                      <Avatar name={msg.user?.name ?? '?'} id={msg.userId ?? ''} url={msg.user?.avatarUrl} size={8} />
                    ) : !isMine ? (
                      <div className="w-8 shrink-0" />
                    ) : null}

                    <div className={cn('flex flex-col max-w-[65%]', isMine && 'items-end')}>
                      {showHeader && (
                        <div className={cn('flex items-baseline gap-2 mb-0.5 px-1', isMine && 'flex-row-reverse')}>
                          <span className="text-xs font-semibold">{isMine ? 'You' : msg.user?.name}</span>
                          <span className="text-xs text-muted-foreground">{formatTime(msg.createdAt)}</span>
                        </div>
                      )}

                      <div className="relative">
                        {/* Bubble */}
                        {callAttach ? (
                          <div className={cn('rounded-2xl px-4 py-3 flex items-center gap-3 border',
                            isMine ? 'bg-primary/10 border-primary/20' : 'bg-muted border-border')}>
                            {callAttach.callType === 'video' ? <Video className="h-5 w-5 text-primary" /> : <Phone className="h-5 w-5 text-primary" />}
                            <div>
                              <p className="text-sm font-medium">{msg.body}</p>
                              <p className="text-xs text-muted-foreground">{new Date(msg.createdAt).toLocaleString()}</p>
                            </div>
                          </div>
                        ) : (
                          <div className={cn('rounded-2xl px-3 py-2 text-sm leading-relaxed',
                            isMine ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted rounded-tl-sm')}>
                            {editingId === msg.id ? (
                              <div className="flex gap-2 items-center">
                                <input value={editBody} onChange={e => setEditBody(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') editMsg.mutate({ id: msg.id, body: editBody }); if (e.key === 'Escape') setEditingId(null) }}
                                  className="bg-transparent outline-none border-b border-current text-sm flex-1 min-w-[120px]"
                                  autoFocus />
                                <button onClick={() => editMsg.mutate({ id: msg.id, body: editBody })} className="opacity-70 hover:opacity-100"><Check className="h-4 w-4" /></button>
                                <button onClick={() => setEditingId(null)} className="opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                            )}
                            {msg.editedAt && <span className="text-xs opacity-50 ml-1">(edited)</span>}
                          </div>
                        )}

                        {/* Attachments */}
                        {msg.attachments?.filter((a: any) => a.type !== 'call').map((att: any, ai: number) => (
                          <div key={ai} className={cn('mt-1 rounded-xl overflow-hidden border', isMine ? 'ml-auto' : '')}>
                            {att.type?.startsWith('image') ? (
                              <img src={att.url} alt={att.name} className="max-w-xs max-h-48 object-cover" />
                            ) : att.type?.startsWith('video') ? (
                              <video src={att.url} controls className="max-w-xs max-h-40" />
                            ) : att.type?.startsWith('audio') ? (
                              <audio src={att.url} controls className="w-48" />
                            ) : (
                              <a href={att.url} download={att.name}
                                className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 text-sm">
                                <AttachIcon type={att.type ?? ''} />
                                <span className="truncate max-w-[140px]">{att.name}</span>
                                <Download className="h-3.5 w-3.5 ml-auto shrink-0" />
                              </a>
                            )}
                          </div>
                        ))}

                        {/* Reactions */}
                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div className={cn('flex flex-wrap gap-1 mt-1', isMine && 'justify-end')}>
                            {Object.entries(msg.reactions as Record<string, string[]>).map(([emoji, users]) => (
                              <button key={emoji} onClick={() => reactMsg.mutate({ id: msg.id, emoji })}
                                className={cn('flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors',
                                  (users as string[]).includes(userId) ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted')}>
                                {emoji} {(users as string[]).length}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Hover actions */}
                        <div className={cn('absolute -top-8 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 rounded-lg border bg-background shadow-sm p-0.5 transition-opacity',
                          isMine ? 'right-0' : 'left-0')}>
                          <button onClick={() => setEmojiTarget(emojiTarget === msg.id ? null : msg.id)}
                            className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground"><Smile className="h-3.5 w-3.5" /></button>
                          {isMine && !isDeleted && (
                            <button onClick={() => { setEditingId(msg.id); setEditBody(msg.body) }}
                              className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 className="h-3.5 w-3.5" /></button>
                          )}
                          {isMine && (
                            <button onClick={() => { if (confirm('Delete?')) deleteMsg.mutate(msg.id) }}
                              className="rounded p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                          )}
                        </div>

                        {/* Emoji picker */}
                        {emojiTarget === msg.id && (
                          <div className={cn('absolute -top-14 z-10 flex gap-1 rounded-xl border bg-background shadow-lg p-2',
                            isMine ? 'right-0' : 'left-0')}>
                            {EMOJI_LIST.map(e => (
                              <button key={e} onClick={() => reactMsg.mutate({ id: msg.id, emoji: e })}
                                className="rounded p-1 text-lg hover:bg-muted transition-colors">{e}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Task detected banner */}
            {detectedTask && <TaskBanner task={detectedTask} onDismiss={() => setDetectedTask(null)} />}

            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="px-4 py-2 border-t flex flex-wrap gap-2">
                {attachments.map((a, i) => (
                  <div key={i} className="relative flex items-center gap-2 rounded-lg border bg-muted px-3 py-2 text-xs">
                    <AttachIcon type={a.type} />
                    <span className="max-w-[100px] truncate">{a.name}</span>
                    <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                      className="ml-1 text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Input area */}
            <div className="border-t p-3">
              <div className="flex items-end gap-2 rounded-xl border bg-muted/30 px-3 py-2">
                <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFile}
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" />
                <button onClick={() => fileRef.current?.click()}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted" title="Attach file">
                  <Paperclip className="h-4 w-4" />
                </button>
                <textarea ref={textareaRef} value={message} onChange={e => setMessage(e.target.value)} onKeyDown={handleKeyDown}
                  placeholder={`Message ${activeChannel.type === 'DM' ? getChannelLabel(activeChannel) : '#' + activeChannel.name}…`}
                  rows={1} style={{ resize: 'none' }}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground max-h-32 overflow-y-auto"
                  onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }} />
                <button onClick={() => setEmojiTarget(emojiTarget === 'input' ? null : 'input')}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted" title="Emoji">
                  <Smile className="h-4 w-4" />
                </button>
                <button onClick={handleSend} disabled={!message.trim() && attachments.length === 0}
                  className="shrink-0 rounded-lg bg-primary p-2 text-white hover:bg-primary/90 disabled:opacity-40 transition-colors">
                  <Send className="h-4 w-4" />
                </button>
              </div>

              {/* Inline emoji picker for input */}
              {emojiTarget === 'input' && (
                <div className="mt-2 flex gap-1 flex-wrap">
                  {EMOJI_LIST.map(e => (
                    <button key={e} onClick={() => { setMessage(m => m + e); setEmojiTarget(null) }}
                      className="rounded p-1 text-xl hover:bg-muted">{e}</button>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground px-1">Enter to send · Shift+Enter for new line · Dates/tasks auto-detected</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Welcome to Chat</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Select a channel or DM to start messaging. Dates and tasks in messages are auto-detected.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowNewDM(true)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90">
                <MessageSquare className="h-4 w-4" /> New DM
              </button>
              <button onClick={() => setShowNewGroup(true)} className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-muted">
                <Users className="h-4 w-4" /> New Group
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Channel Modal */}
      {showNewChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border bg-background p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">New Channel</h2>
              <button onClick={() => setShowNewChannel(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <input value={newChannelName} onChange={e => setNewChannelName(e.target.value)} placeholder="channel-name"
              className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary mb-4" />
            <button onClick={() => { createChannel.mutate({ name: newChannelName, type: 'CHANNEL' }); setShowNewChannel(false); setNewChannelName('') }}
              disabled={!newChannelName.trim()}
              className="w-full rounded-lg bg-primary py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50">
              Create Channel
            </button>
          </div>
        </div>
      )}

      {showNewDM && (
        <NewDMModal users={orgUsers.filter((u: any) => u.id !== userId)} onClose={() => setShowNewDM(false)}
          onCreate={dmUserId => createChannel.mutate({ type: 'DM', dmUserId })} />
      )}

      {showNewGroup && (
        <NewGroupModal users={orgUsers} currentUserId={userId} onClose={() => setShowNewGroup(false)}
          onCreate={data => createChannel.mutate(data)} />
      )}
    </>
  )
}

// ── Channel list item ─────────────────────────────────────
function ChannelItem({ channel, active, label, onClick, icon }: { channel: any; active: boolean; label: string; onClick: () => void; icon: React.ReactNode }) {
  const lastMsg = channel.messages?.[0]
  return (
    <button onClick={onClick}
      className={cn('w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors',
        active ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground hover:text-foreground')}>
      <div className="shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        {lastMsg && <p className="text-xs truncate opacity-60">{lastMsg.user?.name}: {lastMsg.body}</p>}
      </div>
    </button>
  )
}
