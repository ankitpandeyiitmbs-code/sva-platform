import type { FastifyInstance } from 'fastify'
import { prisma } from '@sva/db'

export async function inventoryRoutes(app: FastifyInstance) {
  app.get('/products', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { search } = req.query as any
    const where: any = { orgId: req.user.orgId }
    if (search) where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { sku: { contains: search, mode: 'insensitive' } }]
    const products = await prisma.product.findMany({ where, include: { variants: true, inventoryItems: { include: { warehouse: true } } }, orderBy: { name: 'asc' } })
    return reply.send({ success: true, data: products })
  })

  app.post('/products', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const product = await prisma.product.create({ data: { ...(req.body as any), orgId: req.user.orgId } })
    return reply.code(201).send({ success: true, data: product })
  })

  app.get('/warehouses', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const warehouses = await prisma.warehouse.findMany({ where: { orgId: req.user.orgId } })
    return reply.send({ success: true, data: warehouses })
  })

  app.get('/low-stock', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const items = await prisma.inventoryItem.findMany({
      where: { orgId: req.user.orgId },
      include: { product: true, warehouse: true },
    })
    const lowStock = items.filter((i) => i.quantity <= i.reorderPoint)
    return reply.send({ success: true, data: lowStock })
  })

  app.get('/purchase-orders', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const pos = await prisma.purchaseOrder.findMany({ where: { orgId: req.user.orgId }, include: { items: true, supplier: true }, orderBy: { createdAt: 'desc' } })
    return reply.send({ success: true, data: pos })
  })

  app.post('/purchase-orders', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { items, ...poData } = req.body as any
    const po = await prisma.purchaseOrder.create({ data: { ...poData, orgId: req.user.orgId, items: { create: items ?? [] } }, include: { items: true } })
    return reply.code(201).send({ success: true, data: po })
  })

  app.get('/suppliers', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const suppliers = await prisma.supplier.findMany({ where: { orgId: req.user.orgId } })
    return reply.send({ success: true, data: suppliers })
  })
}
