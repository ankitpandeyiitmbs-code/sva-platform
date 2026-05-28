import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        // Add connection pooling params — limits concurrent connections
        // so the sync doesn't exhaust the Railway PostgreSQL pool
        url: (process.env.DATABASE_URL ?? '') + '?connection_limit=5&pool_timeout=30&connect_timeout=30',
      },
    },
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export * from '@prisma/client'
export { prisma as db }
