import type { FastifyInstance } from 'fastify'
import { syncOrders, syncInventory, getStatus, validateCredentials } from '../services/walmart.service'
import { prisma } from '../lib/db'

export async function walmartRoutes(app: FastifyInstance) {
  // GET /walmart/status
  app.get('/status', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const status = await getStatus(req.user.orgId)
    return reply.send({ success: true, data: status ?? { status: 'DISCONNECTED' } })
  })

  // POST /walmart/validate — test credentials before saving
  app.post('/validate', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { clientId, clientSecret } = req.body as { clientId: string; clientSecret: string }
    if (!clientId || !clientSecret) {
      return reply.code(400).send({ success: false, message: 'clientId and clientSecret are required' })
    }
    const valid = await validateCredentials(clientId, clientSecret)
    if (!valid) {
      return reply.code(400).send({ success: false, message: 'Invalid Walmart credentials — check your Client ID and Secret' })
    }
    return reply.send({ success: true, message: 'Credentials valid' })
  })

  // POST /walmart/sync — sync orders + inventory
  app.post('/sync', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    try {
      const [orders, inventory] = await Promise.all([
        syncOrders(req.user.orgId),
        syncInventory(req.user.orgId),
      ])
      return reply.send({ success: true, data: { orders, inventory } })
    } catch (err: any) {
      app.log.error(err)
      return reply.code(500).send({ success: false, message: err.message })
    }
  })

  // DELETE /walmart/disconnect
  app.delete('/disconnect', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    await prisma.channelConfig.updateMany({
      where: { orgId: req.user.orgId, channel: 'WALMART' },
      data: { status: 'DISCONNECTED', credentials: {} },
    })
    return reply.send({ success: true, message: 'Walmart disconnected' })
  })
  // GET /walmart/diagnose — check raw Walmart API response without saving anything
  app.get('/diagnose', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const c = await prisma.channelConfig.findFirst({
      where: { orgId: req.user.orgId, channel: 'WALMART', status: 'CONNECTED' },
    })
    if (!c) return reply.code(400).send({ success: false, message: 'Walmart not connected' })
    const creds = c.credentials as any

    const axios = (await import('axios')).default
    const { randomUUID } = await import('crypto')

    const credentials = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64')
    const tokenRes = await axios.post(
      'https://marketplace.walmartapis.com/v3/token',
      new URLSearchParams({ grant_type: 'client_credentials' }),
      { headers: { Authorization: `Basic ${credentials}`, 'WM_SVC.NAME': 'SVA Platform', 'WM_QOS.CORRELATION_ID': randomUUID(), 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, timeout: 10000 }
    )
    const token = tokenRes.data.access_token
    const createdStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const ordersRes = await axios.get('https://marketplace.walmartapis.com/v3/orders', {
      headers: { 'WM_SEC.ACCESS_TOKEN': token, 'WM_SVC.NAME': 'SVA Platform', 'WM_QOS.CORRELATION_ID': randomUUID(), 'WM_CONSUMER.CHANNEL.TYPE': '0f3e4dd4-0514-4346-b39d-af0e00ea066d', Accept: 'application/json' },
      params: { createdStartDate, limit: 200 },
      timeout: 20000,
    })

    const raw = ordersRes.data
    const meta = raw?.list?.meta ?? {}
    const orders = raw?.list?.elements?.order ?? []
    const dbCount = await prisma.order.count({ where: { orgId: req.user.orgId, channel: 'WALMART' } })

    return reply.send({
      success: true,
      data: {
        walmartMeta:      meta,
        walmartPageCount: orders.length,
        hasNextCursor:    !!meta.nextCursor,
        nextCursorValue:  meta.nextCursor ?? null,
        totalCountField:  meta.totalCount ?? null,
        createdStartDate,
        firstOrderDate: orders[0]?.orderDate ?? null,
        lastOrderDate:  orders[orders.length - 1]?.orderDate ?? null,
        dbOrderCount:   dbCount,
      },
    })
  })

  // GET /walmart/raw-order — see actual Walmart API charge structure
  app.get('/raw-order', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const c = await prisma.channelConfig.findFirst({
      where: { orgId: req.user.orgId, channel: 'WALMART', status: 'CONNECTED' },
    })
    if (!c) return reply.code(400).send({ success: false })
    const creds = c.credentials as any

    const axios = (await import('axios')).default
    const { randomUUID } = await import('crypto')
    const credentials = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64')
    const tokenRes = await axios.post(
      'https://marketplace.walmartapis.com/v3/token',
      new URLSearchParams({ grant_type: 'client_credentials' }),
      { headers: { Authorization: `Basic ${credentials}`, 'WM_SVC.NAME': 'SVA', 'WM_QOS.CORRELATION_ID': randomUUID(), 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, timeout: 10000 }
    )
    const token = tokenRes.data.access_token
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // Fetch with ALL order statuses
    const res = await axios.get('https://marketplace.walmartapis.com/v3/orders', {
      headers: { 'WM_SEC.ACCESS_TOKEN': token, 'WM_SVC.NAME': 'SVA', 'WM_QOS.CORRELATION_ID': randomUUID(), 'WM_CONSUMER.CHANNEL.TYPE': '0f3e4dd4-0514-4346-b39d-af0e00ea066d', Accept: 'application/json' },
      params: { createdStartDate: since, limit: 5 },
      timeout: 20000,
    })

    const orders = res.data?.list?.elements?.order ?? []
    const meta   = res.data?.list?.meta ?? {}
    const sample = orders[0]
    const lines  = sample?.orderLines?.orderLine ?? []
    const sampleLine = lines[0]

    return reply.send({
      success: true,
      data: {
        meta,
        sampleOrder: {
          purchaseOrderId: sample?.purchaseOrderId,
          orderDate: sample?.orderDate,
          orderLines: lines.length,
          linesSample: lines.slice(0, 3).map((l: any) => ({
            lineNumber:  l.lineNumber,
            sku:         l.item?.sku,
            productName: l.item?.productName,
            quantity:    l.orderLineQuantity,
            status:      l.orderLineStatuses?.orderLineStatus?.[0]?.status,
            charges:     l.charges,
            // Show raw charge structure
            rawChargeArray: l.charges?.charge,
          })),
        },
      },
    })
  })

}