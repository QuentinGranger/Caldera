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

  const connectionString =
    process.env.PRIMARY_DB_CONNECTION_STRING ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'PRIMARY_DB_CONNECTION_STRING ou DATABASE_URL est manquante.',
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
