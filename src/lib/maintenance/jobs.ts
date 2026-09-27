import 'server-only';
import { processPendingEmails } from '@/lib/email/processor';
import type { EmailProvider } from '@/lib/email/provider';
import { expireReservations } from '@/lib/payments/cancel';
import { invalidateCatalogCache } from '@/lib/cache/catalogCache';
import type { PaymentGateway } from '@/lib/stripe/stripe';

export const maintenanceJobs = [
  'expire-reservations',
  'process-emails',
] as const;

export type MaintenanceJob = (typeof maintenanceJobs)[number];

type Dependencies = { gateway?: PaymentGateway; provider?: EmailProvider };

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
  'process-emails': async ({ provider }) => ({
    ok: true,
    counts: await processPendingEmails({ limit: 50, provider }),
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
