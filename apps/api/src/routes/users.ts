import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/db'
import bcrypt from 'bcryptjs'
import { requirePermission } from '../middleware/auth'

const ROLES = ['SUPER_ADMIN','ADMIN','MANAGER','FINANCE','MARKETING','SUPPORT','WAREHOUSE','SALES','VIEWER','GUEST'] as const

export async function userRoutes(app: FastifyInstance) {
  // GET /users — list org users (requires users:read)
  app.get('/', { preHandler: requirePermission('users:read') }, async (req, reply) => {
    const users = await prisma.user.findMany({
      where: { orgId: req.user!.orgId },
      select: { id: true, email: true, name: true, role: true, isActive: true, avatarUrl: true, lastLoginAt: true, createdAt: true, phone: true },
      orderBy: { name: 'asc' },
    })
    return reply.send({ success: true, data: users })
  })

  // POST /users/invite — add a user (SUPER_ADMIN or ADMIN only)
  app.post('/invite', { preHandler: requirePermission('users:write') }, async (req, reply) => {
    const { email, name, role = 'VIEWER', password } = req.body as any

    // Only SUPER_ADMIN can create another SUPER_ADMIN
    if (role === 'SUPER_ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
      return reply.code(403).send({ success: false, message: 'Only SUPER_ADMIN can create another SUPER_ADMIN' })
    }

    const existing = await prisma.user.findFirst({ where: { email, orgId: req.user!.orgId } })
    if (existing) return reply.code(409).send({ success: false, message: 'User already exists in this org' })

    const tempPassword = password ?? Math.random().toString(36).slice(-8) + 'Aa1!'
    const passwordHash = await bcrypt.hash(tempPassword, 12)

    const user = await prisma.user.create({
      data: { email, name, role, passwordHash, orgId: req.user!.orgId, isActive: true },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    })

    return reply.code(201).send({ success: true, data: user, tempPassword })
  })

  // PATCH /users/:id — update role/status (requires users:write + role hierarchy)
  app.patch('/:id', { preHandler: requirePermission('users:write') }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { role, isActive, name, phone } = req.body as any

    const target = await prisma.user.findFirst({ where: { id, orgId: req.user!.orgId } })
    if (!target) return reply.code(404).send({ success: false, message: 'User not found' })

    // Cannot demote/change a SUPER_ADMIN unless you are SUPER_ADMIN
    if (target.role === 'SUPER_ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
      return reply.code(403).send({ success: false, message: 'Cannot modify a SUPER_ADMIN' })
    }
    // Cannot promote to SUPER_ADMIN unless you are SUPER_ADMIN
    if (role === 'SUPER_ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
      return reply.code(403).send({ success: false, message: 'Only SUPER_ADMIN can grant SUPER_ADMIN role' })
    }
    // Cannot modify yourself in ways that lock you out
    if (id === req.user!.sub && isActive === false) {
      return reply.code(400).send({ success: false, message: 'Cannot deactivate your own account' })
    }

    const updates: any = {}
    if (role !== undefined)     updates.role = role
    if (isActive !== undefined) updates.isActive = isActive
    if (name !== undefined)     updates.name = name
    if (phone !== undefined)    updates.phone = phone

    const user = await prisma.user.update({
      where: { id },
      data: updates,
      select: { id: true, email: true, name: true, role: true, isActive: true, avatarUrl: true },
    })
    return reply.send({ success: true, data: user })
  })

  // DELETE /users/:id — deactivate (soft delete)
  app.delete('/:id', { preHandler: requirePermission('users:write') }, async (req, reply) => {
    const { id } = req.params as { id: string }
    if (id === req.user!.sub) return reply.code(400).send({ success: false, message: 'Cannot delete your own account' })

    const target = await prisma.user.findFirst({ where: { id, orgId: req.user!.orgId } })
    if (!target) return reply.code(404).send({ success: false, message: 'User not found' })
    if (target.role === 'SUPER_ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
      return reply.code(403).send({ success: false, message: 'Cannot delete a SUPER_ADMIN' })
    }

    await prisma.user.update({ where: { id }, data: { isActive: false } })
    return reply.send({ success: true })
  })
}
