import 'dotenv/config';
import { getPrisma } from '../src/lib/db/prisma';
import { runMaintenanceJob } from '../src/lib/maintenance/jobs';
try {
  if (!(await runMaintenanceJob('expire-reservations')).ok)
    process.exitCode = 1;
} finally {
  await getPrisma().$disconnect();
}
