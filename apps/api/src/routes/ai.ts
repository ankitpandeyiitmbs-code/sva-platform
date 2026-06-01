import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/db'
import { env } from '../utils/env'

export async function aiRoutes(app: FastifyInstance) {
  // POST /ai/ask — plain English queries across all business data
  app.post('/ask', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { question, history = [] } = req.body as { question: string; history?: { role: 'user' | 'assistant'; content: string }[] }
    const orgId = req.user.orgId

    if (!env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY === '') {
      return reply.send({ success: true, data: { answer: 'AI features require an Anthropic API key. Please set ANTHROPIC_API_KEY in your environment variables.' } })
    }

    // ── Build rich business context ───────────────────────
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

    const [
      orderStats30d,
      orderStats90d,
      revenueByChannel,
      topSkus,
      customerStats,
      lowStock,
      inventoryCount,
      recentOrders,
    ] = await Promise.all([
      // Revenue & orders last 30d
      prisma.order.aggregate({
        where: { orgId, orderedAt: { gte: thirtyDaysAgo }, status: { notIn: ['CANCELLED'] } },
        _sum: { total: true },
        _count: { id: true },
      }),
      // Revenue & orders last 90d
      prisma.order.aggregate({
        where: { orgId, orderedAt: { gte: ninetyDaysAgo }, status: { notIn: ['CANCELLED'] } },
        _sum: { total: true },
        _count: { id: true },
      }),
      // Revenue by channel (30d)
      prisma.order.groupBy({
        by: ['channel'],
        where: { orgId, orderedAt: { gte: thirtyDaysAgo }, status: { notIn: ['CANCELLED'] } },
        _sum: { total: true },
        _count: { id: true },
        orderBy: { _sum: { total: 'desc' } },
      }),
      // Top 10 SKUs by revenue (90d)
      prisma.orderItem.groupBy({
        by: ['sku', 'name'],
        where: { order: { orgId, orderedAt: { gte: ninetyDaysAgo }, status: { notIn: ['CANCELLED'] } } },
        _sum: { total: true, quantity: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 10,
      }),
      // Customer stats
      prisma.customer.aggregate({
        where: { orgId },
        _count: { id: true },
        _avg: { ltv: true },
      }),
      // Low stock items
      prisma.inventoryItem.findMany({
        where: { orgId, quantity: { lte: 20 } },
        include: { product: { select: { sku: true, name: true } } },
        orderBy: { quantity: 'asc' },
        take: 10,
      }),
      // Total active inventory
      prisma.inventoryItem.aggregate({ where: { orgId }, _count: { id: true }, _sum: { quantity: true } }),
      // Last 5 orders
      prisma.order.findMany({
        where: { orgId },
        orderBy: { orderedAt: 'desc' },
        take: 5,
        select: { orderNumber: true, channel: true, total: true, status: true, orderedAt: true },
      }),
    ])

    const CHANNEL_LABELS: Record<string, string> = {
      AMAZON_US: 'Amazon US', AMAZON_IN: 'Amazon India', AMAZON_UK: 'Amazon UK',
      AMAZON_AE: 'Amazon UAE', AMAZON_AU: 'Amazon AU',
      WALMART: 'Walmart', TIKTOK_SHOP: 'TikTok Shop',
    }

    const context = `
BUSINESS: SVA Organics — Premium Organic Oils & Wellness Products (Essential Oils, Carrier Oils, Roll-On Hair Oils)
DATE: ${new Date().toDateString()}

=== SALES PERFORMANCE ===
Last 30 days:  ${orderStats30d._count.id} orders | $${Number(orderStats30d._sum.total ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} revenue
Last 90 days:  ${orderStats90d._count.id} orders | $${Number(orderStats90d._sum.total ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} revenue

=== REVENUE BY CHANNEL (30d) ===
${revenueByChannel.map(c => `- ${CHANNEL_LABELS[c.channel] ?? c.channel}: $${Number(c._sum.total ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} (${c._count.id} orders)`).join('\n') || 'No channel data yet'}

=== TOP PRODUCTS (90d by revenue) ===
${topSkus.map((s, i) => `${i + 1}. ${s.name} [${s.sku}]: $${Number(s._sum.total ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} | ${s._sum.quantity ?? 0} units`).join('\n') || 'No sales data yet'}

=== INVENTORY ===
Total SKUs tracked: ${inventoryCount._count.id}
Total units on hand: ${formatQty(inventoryCount._sum.quantity)}
Low stock alerts (≤20 units): ${lowStock.length}
${lowStock.map(i => `- ${i.product.name} [${i.product.sku}]: ${i.quantity} units`).join('\n')}

=== CUSTOMERS ===
Total customers: ${customerStats._count.id}
Average LTV: $${Number(customerStats._avg.ltv ?? 0).toFixed(2)}

=== RECENT ORDERS ===
${recentOrders.map(o => `- ${o.orderNumber} | ${CHANNEL_LABELS[o.channel] ?? o.channel} | $${Number(o.total).toFixed(2)} | ${o.status} | ${new Date(o.orderedAt).toDateString()}`).join('\n')}
`.trim()

    // Build messages array — include conversation history for multi-turn
    const messages: any[] = [
      ...history.slice(-10), // keep last 10 turns for context window
      { role: 'user', content: question },
    ]

    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk')
      const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
      const response = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 2048,
        system: `You are SVA AI — an expert business analyst and advisor for SVA Organics, a premium organic oils and wellness brand.

You have access to real-time business data shown below. Use it to give precise, data-driven answers.

${context}

Guidelines:
- Be concise but complete. Use bullet points and numbers.
- When quoting financials, use exact figures from the data.
- If asked to compare periods, calculate percentage changes.
- For inventory questions, flag any urgent low-stock items.
- Give actionable recommendations, not just observations.
- If data is insufficient to answer accurately, say so clearly.`,
        messages,
      })
      const answer = response.content[0].type === 'text' ? response.content[0].text : 'Unable to generate response'
      return reply.send({ success: true, data: { answer } })
    } catch (err: any) {
      app.log.error('AI ask error:', err)
      return reply.code(500).send({ success: false, message: 'AI service error: ' + err.message })
    }
  })

  // POST /ai/insights — auto-generated executive summary
  app.post('/insights', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const orgId = req.user.orgId

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)

    const [current30d, prev30d, lowStock] = await Promise.all([
      prisma.order.aggregate({
        where: { orgId, orderedAt: { gte: thirtyDaysAgo }, status: { notIn: ['CANCELLED'] } },
        _sum: { total: true }, _count: { id: true },
      }),
      prisma.order.aggregate({
        where: { orgId, orderedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }, status: { notIn: ['CANCELLED'] } },
        _sum: { total: true }, _count: { id: true },
      }),
      prisma.inventoryItem.count({ where: { orgId, quantity: { lte: 10 } } }),
    ])

    const rev30 = Number(current30d._sum.total ?? 0)
    const revPrev = Number(prev30d._sum.total ?? 0)
    const revChange = revPrev > 0 ? ((rev30 - revPrev) / revPrev) * 100 : 0
    const ordChange = prev30d._count.id > 0 ? ((current30d._count.id - prev30d._count.id) / prev30d._count.id) * 100 : 0

    const insights = []

    if (rev30 > 0) {
      insights.push({
        type: revChange >= 0 ? 'success' : 'warning',
        message: `Revenue ${revChange >= 0 ? 'up' : 'down'} ${Math.abs(revChange).toFixed(1)}% vs prior 30 days — $${rev30.toLocaleString('en-US', { minimumFractionDigits: 0 })} this period`,
      })
    }
    if (current30d._count.id > 0) {
      insights.push({
        type: ordChange >= 0 ? 'info' : 'warning',
        message: `${current30d._count.id} orders placed in the last 30 days (${ordChange >= 0 ? '+' : ''}${ordChange.toFixed(0)}% vs prior period)`,
      })
    }
    if (lowStock > 0) {
      insights.push({ type: 'warning', message: `${lowStock} SKU${lowStock > 1 ? 's' : ''} critically low stock (≤10 units) — check Inventory Intelligence` })
    }
    if (insights.length === 0) {
      insights.push({ type: 'info', message: 'No orders yet — connect your Amazon or Walmart account and sync to see insights.' })
    }

    return reply.send({ success: true, data: { insights } })
  })
}

function formatQty(q: any) {
  const n = Number(q ?? 0)
  return n.toLocaleString('en-US')
}
