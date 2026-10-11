import 'server-only';
import { planLifecycle } from './planner';
import { processLifecycleEmails } from './processor';
import { getPrisma } from '@/lib/db/prisma';
import { processStockAlerts } from '@/lib/stock-alerts/processor';
import { DAY } from './policy';
export async function runLifecycle() {
  if (
    process.env.LIFECYCLE_EMAILS_ENABLED !== 'true' ||
    process.env.EMAILS_ENABLED !== 'true'
  )
    return { disabled: true };
  try {
    const planned = await planLifecycle();
    if (process.env.CATALOG_DEMO_MODE !== '1')
      await processStockAlerts({ limit: 5 });
    const processed = await processLifecycleEmails();
    // Only compact event ids remain for dedupe; rendered content is personal data.
    await getPrisma().lifecycleDelivery.updateMany({
      where: {
        createdAt: { lt: new Date(Date.now() - 30 * DAY) },
        status: { in: ['SENT', 'SKIPPED'] },
      },
      data: {
        envelope: (await import('@/generated/prisma/client')).Prisma.DbNull,
      },
    });
    const result = { ...planned, ...processed };
    console.info(JSON.stringify({ scope: 'lifecycle', ...result }));
    return result;
  } catch {
    console.error(
      JSON.stringify({
        scope: 'lifecycle',
        code: 'AUTOMATISATION_INDISPONIBLE',
      }),
    );
    return { disabled: false, failed: 1 };
  }
}
