import type { FastifyInstance } from 'fastify'

export async function webhookRoutes(app: FastifyInstance) {
  // Shopify webhook receiver
  app.post('/shopify', async (req, reply) => {
    const topic = req.headers['x-shopify-topic'] as string
    app.log.info({ topic, body: req.body }, 'Shopify webhook received')
    // TODO: Queue processing job via BullMQ
    return reply.code(200).send({ received: true })
  })

  // Amazon SP-API notification receiver
  app.post('/amazon', async (req, reply) => {
    app.log.info({ body: req.body }, 'Amazon webhook received')
    return reply.code(200).send({ received: true })
  })

  // Walmart webhook receiver
  app.post('/walmart', async (req, reply) => {
    app.log.info({ body: req.body }, 'Walmart webhook received')
    return reply.code(200).send({ received: true })
  })

  // TikTok Shop webhook receiver
  app.post('/tiktok', async (req, reply) => {
    app.log.info({ body: req.body }, 'TikTok webhook received')
    return reply.code(200).send({ received: true })
  })

  // Stripe payment webhook
  app.post('/stripe', async (req, reply) => {
    app.log.info({ body: req.body }, 'Stripe webhook received')
    return reply.code(200).send({ received: true })
  })

  // Generic inbound webhook for automations
  app.post('/inbound/:orgSlug/:automationId', async (req, reply) => {
    const { orgSlug, automationId } = req.params as any
    app.log.info({ orgSlug, automationId, body: req.body }, 'Inbound automation webhook')
    return reply.code(200).send({ received: true })
  })
}
