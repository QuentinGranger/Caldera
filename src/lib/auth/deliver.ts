import 'server-only';
import { after } from 'next/server';

/**
 * Sends an account e-mail after the response inside a request, so the answer
 * time never tells whether an account exists (a reset link is only e-mailed
 * to real accounts). Outside a request (scripts, tests) it runs at once.
 */
export async function deliverAfterResponse(task: () => Promise<void>) {
  try {
    after(task);
  } catch {
    await task();
  }
}
