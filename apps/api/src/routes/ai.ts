import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/db'
import { env } from '../utils/env'

export async function aiRoutes(app: FastifyInstance) {
  // POST /ai/ask — plain English queries across data
  app.post('/ask', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { question } = req.body as { question: string }

    if (!env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY === '') {
      return reply.send({ success: true, data: { answer: 'AI features require an Anthropic API key. Set ANTHROPIC_API_KEY in your .env file.' } })
    }

    // Fetch context data for the AI
    const [recentOrders, topProducts, lowStock] = await Promise.all([
      prisma.order.aggregate({ where: { orgId: req.user.orgId }, _sum: { total: true }, _count: { id: true } }),
      prisma.orderItem.groupBy({ by: ['sku', 'name'], where: { order: { orgId: req.user.orgId } }, _sum: { quantity: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 5 }),
      prisma.inventoryItem.count({ where: { orgId: req.user.orgId, quantity: { lte: 10 } } }),
    ])

    const context = `
Business: SVA Organics (Essential Oils, Carrier Oils, Roll On Hair Oils)
Total Orders: ${recentOrders._count.id}
Total Revenue: $${Number(recentOrders._sum.total ?? 0).toFixed(2)}
Low Stock Items: ${lowStock}
Top Products: ${topProducts.map((p) => `${p.name} (${p._sum.quantity} sold)`).join(', ')}
    `.trim()

    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk')
      const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `You are an AI business assistant for SVA Organics. Here is current business context:\n\n${context}\n\nQuestion: ${question}\n\nProvide a concise, actionable answer.`,
          },
        ],
      })
      const answer = message.content[0].type === 'text' ? message.content[0].text : 'Unable to generate response'
      return reply.send({ success: true, data: { answer } })
    } catch (err: any) {
      return reply.code(500).send({ success: false, message: 'AI service error: ' + err.message })
    }
  })

  // POST /ai/insights — auto-generated dashboard insights
  app.post('/insights', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    return reply.send({
      success: true,
      data: {
        insights: [
          { type: 'info', message: 'Connect your Anthropic API key to enable AI-powered insights.' },
        ],
      },
    })
  })
}
