import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/db'

// ── Smart task/date detector ─────────────────────────────
const TASK_PATTERNS = [
  { re: /\bby\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow)\b/i, rel: true },
  { re: /\bby\s+(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)\b/i, rel: false },
  { re: /\b(remind me|don't forget|don\'t forget|remember to|need to|have to|must)\b.{3,60}/i, rel: true },
  { re: /\bdeadline[:\s]+(.+)/i, rel: true },
  { re: /\bmeeting\s+(at|on)\s+.+/i, rel: true },
  { re: /\bcall\s+(at|on|tomorrow|today)\b.*/i, rel: true },
  { re: /\bdue\s+(on|by)?\s*(\w+)/i, rel: true },
]

function detectTasks(text: string): string[] {
  const found: string[] = []
  for (const p of TASK_PATTERNS) {
    if (p.re.test(text)) {
      const trimmed = text.length > 120 ? text.slice(0, 120) + '…' : text
      if (!found.includes(trimmed)) found.push(trimmed)
      break
    }
  }
  return found
}

function parseRelativeDate(text: string): Date | null {
  const lower = text.toLowerCase()
  const now = new Date()
  if (lower.includes('today')) { now.setHours(18, 0, 0, 0); return now }
  if (lower.includes('tomorrow')) { now.setDate(now.getDate() + 1); now.setHours(9, 0, 0, 0); return now }
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  for (let i = 0; i < days.length; i++) {
    if (lower.includes(days[i])) {
      const today = now.getDay()
      const diff = (i - today + 7) % 7 || 7
      now.setDate(now.getDate() + diff)
      now.setHours(9, 0, 0, 0)
      return now
    }
  }
  const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/)
  if (dateMatch) {
    const d = new Date(
      dateMatch[3] ? parseInt(dateMatch[3]) : now.getFullYear(),
      parseInt(dateMatch[1]) - 1,
      parseInt(dateMatch[2])
    )
    if (!isNaN(d.getTime())) return d
  }
  return null
}

export async function chatRoutes(app: FastifyInstance) {

  // ── List channels (DMs + groups + public) ─────────────
  app.get('/channels', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const userId = req.user.sub
    const channels = await prisma.chatChannel.findMany({
      where: {
        orgId: req.user.orgId,
        OR: [
          { isPrivate: false },
          { memberIds: { has: userId } },
        ],
      },
      include: {
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { user: { select: { name: true } } },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ success: true, data: channels })
  })

  // ── Create channel / group / DM ───────────────────────
  app.post('/channels', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const body = req.body as any
    const userId = req.user.sub

    // DM: check if already exists
    if (body.type === 'DM') {
      const otherUserId = body.dmUserId
      if (!otherUserId) return reply.code(400).send({ success: false, message: 'dmUserId required' })
      const existing = await prisma.chatChannel.findFirst({
        where: {
          orgId: req.user.orgId,
          type: 'DM',
          AND: [
            { memberIds: { has: userId } },
            { memberIds: { has: otherUserId } },
          ],
        },
      })
      if (existing) return reply.send({ success: true, data: existing })
      const otherUser = await prisma.user.findUnique({ where: { id: otherUserId }, select: { name: true } })
      const channel = await prisma.chatChannel.create({
        data: {
          orgId: req.user.orgId,
          name: otherUser?.name ?? 'Direct Message',
          slug: `dm-${userId}-${otherUserId}`,
          type: 'DM',
          isPrivate: true,
          memberIds: [userId, otherUserId],
          creatorId: userId,
        },
      })
      return reply.code(201).send({ success: true, data: channel })
    }

    // Group or Channel
    const memberIds: string[] = body.memberIds ?? []
    if (!memberIds.includes(userId)) memberIds.push(userId)
    const slug = (body.name as string).toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
    const channel = await prisma.chatChannel.create({
      data: {
        orgId: req.user.orgId,
        name: body.name,
        slug: `${slug}-${Date.now()}`,
        type: body.type ?? 'CHANNEL',
        description: body.description,
        isPrivate: body.isPrivate ?? (body.type === 'GROUP'),
        memberIds,
        creatorId: userId,
      },
    })
    return reply.code(201).send({ success: true, data: channel })
  })

  // ── Update channel ────────────────────────────────────
  app.patch('/channels/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const channel = await prisma.chatChannel.update({ where: { id }, data: req.body as any })
    return reply.send({ success: true, data: channel })
  })

  // ── Delete channel ────────────────────────────────────
  app.delete('/channels/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    await prisma.chatChannel.delete({ where: { id } })
    return reply.send({ success: true })
  })

  // ── Get messages ──────────────────────────────────────
  app.get('/channels/:id/messages', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const { before, limit = '60' } = req.query as any
    const where: any = { channelId: id, deletedAt: null }
    if (before) where.createdAt = { lt: new Date(before) }
    const messages = await prisma.chatMessage.findMany({
      where,
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
    })
    return reply.send({ success: true, data: messages.reverse() })
  })

  // ── Send message (with smart task detection) ──────────
  app.post('/channels/:id/messages', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const body = req.body as any
    const message = await prisma.chatMessage.create({
      data: { channelId: id, userId: req.user.sub, body: body.body, attachments: body.attachments ?? [], reactions: {} },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    })

    // Smart task detection
    let detectedTask: any = null
    const tasks = detectTasks(body.body ?? '')
    if (tasks.length > 0) {
      const dueDate = parseRelativeDate(body.body)
      const proj = await prisma.project.findFirst({ where: { orgId: req.user.orgId }, orderBy: { createdAt: 'asc' } })
      if (proj) {
        const task = await prisma.task.create({
          data: {
            projectId: proj.id,
            orgId: req.user.orgId,
            title: tasks[0].slice(0, 120),
            status: 'TODO',
            priority: 'MEDIUM',
            creatorId: req.user.sub,
            assigneeId: req.user.sub,
            dueDate: dueDate ?? undefined,
            description: `Auto-detected from chat message by ${req.user.email}`,
          },
        })
        detectedTask = { id: task.id, title: task.title, dueDate: task.dueDate }
      }
    }

    return reply.code(201).send({ success: true, data: message, detectedTask })
  })

  // ── Edit message ──────────────────────────────────────
  app.patch('/messages/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const { body } = req.body as any
    const message = await prisma.chatMessage.update({
      where: { id, userId: req.user.sub },
      data: { body, editedAt: new Date() },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    })
    return reply.send({ success: true, data: message })
  })

  // ── Delete message ────────────────────────────────────
  app.delete('/messages/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    await prisma.chatMessage.update({
      where: { id, userId: req.user.sub },
      data: { deletedAt: new Date(), body: 'This message was deleted' },
    })
    return reply.send({ success: true })
  })

  // ── React to message ──────────────────────────────────
  app.post('/messages/:id/react', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const { emoji } = req.body as any
    const userId = req.user.sub
    const msg = await prisma.chatMessage.findUnique({ where: { id } })
    if (!msg) return reply.code(404).send({ success: false })
    const reactions = (msg.reactions as Record<string, string[]>) ?? {}
    if (!reactions[emoji]) reactions[emoji] = []
    const idx = reactions[emoji].indexOf(userId)
    if (idx >= 0) reactions[emoji].splice(idx, 1)
    else reactions[emoji].push(userId)
    if (reactions[emoji].length === 0) delete reactions[emoji]
    const updated = await prisma.chatMessage.update({ where: { id }, data: { reactions } })
    return reply.send({ success: true, data: updated })
  })

  // ── Initiate / answer / end call ──────────────────────
  app.post('/channels/:id/call', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const { action, callType } = req.body as any // action: start|end, callType: video|audio
    const userId = req.user.sub
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })

    if (action === 'start') {
      await prisma.chatMessage.create({
        data: {
          channelId: id,
          userId,
          body: `📞 ${user?.name} started a ${callType === 'video' ? 'video' : 'voice'} call`,
          attachments: [{ type: 'call', callType, status: 'started', startedAt: new Date().toISOString() }],
          reactions: {},
        },
      })
      return reply.send({ success: true, data: { callType, status: 'started' } })
    }
    return reply.send({ success: true })
  })

  // ── Pin message ───────────────────────────────────────
  app.post('/messages/:id/pin', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const msg = await prisma.chatMessage.update({
      where: { id },
      data: { pinnedAt: new Date() },
    })
    return reply.send({ success: true, data: msg })
  })

  // ── Get members of a channel ──────────────────────────
  app.get('/channels/:id/members', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const channel = await prisma.chatChannel.findUnique({ where: { id } })
    if (!channel) return reply.code(404).send({ success: false })
    const members = await prisma.user.findMany({
      where: { id: { in: channel.memberIds }, orgId: req.user.orgId },
      select: { id: true, name: true, avatarUrl: true, role: true },
    })
    return reply.send({ success: true, data: members })
  })
}
