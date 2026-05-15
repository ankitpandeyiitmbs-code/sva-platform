import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/db'
import bcrypt from 'bcryptjs'

export async function userRoutes(app: FastifyInstance) {
  // GET /users — list org users
  app.get('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const users = await prisma.user.findMany({
      where: { orgId: req.user.orgId },
      select: { id: true, email: true, name: true, role: true, isActive: true, avatarUrl: true, lastLoginAt: true, createdAt: true },
      orderBy: { name: 'asc' },
    })
    return reply.send({ success: true, data: users })
  })

  // POST /users — invite a new user
  app.post('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { email, name, role, password } = req.body as any
    const passwordHash = await bcrypt.hash(password ?? Math.random().toString(36), 12)
    const user = await prisma.user.create({
      data: { email, name, role, passwordHash, orgId: req.user.orgId },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    })
    return reply.code(201).send({ success: true, data: user })
  })

  // PATCH /users/:id
  app.patch('/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const data = req.body as any
    if (data.password) {
      data.passwordHash = await bcrypt.hash(data.password, 12)
      delete data.password
    }
    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, isActive: true, avatarUrl: true },
    })
    return reply.send({ success: true, data: user })
  })

  // DELETE /users/:id
  app.delete('/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    await prisma.user.update({ where: { id }, data: { isActive: false } })
    return reply.send({ success: true })
  })
}
