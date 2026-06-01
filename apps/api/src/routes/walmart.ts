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

  // POST /walmart/sync — kicks off sync in background (fire-and-forget to avoid timeout)
  app.post('/sync', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const orgId = req.user.orgId

    // Respond immediately so the HTTP request doesn't time out
    reply.send({ success: true, message: 'Walmart sync started', data: { orders: { synced: 0 }, inventory: { synced: 0 } } })

    // Run sync in background
    ;(async () => {
      try {
        const [orders, inventory] = await Promise.all([
          syncOrders(orgId),
          syncInventory(orgId),
        ])
        app.log.info(`Walmart sync complete for ${orgId}: ${JSON.stringify({ orders, inventory })}`)
      } catch (err: any) {
        app.log.error(`Walmart sync failed for ${orgId}: ${err.message}`)
        await prisma.channelConfig.updateMany({
          where: { orgId, channel: 'WALMART' },
          data: { lastSyncStatus: 'FAILED' },
        })
      }
    })()
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

  // GET /walmart/deep-diagnose — test all orderStatuses combos
  app.get('/deep-diagnose', async (req, reply) => {
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
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const headers = {
      'WM_SEC.ACCESS_TOKEN': token, 'WM_SVC.NAME': 'SVA',
      'WM_QOS.CORRELATION_ID': randomUUID(),
      'WM_CONSUMER.CHANNEL.TYPE': '0f3e4dd4-0514-4346-b39d-af0e00ea066d',
      Accept: 'application/json',
    }

    // Test different status combos
    const tests = [
      { label: 'default (no status)', params: { createdStartDate: since30, limit: 1 } },
      { label: 'Acknowledged',        params: { createdStartDate: since30, limit: 1, orderStatuses: 'Acknowledged' } },
      { label: 'Shipped',             params: { createdStartDate: since30, limit: 1, orderStatuses: 'Shipped' } },
      { label: 'Created',             params: { createdStartDate: since30, limit: 1, orderStatuses: 'Created' } },
      { label: 'Delivered',           params: { createdStartDate: since30, limit: 1, orderStatuses: 'Delivered' } },
      { label: 'Cancelled',           params: { createdStartDate: since30, limit: 1, orderStatuses: 'Cancelled' } },
      { label: 'all combined',        params: { createdStartDate: since30, limit: 1, orderStatuses: 'Created,Acknowledged,Shipped,Delivered,Cancelled' } },
    ]

    const results: any[] = []
    for (const test of tests) {
      try {
        const r = await axios.get('https://marketplace.walmartapis.com/v3/orders', {
          headers: { ...headers, 'WM_QOS.CORRELATION_ID': randomUUID() },
          params: test.params,
          timeout: 15000,
        })
        results.push({
          label: test.label,
          totalCount: r.data?.list?.meta?.totalCount,
          nextCursor:  !!r.data?.list?.meta?.nextCursor,
          returned:    (r.data?.list?.elements?.order ?? []).length,
        })
      } catch (e: any) {
        results.push({ label: test.label, error: e.message })
      }
    }

    // Also check a sample order's full line structure
    const sampleRes = await axios.get('https://marketplace.walmartapis.com/v3/orders', {
      headers: { ...headers, 'WM_QOS.CORRELATION_ID': randomUUID() },
      params: { createdStartDate: since30, limit: 3 },
      timeout: 15000,
    })
    const sampleOrders = sampleRes.data?.list?.elements?.order ?? []
    const lineStructure = sampleOrders.map((o: any) => {
      const lines = o.orderLines?.orderLine
      const isArray = Array.isArray(lines)
      const lineArr = isArray ? lines : (lines ? [lines] : [])
      return {
        purchaseOrderId: o.purchaseOrderId,
        orderDate: o.orderDate,
        linesIsArray: isArray,
        lineCount: lineArr.length,
        lines: lineArr.map((l: any) => ({
          lineNumber: l.lineNumber,
          sku: l.item?.sku,
          qty: l.orderLineQuantity?.amount,
          chargeAmount: l.charges?.charge?.[0]?.chargeAmount?.amount,
          chargeType:   l.charges?.charge?.[0]?.chargeType,
          allCharges:   l.charges?.charge?.length,
        }))
      }
    })

    return reply.send({ success: true, data: { statusTests: results, lineStructure } })
  })

  // POST /walmart/resync — clear and re-sync from scratch (fixes corrupted order data)
  app.post('/resync', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const orgId = req.user.orgId

    reply.send({ success: true, message: 'Full resync started — clearing old orders and re-pulling from Walmart' })

    ;(async () => {
      try {
        // Delete existing Walmart orders in chunks to avoid connection pressure
        const walmartOrders = await prisma.order.findMany({
          where: { orgId, channel: 'WALMART' },
          select: { id: true },
        })
        const orderIds = walmartOrders.map(o => o.id)

        if (orderIds.length > 0) {
          // Delete in batches of 50
          const BATCH = 50
          for (let i = 0; i < orderIds.length; i += BATCH) {
            const batch = orderIds.slice(i, i + BATCH)
            await prisma.orderItem.deleteMany({ where: { orderId: { in: batch } } })
            await prisma.order.deleteMany({ where: { id: { in: batch } } })
          }
        }
        app.log.info(`Walmart resync: cleared ${orderIds.length} existing orders for org ${orgId}`)

        const orders = await syncOrders(orgId)
        app.log.info(`Walmart resync COMPLETE for ${orgId}: synced=${orders.synced} totalFromWalmart=${orders.totalFromWalmart}`)
      } catch (err: any) {
        app.log.error(`Walmart resync FAILED for ${orgId}: ${err.message}`)
        app.log.error(err.stack ?? err.message)
      }
    })()
  })

  // POST /walmart/sync-inventory — sync product inventory separately (slow, runs in background)
  app.post('/sync-inventory', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const orgId = req.user.orgId
    reply.send({ success: true, message: 'Inventory sync started' })
    ;(async () => {
      try {
        const result = await syncInventory(orgId)
        app.log.info(`Walmart inventory sync COMPLETE for ${orgId}: ${JSON.stringify(result)}`)
      } catch (err: any) {
        app.log.error(`Walmart inventory sync FAILED for ${orgId}: ${err.message}`)
      }
    })()
  })

  // GET /walmart/test-connectivity — test raw Walmart API reachability from Railway
  app.get('/test-connectivity', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const https = await import('https')
    const start = Date.now()
    
    const result = await new Promise<any>((resolve) => {
      let req_obj: any

      const timer = setTimeout(() => {
        if (req_obj) req_obj.destroy()
        resolve({ status: 'TIMEOUT', elapsed: Date.now() - start, message: 'No response after 8s — Walmart API unreachable from Railway IP' })
      }, 8000)

      req_obj = https.request({
        hostname: 'marketplace.walmartapis.com',
        port: 443,
        path: '/v3/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 8000,
      }, (res) => {
        clearTimeout(timer)
        resolve({ status: 'CONNECTED', httpStatus: res.statusCode, elapsed: Date.now() - start })
        res.resume()
      })
      
      req_obj.on('error', (err: Error) => {
        clearTimeout(timer)
        resolve({ status: 'ERROR', error: err.message, elapsed: Date.now() - start })
      })
      
      req_obj.on('timeout', () => {
        clearTimeout(timer)
        req_obj.destroy()
        resolve({ status: 'SOCKET_TIMEOUT', elapsed: Date.now() - start })
      })
      
      req_obj.write('grant_type=client_credentials')
      req_obj.end()
    })
    
    return reply.send({ success: true, data: result })
  })

  // GET /walmart/revenue-check — compare DB revenue vs what Walmart API shows for same orders
  app.get('/revenue-check', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const orgId = req.user.orgId

    // Sample 5 orders from DB and show their items + totals
    const orders = await prisma.order.findMany({
      where: { orgId, channel: 'WALMART' },
      include: { items: true },
      take: 5,
      orderBy: { orderedAt: 'desc' },
    })

    // Aggregate stats
    const allItems = await prisma.orderItem.findMany({
      where: { order: { orgId, channel: 'WALMART' } },
      select: { quantity: true, unitPrice: true, total: true },
    })

    const totalUnits   = allItems.reduce((s, i) => s + i.quantity, 0)
    const totalRevenue = allItems.reduce((s, i) => s + Number(i.total), 0)
    const avgUnitPrice = totalRevenue / Math.max(1, totalUnits)

    return reply.send({
      success: true,
      data: {
        orderCount:   orders.length,
        totalUnits,
        totalRevenue: totalRevenue.toFixed(2),
        avgUnitPrice: avgUnitPrice.toFixed(2),
        sampleOrders: orders.map(o => ({
          orderNumber: o.orderNumber,
          total:       Number(o.total).toFixed(2),
          itemCount:   o.items.length,
          items:       o.items.map(i => ({ sku: i.sku, qty: i.quantity, unitPrice: Number(i.unitPrice).toFixed(2), total: Number(i.total).toFixed(2) })),
        })),
      },
    })
  })

  // GET /walmart/wfs-inventory-check?sku=xxx — raw WFS inventory response for a SKU
  app.get('/wfs-inventory-check', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { sku } = req.query as any
    if (!sku) return reply.code(400).send({ success: false, message: 'sku required' })

    const c = await prisma.channelConfig.findFirst({
      where: { orgId: req.user.orgId, channel: 'WALMART', status: 'CONNECTED' },
    })
    if (!c) return reply.code(400).send({ success: false })
    const { clientId, clientSecret } = c.credentials as any

    const axios = (await import('axios')).default
    const { randomUUID } = await import('crypto')
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const tokenRes = await axios.post(
      'https://marketplace.walmartapis.com/v3/token',
      new URLSearchParams({ grant_type: 'client_credentials' }),
      { headers: { Authorization: `Basic ${credentials}`, 'WM_SVC.NAME': 'SVA', 'WM_QOS.CORRELATION_ID': randomUUID(), 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, timeout: 10000 }
    )
    const token = tokenRes.data.access_token
    const headers = {
      'WM_SEC.ACCESS_TOKEN': token, 'WM_SVC.NAME': 'SVA',
      'WM_QOS.CORRELATION_ID': randomUUID(),
      'WM_CONSUMER.CHANNEL.TYPE': '0f3e4dd4-0514-4346-b39d-af0e00ea066d',
      Accept: 'application/json',
    }

    // Try multiple possible WFS endpoints
    const results: any = {}

    // 1. Standard inventory
    try {
      const r = await axios.get('https://marketplace.walmartapis.com/v3/inventory', { headers: { ...headers, 'WM_QOS.CORRELATION_ID': randomUUID() }, params: { sku }, timeout: 15000 })
      results.v3_inventory = r.data
    } catch (e: any) { results.v3_inventory_error = e.response?.data ?? e.message }

    // 2. WFS fulfillment inventory
    try {
      const r = await axios.get('https://marketplace.walmartapis.com/v3/fulfillment/inventory', { headers: { ...headers, 'WM_QOS.CORRELATION_ID': randomUUID() }, params: { sku }, timeout: 15000 })
      results.v3_fulfillment_inventory = r.data
    } catch (e: any) { results.v3_fulfillment_inventory_error = e.response?.data ?? e.message }

    // 3. WFS inventory-details
    try {
      const r = await axios.get('https://marketplace.walmartapis.com/v3/fulfillment/inventory-details', { headers: { ...headers, 'WM_QOS.CORRELATION_ID': randomUUID() }, params: { sku }, timeout: 15000 })
      results.v3_fulfillment_inventory_details = r.data
    } catch (e: any) { results.v3_fulfillment_inventory_details_error = e.response?.data ?? e.message }

    // 4. WFS with skuList param
    try {
      const r = await axios.get('https://marketplace.walmartapis.com/v3/fulfillment/inventory', { headers: { ...headers, 'WM_QOS.CORRELATION_ID': randomUUID() }, params: { skuList: sku }, timeout: 15000 })
      results.v3_fulfillment_skuList = r.data
    } catch (e: any) { results.v3_fulfillment_skuList_error = e.response?.data ?? e.message }

    return reply.send({ success: true, data: { sku, results } })
  })

  // GET /walmart/wfs-orders-test — test WFS orders endpoint
  app.get('/wfs-orders-test', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const c = await prisma.channelConfig.findFirst({
      where: { orgId: req.user.orgId, channel: 'WALMART', status: 'CONNECTED' },
    })
    if (!c) return reply.code(400).send({ success: false })
    const { clientId, clientSecret } = c.credentials as any

    const axios = (await import('axios')).default
    const { randomUUID } = await import('crypto')
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const tokenRes = await axios.post(
      'https://marketplace.walmartapis.com/v3/token',
      new URLSearchParams({ grant_type: 'client_credentials' }),
      { headers: { Authorization: `Basic ${credentials}`, 'WM_SVC.NAME': 'SVA', 'WM_QOS.CORRELATION_ID': randomUUID(), 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, timeout: 10000 }
    )
    const token = tokenRes.data.access_token
    const headers = { 'WM_SEC.ACCESS_TOKEN': token, 'WM_SVC.NAME': 'SVA', 'WM_QOS.CORRELATION_ID': randomUUID(), 'WM_CONSUMER.CHANNEL.TYPE': '0f3e4dd4-0514-4346-b39d-af0e00ea066d', Accept: 'application/json' }
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const results: any = {}

    // Test 1: shipNodeType=WFSFulfilled on standard orders endpoint
    try {
      const r = await Promise.race([
        axios.get('https://marketplace.walmartapis.com/v3/orders', {
          headers: { ...headers, 'WM_QOS.CORRELATION_ID': randomUUID() },
          params: { createdStartDate: since30, limit: 5, shipNodeType: 'WFSFulfilled' },
          timeout: 20000,
        }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout 20s')), 20000))
      ])
      results.wfsFulfilled_orders = { totalCount: (r as any).data?.list?.meta?.totalCount, returned: (r as any).data?.list?.elements?.order?.length ?? 0 }
    } catch (e: any) { results.wfsFulfilled_orders_error = e.message }

    // Test 2: fulfillment/orders endpoint
    try {
      const r = await Promise.race([
        axios.get('https://marketplace.walmartapis.com/v3/fulfillment/orders', {
          headers: { ...headers, 'WM_QOS.CORRELATION_ID': randomUUID() },
          params: { createdStartDate: since30, limit: 5 },
          timeout: 20000,
        }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout 20s')), 20000))
      ])
      results.fulfillment_orders = { status: (r as any).status, data: (r as any).data }
    } catch (e: any) { results.fulfillment_orders_error = e.message }

    return reply.send({ success: true, data: results })
  })

}