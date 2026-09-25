import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const connectionString =
  process.env.PRIMARY_DB_CONNECTION_STRING ?? process.env.DATABASE_URL ?? '';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  // La génération du client et le build ne nécessitent pas de base accessible.
  datasource: { url: connectionString },
});
