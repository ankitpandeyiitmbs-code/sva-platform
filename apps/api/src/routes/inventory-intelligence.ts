import type { FastifyInstance } from 'fastify'
import {
  generateRecommendations,
  classifyABC,
  autoUpdateReorderPoints,
  getOverstockAnalysis,
  getExpiryRiskProducts,
  getLongTermStorageRisk,
  getUpcomingEventsForOrg,
  forecastDemand,
} from '../services/inventory-intelligence.service'

export async function inventoryIntelligenceRoutes(app: FastifyInstance) {
  // GET /inventory/intelligence/recommendations
  // Full restock recommendations — sorted by urgency (CRITICAL first)
  app.get('/recommendations', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { channel } = req.query as { channel?: string }
    const result = await generateRecommendations(req.user.orgId, channel)
    return reply.send({ success: true, data: result })
  })

  // GET /inventory/intelligence/abc
  // ABC classification of all SKUs by revenue (last 90 days)
  app.get('/abc', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const data = await classifyABC(req.user.orgId)
    return reply.send({ success: true, data })
  })

  // GET /inventory/intelligence/overstock
  // Overstocked items with action recommendations
  app.get('/overstock', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const data = await getOverstockAnalysis(req.user.orgId)
    return reply.send({ success: true, data })
  })

  // POST /inventory/intelligence/auto-update
  // Recalculate and apply reorder points based on current sales velocity
  app.post('/auto-update', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { channel } = req.body as { channel?: string }
    const result = await autoUpdateReorderPoints(req.user.orgId, channel)
    return reply.send({ success: true, data: result })
  })

  // GET /inventory/intelligence/expiry — products at expiry risk
  app.get('/expiry', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const data = await getExpiryRiskProducts(req.user.orgId)
    return reply.send({ success: true, data })
  })

  // GET /inventory/intelligence/long-term-storage — FBA long-term storage risk
  app.get('/long-term-storage', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const data = await getLongTermStorageRisk(req.user.orgId)
    return reply.send({ success: true, data })
  })

  // GET /inventory/intelligence/events — upcoming seasonal/festive events
  app.get('/events', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const data = await getUpcomingEventsForOrg(req.user.orgId)
    return reply.send({ success: true, data })
  })

  // PATCH /inventory/intelligence/expiry/:sku — set expiry date on a product
  app.patch('/expiry/:sku', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { sku } = req.params as { sku: string }
    const { expiryDate } = req.body as { expiryDate: string }
    const product = await import('../lib/db').then(({ prisma }) =>
      prisma.product.findFirst({ where: { orgId: req.user!.orgId, sku } })
    )
    if (!product) return reply.code(404).send({ success: false })
    const { prisma } = await import('../lib/db')
    const updated = await prisma.product.update({
      where: { id: product.id },
      data: { customFields: { ...(product.customFields as any), expiryDate } },
    })
    return reply.send({ success: true, data: updated })
  })

  // GET /inventory/intelligence/forecast/:sku
  app.get('/forecast/:sku', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { sku } = req.params as { sku: string }
    const { days } = req.query as { days?: string }
    const data = await forecastDemand(req.user.orgId, sku, days ? parseInt(days) : 30)
    return reply.send({ success: true, data })
  })
}
