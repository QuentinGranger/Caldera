import 'dotenv/config';
import { getPrisma } from '../src/lib/db/prisma';
import { runMaintenanceJob } from '../src/lib/maintenance/jobs';
try {
  if (!(await runMaintenanceJob('process-emails')).ok) {
    console.error(
      'Traitement email indisponible. Vérifier la configuration et PostgreSQL.',
    );
    process.exitCode = 1;
  }
} finally {
  await getPrisma().$disconnect();
}
