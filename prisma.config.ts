import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// DATABASE_URL first: a local .env also holds the Neon production URL (Stripe Projects),
// which must never be the default target. Vercel only defines the Neon variable.
// Production migration: DATABASE_URL= npm run db:deploy
const connectionString =
  process.env.DATABASE_URL || process.env.PRIMARY_DB_CONNECTION_STRING || '';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  // La génération du client et le build ne nécessitent pas de base accessible.
  datasource: { url: connectionString },
});
