import { PrismaClient } from '@prisma/client';

const fallbackUrl =
  'postgresql://neondb_owner:npg_4VUwKCtFq3NB@ep-damp-cell-asc7guyo-pooler.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

// Ensure process.env.DATABASE_URL is always populated even if Vercel env var is unconfigured
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = fallbackUrl;
}

const connectionString = process.env.DATABASE_URL || fallbackUrl;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: connectionString,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
export default prisma;
