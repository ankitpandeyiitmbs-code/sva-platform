import type { FastifyInstance } from 'fastify'
import { prisma } from '@sva/db'

const DEFAULT_STAGES = [
  { id: 'lead', name: 'Lead', color: '#6B7280', position: 0 },
  { id: 'qualified', name: 'Qualified', color: '#3B82F6', position: 1 },
  { id: 'proposal', name: 'Proposal', color: '#8B5CF6', position: 2 },
  { id: 'negotiation', name: 'Negotiation', color: '#F59E0B', position: 3 },
  { id: 'closed_won', name: 'Closed Won', color: '#10B981', position: 4 },
  { id: 'closed_lost', name: 'Closed Lost', color: '#EF4444', position: 5 },
]

export async function crmRoutes(app: FastifyInstance) {
  // ── Deals / Pipeline ──────────────────────────────────
  app.get('/deals', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { stage, assignedTo, limit = '200' } = req.query as any
    const where: any = { orgId: req.user.orgId }
    if (stage) where.stage = stage
    if (assignedTo) where.assignedTo = assignedTo
    const deals = await prisma.deal.findMany({
      where,
      take: parseInt(limit),
      include: {
        customer: { select: { firstName: true, lastName: true, email: true, company: true } },
        assignee: { select: { name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ success: true, data: deals })
  })

  app.post('/deals', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const body = req.body as any

    // Resolve stageId → stage name if provided
    let stageName = body.stage
    if (body.stageId && !stageName) {
      const ps = await prisma.pipelineStage.findUnique({ where: { id: body.stageId } }).catch(() => null)
      stageName = ps?.name ?? DEFAULT_STAGES.find((s) => s.id === body.stageId)?.name ?? 'Lead'
    }
    if (!stageName) stageName = 'Lead'

    const { stageId, ...rest } = body
    const deal = await prisma.deal.create({
      data: { ...rest, stage: stageName, orgId: req.user.orgId },
      include: { customer: true, assignee: { select: { name: true, avatarUrl: true } } },
    })
    await prisma.activity.create({
      data: { orgId: req.user.orgId, type: 'DEAL_CREATED', title: `Deal created: ${deal.title}`, dealId: deal.id, customerId: deal.customerId ?? undefined },
    })
    return reply.code(201).send({ success: true, data: deal })
  })

  app.patch('/deals/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const body = req.body as any

    // Resolve stageId → stage name if provided
    let updateData = { ...body }
    if (body.stageId) {
      const ps = await prisma.pipelineStage.findUnique({ where: { id: body.stageId } }).catch(() => null)
      const stageName = ps?.name ?? DEFAULT_STAGES.find((s) => s.id === body.stageId)?.name
      if (stageName) updateData.stage = stageName
      delete updateData.stageId
    }

    const deal = await prisma.deal.update({
      where: { id },
      data: updateData,
      include: { customer: true, assignee: { select: { name: true, avatarUrl: true } } },
    })
    if (updateData.stage) {
      await prisma.activity.create({ data: { orgId: req.user.orgId, type: 'STAGE_CHANGED', title: `Deal moved to ${updateData.stage}`, dealId: id } })
    }
    return reply.send({ success: true, data: deal })
  })

  app.delete('/deals/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    await prisma.deal.delete({ where: { id } })
    return reply.send({ success: true })
  })

  // ── Pipeline stages config ────────────────────────────
  async function getStages(orgId: string) {
    const stages = await prisma.pipelineStage.findMany({ where: { orgId }, orderBy: { position: 'asc' } })
    return stages.length > 0 ? stages : DEFAULT_STAGES
  }

  app.get('/stages', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    return reply.send({ success: true, data: await getStages(req.user.orgId) })
  })

  app.get('/pipeline-stages', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    return reply.send({ success: true, data: await getStages(req.user.orgId) })
  })

  app.put('/pipeline-stages', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { stages } = req.body as { stages: any[] }
    await prisma.$transaction(
      stages.map((s) =>
        prisma.pipelineStage.upsert({
          where: { id: s.id ?? '__none__' },
          update: { name: s.name, color: s.color, position: s.position },
          create: { orgId: req.user!.orgId, name: s.name, color: s.color, position: s.position },
        })
      )
    )
    return reply.send({ success: true })
  })

  // ── Sales Forecasting ─────────────────────────────────
  app.get('/forecast', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const deals = await prisma.deal.findMany({
      where: { orgId: req.user.orgId, closedAt: null },
      select: { value: true, probability: true, stage: true, currency: true, expectedCloseDate: true },
    })

    const weighted = deals.reduce((sum, d) => sum + Number(d.value) * (d.probability / 100), 0)
    const totalPipeline = deals.reduce((sum, d) => sum + Number(d.value), 0)

    // By month
    const byMonthMap: Record<string, { pipeline: number; weighted: number; count: number }> = {}
    deals.forEach((d) => {
      if (d.expectedCloseDate) {
        const key = new Date(d.expectedCloseDate).toISOString().slice(0, 7)
        byMonthMap[key] = byMonthMap[key] ?? { pipeline: 0, weighted: 0, count: 0 }
        byMonthMap[key].pipeline += Number(d.value)
        byMonthMap[key].weighted += Number(d.value) * (d.probability / 100)
        byMonthMap[key].count++
      }
    })

    // By stage
    const byStageMap: Record<string, { value: number; count: number }> = {}
    deals.forEach((d) => {
      const s = d.stage ?? 'Unknown'
      byStageMap[s] = byStageMap[s] ?? { value: 0, count: 0 }
      byStageMap[s].value += Number(d.value)
      byStageMap[s].count++
    })

    return reply.send({
      success: true,
      data: {
        totalPipeline,
        weightedForecast: weighted,
        openDeals: deals.length,
        byMonth: Object.entries(byMonthMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, v]) => ({ month, ...v })),
        byStage: Object.entries(byStageMap).map(([stage, v]) => ({ stage, ...v })),
      },
    })
  })

  // ── Activities ────────────────────────────────────────
  app.get('/activities', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { customerId, limit = '20' } = req.query as any
    const where: any = { orgId: req.user.orgId }
    if (customerId) where.customerId = customerId
    const activities = await prisma.activity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
    })
    return reply.send({ success: true, data: activities })
  })

  app.post('/activities', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const activity = await prisma.activity.create({ data: { ...(req.body as any), orgId: req.user.orgId } })
    return reply.code(201).send({ success: true, data: activity })
  })

  // ── Segments ──────────────────────────────────────────
  app.get('/segments', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const segments = await prisma.customerSegment.findMany({
      where: { orgId: req.user.orgId },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ success: true, data: segments })
  })

  app.get('/segments/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const segment = await prisma.customerSegment.findFirst({
      where: { id, orgId: req.user.orgId },
      include: {
        _count: { select: { members: true } },
        members: {
          include: { customer: { select: { id: true, firstName: true, lastName: true, email: true, country: true, ltv: true, leadScore: true, loyaltyTier: true } } },
          take: 100,
          orderBy: { addedAt: 'desc' },
        },
      },
    })
    if (!segment) return reply.code(404).send({ success: false, message: 'Segment not found' })
    return reply.send({ success: true, data: segment })
  })

  app.post('/segments', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const body = req.body as any
    const segment = await prisma.customerSegment.create({
      data: {
        name: body.name,
        description: body.description,
        rules: body.conditions ?? body.rules ?? [],
        isDynamic: true,
        orgId: req.user.orgId,
      },
    })
    // Immediately evaluate membership
    await evaluateSegment(segment.id, req.user.orgId, body.conditions ?? body.rules ?? [])
    return reply.code(201).send({ success: true, data: segment })
  })

  app.delete('/segments/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    await prisma.customerSegment.delete({ where: { id } })
    return reply.send({ success: true })
  })

  app.post('/segments/:id/refresh', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const segment = await prisma.customerSegment.findFirst({ where: { id, orgId: req.user.orgId } })
    if (!segment) return reply.code(404).send({ success: false })
    const conditions = (segment.rules as any[]) ?? []
    const count = await evaluateSegment(id, req.user.orgId, conditions)
    return reply.send({ success: true, data: { count } })
  })

  // ── Lead scoring ──────────────────────────────────────
  app.post('/customers/:id/score', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const customer = await prisma.customer.findFirstOrThrow({ where: { id, orgId: req.user.orgId } })

    let score = 0
    if (customer.totalOrders >= 5) score += 30
    else if (customer.totalOrders >= 2) score += 15
    else if (customer.totalOrders >= 1) score += 10

    if (Number(customer.ltv) >= 1000) score += 30
    else if (Number(customer.ltv) >= 500) score += 20
    else if (Number(customer.ltv) >= 100) score += 10

    if (customer.email) score += 10
    if (customer.phone) score += 5
    if (customer.company) score += 5

    if (customer.lastOrderAt) {
      const days = (Date.now() - new Date(customer.lastOrderAt).getTime()) / 86400000
      if (days <= 30) score += 20
      else if (days <= 90) score += 10
      else if (days > 180) score -= 10
    }

    const updated = await prisma.customer.update({ where: { id }, data: { leadScore: Math.max(0, Math.min(100, score)) } })
    return reply.send({ success: true, data: { score: updated.leadScore } })
  })
}

// Evaluates segment conditions and upserts membership
async function evaluateSegment(segmentId: string, orgId: string, conditions: any[]): Promise<number> {
  if (!conditions.length) return 0

  const customers = await prisma.customer.findMany({ where: { orgId } })

  const matches = customers.filter((c) =>
    conditions.every((cond) => {
      const raw = (c as any)[cond.field]
      const actual = typeof raw === 'object' && raw !== null ? Number(raw) : raw
      const expected = cond.value

      switch (cond.operator) {
        case '>': return Number(actual) > Number(expected)
        case '<': return Number(actual) < Number(expected)
        case '>=': return Number(actual) >= Number(expected)
        case '<=': return Number(actual) <= Number(expected)
        case '=':
        case '==': return String(actual).toLowerCase() === String(expected).toLowerCase()
        case '!=': return String(actual).toLowerCase() !== String(expected).toLowerCase()
        default: return false
      }
    })
  )

  // Replace existing members
  await prisma.customerSegmentMember.deleteMany({ where: { segmentId } })
  if (matches.length > 0) {
    await prisma.customerSegmentMember.createMany({
      data: matches.map((c) => ({ segmentId, customerId: c.id })),
      skipDuplicates: true,
    })
  }
  await prisma.customerSegment.update({ where: { id: segmentId }, data: { memberCount: matches.length } })

  return matches.length
}
