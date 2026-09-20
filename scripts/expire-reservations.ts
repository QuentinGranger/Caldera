import 'dotenv/config';
import { expireReservations } from '../src/lib/payments/cancel';
import { getPrisma } from '../src/lib/db/prisma';
try {
  const result = await expireReservations();
  console.info(JSON.stringify(result));
  if (result.failures) process.exitCode = 1;
} finally {
  await getPrisma().$disconnect();
}
