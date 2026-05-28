import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function buildUrl(): string {
  const base = process.env.DATABASE_URL ?? ''
  const poolParams = 'connection_limit=5&pool_timeout=30&connect_timeout=30'
  // Correctly append — use & if URL already has query params, ? if not
  const sep = base.includes('?') ? '&' : '?'
  return base + sep + poolParams
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: { db: { url: buildUrl() } },
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export * from '@prisma/client'
export { prisma as db }
