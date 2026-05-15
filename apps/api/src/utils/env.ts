import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),

  // Database
  DATABASE_URL: z.string().min(1),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('30d'),

  // CORS
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  // Storage (MinIO / S3)
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_ACCESS_KEY: z.string().default(''),
  MINIO_SECRET_KEY: z.string().default(''),
  MINIO_BUCKET: z.string().default('sva-uploads'),
  MINIO_USE_SSL: z.string().default('false'),

  // Email
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('noreply@svaorganics.com'),

  // Anthropic (AI features)
  ANTHROPIC_API_KEY: z.string().default(''),

  // ── MARKETPLACE API KEYS ─────────────────────────────
  // Amazon SP-API
  AMAZON_CLIENT_ID: z.string().default('REPLACE_WITH_AMAZON_CLIENT_ID'),
  AMAZON_CLIENT_SECRET: z.string().default('REPLACE_WITH_AMAZON_CLIENT_SECRET'),
  AMAZON_REFRESH_TOKEN: z.string().default('REPLACE_WITH_AMAZON_REFRESH_TOKEN'),

  // Shopify
  SHOPIFY_API_KEY: z.string().default('REPLACE_WITH_SHOPIFY_API_KEY'),
  SHOPIFY_API_SECRET: z.string().default('REPLACE_WITH_SHOPIFY_API_SECRET'),
  SHOPIFY_STORE_URL: z.string().default('REPLACE_WITH_YOUR_STORE.myshopify.com'),
  SHOPIFY_ACCESS_TOKEN: z.string().default('REPLACE_WITH_SHOPIFY_ACCESS_TOKEN'),

  // Walmart
  WALMART_CLIENT_ID: z.string().default('REPLACE_WITH_WALMART_CLIENT_ID'),
  WALMART_CLIENT_SECRET: z.string().default('REPLACE_WITH_WALMART_CLIENT_SECRET'),

  // TikTok Shop
  TIKTOK_APP_KEY: z.string().default('REPLACE_WITH_TIKTOK_APP_KEY'),
  TIKTOK_APP_SECRET: z.string().default('REPLACE_WITH_TIKTOK_APP_SECRET'),
  TIKTOK_ACCESS_TOKEN: z.string().default('REPLACE_WITH_TIKTOK_ACCESS_TOKEN'),

  // Myntra (partner API)
  MYNTRA_PARTNER_ID: z.string().default('REPLACE_WITH_MYNTRA_PARTNER_ID'),
  MYNTRA_API_KEY: z.string().default('REPLACE_WITH_MYNTRA_API_KEY'),

  // Flipkart
  FLIPKART_APP_ID: z.string().default('REPLACE_WITH_FLIPKART_APP_ID'),
  FLIPKART_APP_SECRET: z.string().default('REPLACE_WITH_FLIPKART_APP_SECRET'),

  // Payment gateways
  STRIPE_SECRET_KEY: z.string().default('REPLACE_WITH_STRIPE_SECRET_KEY'),
  STRIPE_WEBHOOK_SECRET: z.string().default('REPLACE_WITH_STRIPE_WEBHOOK_SECRET'),
  PAYPAL_CLIENT_ID: z.string().default('REPLACE_WITH_PAYPAL_CLIENT_ID'),
  PAYPAL_CLIENT_SECRET: z.string().default('REPLACE_WITH_PAYPAL_CLIENT_SECRET'),

  // Communication
  TWILIO_ACCOUNT_SID: z.string().default('REPLACE_WITH_TWILIO_ACCOUNT_SID'),
  TWILIO_AUTH_TOKEN: z.string().default('REPLACE_WITH_TWILIO_AUTH_TOKEN'),
  TWILIO_PHONE_NUMBER: z.string().default('REPLACE_WITH_TWILIO_PHONE_NUMBER'),

  // Accounting sync
  QUICKBOOKS_CLIENT_ID: z.string().default('REPLACE_WITH_QUICKBOOKS_CLIENT_ID'),
  QUICKBOOKS_CLIENT_SECRET: z.string().default('REPLACE_WITH_QUICKBOOKS_CLIENT_SECRET'),
  XERO_CLIENT_ID: z.string().default('REPLACE_WITH_XERO_CLIENT_ID'),
  XERO_CLIENT_SECRET: z.string().default('REPLACE_WITH_XERO_CLIENT_SECRET'),

  // Currency exchange rates
  EXCHANGE_RATE_API_KEY: z.string().default('REPLACE_WITH_EXCHANGE_RATE_API_KEY'),

  // Zapier / Make webhooks
  ZAPIER_WEBHOOK_SECRET: z.string().default('REPLACE_WITH_ZAPIER_WEBHOOK_SECRET'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌  Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
