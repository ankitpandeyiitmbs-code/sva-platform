import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { env } from './utils/env'
import { authRoutes } from './routes/auth'
import { userRoutes } from './routes/users'
import { channelRoutes } from './routes/channels'
import { dashboardRoutes } from './routes/dashboard'
import { customerRoutes } from './routes/customers'
import { orderRoutes } from './routes/orders'
import { inventoryRoutes } from './routes/inventory'
import { ticketRoutes } from './routes/tickets'
import { invoiceRoutes } from './routes/invoices'
import { taskRoutes } from './routes/tasks'
import { chatRoutes } from './routes/chat'
import { automationRoutes } from './routes/automations'
import { aiRoutes } from './routes/ai'
import { webhookRoutes } from './routes/webhooks'
import { analyticsRoutes } from './routes/analytics'
import { crmRoutes } from './routes/crm'
import { marketingRoutes } from './routes/marketing'
import { tiktokRoutes } from './routes/tiktok'
import { amazonRoutes } from './routes/amazon'
import { authMiddleware } from './middleware/auth'

export const app = Fastify({
  logger: {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport:
      env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
})

async function bootstrap() {
  // ── CORS ──────────────────────────────────────────────
  await app.register(cors, {
    origin: env.ALLOWED_ORIGINS.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  // ── Rate Limiting ─────────────────────────────────────
  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please slow down.',
    }),
  })

  // ── Swagger Docs ──────────────────────────────────────
  await app.register(swagger, {
    openapi: {
      info: { title: 'SVA Platform API', version: '1.0.0' },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  })
  await app.register(swaggerUi, { routePrefix: '/docs' })

  // ── Health Check ──────────────────────────────────────
  app.get('/health', async () => ({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  }))

  // ── Auth middleware (decodes JWT on protected routes) ─
  app.addHook('preHandler', authMiddleware)

  // ── Route Registration ────────────────────────────────
  const API = '/api/v1'
  await app.register(authRoutes, { prefix: `${API}/auth` })
  await app.register(userRoutes, { prefix: `${API}/users` })
  await app.register(channelRoutes, { prefix: `${API}/channels` })
  await app.register(dashboardRoutes, { prefix: `${API}/dashboard` })
  await app.register(customerRoutes, { prefix: `${API}/customers` })
  await app.register(orderRoutes, { prefix: `${API}/orders` })
  await app.register(inventoryRoutes, { prefix: `${API}/inventory` })
  await app.register(ticketRoutes, { prefix: `${API}/tickets` })
  await app.register(invoiceRoutes, { prefix: `${API}/invoices` })
  await app.register(taskRoutes, { prefix: `${API}/tasks` })
  await app.register(chatRoutes, { prefix: `${API}/chat` })
  await app.register(automationRoutes, { prefix: `${API}/automations` })
  await app.register(aiRoutes, { prefix: `${API}/ai` })
  await app.register(analyticsRoutes, { prefix: `${API}/analytics` })
  await app.register(crmRoutes, { prefix: `${API}/crm` })
  await app.register(marketingRoutes, { prefix: `${API}/marketing` })
  await app.register(webhookRoutes, { prefix: `${API}/webhooks` })
  await app.register(tiktokRoutes, { prefix: `${API}/tiktok` })
  await app.register(amazonRoutes, { prefix: `${API}/amazon` })

  // ── Start ─────────────────────────────────────────────
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' })
    app.log.info(`SVA Platform API running on port ${env.PORT}`)
    app.log.info(`Swagger docs: http://localhost:${env.PORT}/docs`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

bootstrap()
