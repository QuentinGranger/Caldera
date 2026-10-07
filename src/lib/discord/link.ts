import 'server-only';
import { headers } from 'next/headers';
import { getCustomerAuth } from '@/lib/account/auth';
import { withDiscordCustomerLock } from './lock';
import { changeDiscordLinkedRole, hasDiscordGuildMember } from './account';

export async function discordCustomerSession() {
  try {
    const session = await getCustomerAuth().api.getSession({
      headers: await headers(),
    });
    return session
      ? { customerId: session.user.id, sessionId: session.session.id }
      : null;
  } catch {
    return null;
  }
}

export { createDiscordOAuthState, consumeDiscordOAuthState } from './state';

export type LinkResult =
  'linked' | 'already_linked' | 'not_member' | 'unavailable';

export async function linkDiscordAccount(
  customerId: string,
  identity: { id: string; displayName: string },
): Promise<LinkResult> {
  try {
    return await withDiscordCustomerLock(
      customerId,
      async (db): Promise<LinkResult> => {
        if (!(await hasDiscordGuildMember(identity.id))) return 'not_member';
        await db.customerDiscordLink.create({
          data: {
            customerId,
            discordUserId: identity.id,
            displayName: identity.displayName,
          },
        });
        // Commit the pending link on an API failure so its owner can retry.
        try {
          await changeDiscordLinkedRole(identity.id, true);
          await db.customerDiscordLink.update({
            where: { customerId },
            data: { roleGrantedAt: new Date() },
          });
          return 'linked';
        } catch {
          return 'unavailable';
        }
      },
    );
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    )
      return 'already_linked';
    return 'unavailable';
  }
}

export async function synchronizeDiscordLinkedRole(customerId: string) {
  try {
    return await withDiscordCustomerLock(customerId, async (db) => {
      const link = await db.customerDiscordLink.findUnique({
        where: { customerId },
      });
      if (!link) return 'not_linked' as const;
      if (!(await hasDiscordGuildMember(link.discordUserId)))
        return 'not_member' as const;
      await changeDiscordLinkedRole(link.discordUserId, true);
      await db.customerDiscordLink.update({
        where: { customerId },
        data: { roleGrantedAt: new Date() },
      });
      return 'linked' as const;
    });
  } catch {
    return 'unavailable' as const;
  }
}

export async function unlinkDiscordAccount(customerId: string) {
  try {
    return await withDiscordCustomerLock(customerId, async (db) => {
      const link = await db.customerDiscordLink.findUnique({
        where: { customerId },
      });
      if (!link) return 'not_linked' as const;
      await changeDiscordLinkedRole(link.discordUserId, false);
      await db.customerDiscordLink.delete({ where: { customerId } });
      return 'unlinked' as const;
    });
  } catch {
    return 'unavailable' as const;
  }
}
