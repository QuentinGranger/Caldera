import 'server-only';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@/generated/prisma/client';

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

let prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  const existingClient = prisma ?? globalForPrisma.prisma;

  if (existingClient) return existingClient;

  // DATABASE_URL first: tests and scripts guard on its host, and a local .env
  // also holds the Neon production URL. Vercel only defines the Neon variable.
  const connectionString =
    process.env.DATABASE_URL || process.env.PRIMARY_DB_CONNECTION_STRING;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL ou PRIMARY_DB_CONNECTION_STRING est manquante.',
    );
  }

  const adapter = new PrismaPg({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 3_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 3_000,
  });

  prisma = new PrismaClient({ adapter });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
  }

  return prisma;
}
