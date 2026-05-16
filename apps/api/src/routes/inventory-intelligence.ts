import type { FastifyInstance } from 'fastify'
import {
  generateRecommendations,
  classifyABC,
  autoUpdateReorderPoints,
  getOverstockAnalysis,
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

  // GET /inventory/intelligence/forecast/:sku
  // Demand forecast for a specific SKU
  app.get('/forecast/:sku', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { sku } = req.params as { sku: string }
    const { days } = req.query as { days?: string }
    const data = await forecastDemand(req.user.orgId, sku, days ? parseInt(days) : 30)
    return reply.send({ success: true, data })
  })
}
