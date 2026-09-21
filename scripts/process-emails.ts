import 'dotenv/config';
import { getPrisma } from '../src/lib/db/prisma';
import { processPendingEmails } from '../src/lib/email/processor';
import { processPendingCustomerEmails } from '../src/lib/email/customer-processor';
try {
  console.info({
    orders: await processPendingEmails({ limit: 50 }),
    customers: await processPendingCustomerEmails(50),
  });
} catch {
  console.error(
    'Traitement email indisponible. Vérifier la configuration et PostgreSQL.',
  );
  process.exitCode = 1;
} finally {
  await getPrisma().$disconnect();
}
