import type { FastifyInstance } from 'fastify'
import { prisma } from '@sva/db'

export async function taskRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { projectId, status, assigneeId } = req.query as any
    const where: any = { orgId: req.user.orgId, parentId: null }
    if (projectId) where.projectId = projectId
    if (status) where.status = status
    if (assigneeId) where.assigneeId = assigneeId
    const tasks = await prisma.task.findMany({ where, include: { assignee: { select: { name: true, avatarUrl: true } }, subTasks: true }, orderBy: { position: 'asc' } })
    return reply.send({ success: true, data: tasks })
  })

  app.post('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const task = await prisma.task.create({ data: { ...(req.body as any), orgId: req.user.orgId, creatorId: req.user.sub } })
    return reply.code(201).send({ success: true, data: task })
  })

  app.patch('/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    const task = await prisma.task.update({ where: { id }, data: req.body as any })
    return reply.send({ success: true, data: task })
  })

  app.delete('/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { id } = req.params as { id: string }
    await prisma.task.delete({ where: { id } })
    return reply.send({ success: true })
  })

  app.get('/projects', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const projects = await prisma.project.findMany({ where: { orgId: req.user.orgId }, include: { _count: { select: { tasks: true } } } })
    return reply.send({ success: true, data: projects })
  })

  app.post('/projects', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const project = await prisma.project.create({ data: { ...(req.body as any), orgId: req.user.orgId } })
    return reply.code(201).send({ success: true, data: project })
  })
}
