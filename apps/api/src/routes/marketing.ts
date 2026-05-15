import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/db'

export async function marketingRoutes(app: FastifyInstance) {
  // ── Campaigns CRUD ────────────────────────────────────
  app.get('/campaigns', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { status, type, page = '1', limit = '50' } = req.query as any
    const where: any = { orgId: req.user.orgId }
    if (status) where.status = status
    if (type) where.type = type
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.campaign.count({ where }),
    ])
    return reply.send({ success: true, data: campaigns, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) })
  })

  app.get('/campaigns/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const campaign = await prisma.campaign.findFirst({ where: { id, orgId: req.user.orgId } })
    if (!campaign) return reply.code(404).send({ success: false })
    return reply.send({ success: true, data: campaign })
  })

  app.post('/campaigns', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const campaign = await prisma.campaign.create({
      data: { ...(req.body as any), orgId: req.user.orgId, status: 'DRAFT' },
    })
    return reply.code(201).send({ success: true, data: campaign })
  })

  app.patch('/campaigns/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const campaign = await prisma.campaign.update({ where: { id }, data: req.body as any })
    return reply.send({ success: true, data: campaign })
  })

  app.delete('/campaigns/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    await prisma.campaign.delete({ where: { id } })
    return reply.send({ success: true })
  })

  // ── Send / Schedule campaign ──────────────────────────
  app.post('/campaigns/:id/send', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const { scheduledAt } = req.body as any

    const campaign = await prisma.campaign.findFirst({ where: { id, orgId: req.user.orgId } })
    if (!campaign) return reply.code(404).send({ success: false })

    if (scheduledAt) {
      // Schedule for later
      await prisma.campaign.update({ where: { id }, data: { status: 'SCHEDULED', scheduledAt: new Date(scheduledAt) } })
      return reply.send({ success: true, data: { status: 'SCHEDULED', scheduledAt } })
    }

    // Simulate send now: update status and mock stats
    const targetCount = await prisma.customer.count({ where: { orgId: req.user.orgId, isActive: true } })
    await prisma.campaign.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        stats: { sent: targetCount, delivered: Math.floor(targetCount * 0.97), opens: 0, clicks: 0, bounces: Math.floor(targetCount * 0.03) },
      },
    })

    return reply.send({ success: true, data: { status: 'SENT', sent: targetCount } })
  })

  // ── Duplicate campaign ────────────────────────────────
  app.post('/campaigns/:id/duplicate', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const original = await prisma.campaign.findFirst({ where: { id, orgId: req.user.orgId } })
    if (!original) return reply.code(404).send({ success: false })
    const { id: _id, createdAt, updatedAt, sentAt, scheduledAt, stats, ...rest } = original
    const copy = await prisma.campaign.create({
      data: { ...rest, name: `${rest.name} (Copy)`, status: 'DRAFT', stats: {}, content: rest.content ?? undefined },
    })
    return reply.code(201).send({ success: true, data: copy })
  })

  // ── Email logs (deliverability) ───────────────────────
  app.get('/email-logs', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { campaignId, limit = '50' } = req.query as any
    const where: any = { orgId: req.user.orgId }
    if (campaignId) where.campaignId = campaignId
    const logs = await prisma.emailLog.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      take: parseInt(limit),
      include: { customer: { select: { firstName: true, lastName: true, email: true } } },
    })
    return reply.send({ success: true, data: logs })
  })

  // ── Campaign analytics summary ────────────────────────
  app.get('/analytics', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })

    const [totalCampaigns, sentCampaigns, scheduledCampaigns] = await Promise.all([
      prisma.campaign.count({ where: { orgId: req.user.orgId } }),
      prisma.campaign.findMany({ where: { orgId: req.user.orgId, status: 'SENT' }, select: { stats: true } }),
      prisma.campaign.count({ where: { orgId: req.user.orgId, status: 'SCHEDULED' } }),
    ])

    const totals = sentCampaigns.reduce(
      (acc, c) => {
        const s = c.stats as any
        return {
          sent: acc.sent + (s?.sent ?? 0),
          delivered: acc.delivered + (s?.delivered ?? 0),
          opens: acc.opens + (s?.opens ?? 0),
          clicks: acc.clicks + (s?.clicks ?? 0),
        }
      },
      { sent: 0, delivered: 0, opens: 0, clicks: 0 }
    )

    const openRate = totals.delivered > 0 ? (totals.opens / totals.delivered) * 100 : 0
    const clickRate = totals.delivered > 0 ? (totals.clicks / totals.delivered) * 100 : 0

    return reply.send({
      success: true,
      data: {
        totalCampaigns,
        sentCampaigns: sentCampaigns.length,
        scheduledCampaigns,
        totalSent: totals.sent,
        totalDelivered: totals.delivered,
        totalOpens: totals.opens,
        totalClicks: totals.clicks,
        openRate: Math.round(openRate * 10) / 10,
        clickRate: Math.round(clickRate * 10) / 10,
      },
    })
  })

  // ── Automation flows ──────────────────────────────────
  app.get('/flows', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const flows = await prisma.automation.findMany({
      where: { orgId: req.user.orgId },
      include: { _count: { select: { runs: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ success: true, data: flows })
  })

  app.post('/flows', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const body = req.body as any
    // Map triggerType/steps to schema fields
    const { triggerType, steps, ...rest } = body
    const flow = await prisma.automation.create({
      data: {
        ...rest,
        trigger: triggerType ? { type: triggerType } : (rest.trigger ?? {}),
        actions: steps ?? rest.actions ?? [],
        orgId: req.user.orgId,
      },
    })
    return reply.code(201).send({ success: true, data: flow })
  })

  app.patch('/flows/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const flow = await prisma.automation.update({ where: { id }, data: req.body as any })
    return reply.send({ success: true, data: flow })
  })

  app.delete('/flows/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    await prisma.automation.delete({ where: { id } })
    return reply.send({ success: true })
  })
}
