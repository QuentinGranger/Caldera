import 'server-only';
import { processPendingEmails } from '@/lib/email/processor';
import { processNewsletterDeliveries } from '@/lib/newsletter/processor';
import { processStockAlerts } from '@/lib/stock-alerts/processor';
import type { RefundGateway } from '@/lib/refunds/gateway';
import { syncRefunds } from '@/lib/refunds/service';
import { stripeMode } from '@/lib/stripe/stripe';
import type { TaxGateway } from '@/lib/tax/gateway';
import { syncTax, taxWorkPending } from '@/lib/tax/service';
import { purgeSupplierImports } from '@/lib/supplier-import/service';
import type { EmailProvider } from '@/lib/email/provider';
import { expireReservations } from '@/lib/payments/cancel';
import { invalidateCatalogCache } from '@/lib/cache/catalogCache';
import type { PaymentGateway } from '@/lib/stripe/stripe';

export const maintenanceJobs = [
  'expire-reservations',
  'process-emails',
  'sync-refunds',
  'sync-tax',
  'purge-supplier-imports',
] as const;

export type MaintenanceJob = (typeof maintenanceJobs)[number];

type Dependencies = {
  gateway?: PaymentGateway;
  provider?: EmailProvider;
  refunds?: RefundGateway;
  tax?: TaxGateway;
};

// Bounded batches: a missed, duplicated or interrupted run is caught up by the next one.
const tasks: Record<
  MaintenanceJob,
  (
    deps: Dependencies,
  ) => Promise<{ ok: boolean; counts: Record<string, number | boolean> }>
> = {
  'expire-reservations': async ({ gateway }) => {
    const counts = await expireReservations(gateway);
    // Released reservations put units back on sale.
    if (counts.inspected > 0) invalidateCatalogCache();
    return { ok: counts.failures === 0, counts };
  },
  'process-emails': async ({ provider }) => {
    const [transactional, newsletter, alerts] = await Promise.all([
      processPendingEmails({ limit: 50, provider }),
      processNewsletterDeliveries({ limit: 10, provider }),
      processStockAlerts({ limit: 20, provider }),
    ]);
    return {
      ok: true,
      counts: {
        sent: transactional.sent,
        failed: transactional.failed,
        disabled: transactional.disabled,
        newsletterSent: newsletter.sent,
        newsletterFailed: newsletter.failed,
        newsletterSkipped: newsletter.skipped,
        newsletterCompleted: newsletter.completed,
        newsletterQuotaLimited: newsletter.quotaLimited,
        stockAlertsNotified: alerts.notified,
        stockAlertsFailed: alerts.failed,
        stockAlertsPurged: alerts.purged,
        stockAlertsQuotaLimited: alerts.quotaLimited,
      },
    };
  },
  // Refunds Stripe has not confirmed yet (missed webhook, no answer).
  'sync-refunds': async ({ refunds }) => {
    if (!refunds && !stripeMode())
      return { ok: true, counts: { disabled: true, synced: 0, failed: 0 } };
    const counts = await syncRefunds({ gateway: refunds });
    return { ok: counts.failed === 0, counts: { disabled: false, ...counts } };
  },
  // Stripe Tax records (sales, refund reversals) not made on the spot.
  'sync-tax': async ({ tax }) => {
    if ((!tax && !stripeMode()) || !(await taxWorkPending()))
      return { ok: true, counts: { disabled: true, synced: 0, failed: 0 } };
    const counts = await syncTax({ gateway: tax });
    return { ok: counts.failed === 0, counts: { disabled: false, ...counts } };
  },
  // Supplier files never validated, and uploads kept after the end.
  'purge-supplier-imports': async () => ({
    ok: true,
    counts: await purgeSupplierImports(),
  }),
};

/** Only a controlled code is logged: raw messages may carry personal data or secrets. */
function errorCode(error: unknown) {
  const code =
    error instanceof Error && 'code' in error ? error.code : undefined;
  return typeof code === 'string' && /^[\w.-]{1,64}$/.test(code)
    ? code
    : 'MAINTENANCE_JOB_FAILED';
}

/** Never throws: the outcome is logged as one JSON line and returned. */
export async function runMaintenanceJob(
  job: MaintenanceJob,
  deps: Dependencies = {},
) {
  const startedAt = Date.now();

  try {
    const { ok, counts } = await tasks[job](deps);
    const entry = {
      scope: 'maintenance',
      action: ok ? 'job_completed' : 'job_retry_needed',
      job,
      durationMs: Date.now() - startedAt,
      ...counts,
    };

    if (ok) console.info(JSON.stringify(entry));
    else console.error(JSON.stringify(entry));

    return { ok, ...entry };
  } catch (error) {
    const entry = {
      scope: 'maintenance',
      action: 'job_failed',
      job,
      durationMs: Date.now() - startedAt,
      code: errorCode(error),
    };

    console.error(JSON.stringify(entry));

    return { ok: false, ...entry };
  }
}

/** Independent jobs: one failing never blocks the other. */
export function runMaintenance(deps: Dependencies = {}) {
  return Promise.all(
    maintenanceJobs.map((job) => runMaintenanceJob(job, deps)),
  );
}
