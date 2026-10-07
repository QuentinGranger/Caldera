import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { getPrisma } from '@/lib/db/prisma';

const STATE_LIFETIME_MS = 10 * 60_000;

function digest(state: string) {
  return createHash('sha256').update(state).digest('hex');
}

export async function createDiscordOAuthState(sessionId: string) {
  const state = randomBytes(32).toString('hex');
  await getPrisma().discordOAuthState.upsert({
    where: { sessionId },
    create: {
      sessionId,
      stateHash: digest(state),
      expiresAt: new Date(Date.now() + STATE_LIFETIME_MS),
    },
    update: {
      stateHash: digest(state),
      expiresAt: new Date(Date.now() + STATE_LIFETIME_MS),
    },
  });
  return state;
}

/** Atomic consume. A state from another session, an expired state and replay fail. */
export async function consumeDiscordOAuthState(
  state: string | null,
  sessionId: string,
) {
  if (!state || !/^[a-f0-9]{64}$/.test(state)) return false;
  const deleted = await getPrisma().discordOAuthState.deleteMany({
    where: {
      stateHash: digest(state),
      sessionId,
      expiresAt: { gt: new Date() },
    },
  });
  return deleted.count === 1;
}
