import 'server-only';
import { adminTransaction, audit } from '@/lib/admin/common';
import {
  AdminError,
  checked,
  choice,
  id,
  text,
  whitelist,
} from '@/lib/admin/validation';
import { siteOrigin } from '@/lib/site';
import { discordConfigured, discordEnabled, manualEventKey } from './outbox';
import {
  renderDiscordPublication,
  type DiscordPublicationKind,
} from './publication';

export async function saveDiscordDraft(adminId: string, form: FormData) {
  whitelist(form, ['kind', 'title', 'summary', 'path']);
  const publication = {
    kind: choice(form, 'kind', ['announcement', 'campaign']),
    title: text(form, 'title', 160),
    summary: text(form, 'summary', 600),
    path: text(form, 'path', 200),
  };
  try {
    renderDiscordPublication(publication, siteOrigin());
  } catch {
    throw new AdminError(
      'Utilisez un lien public interne et des textes valides, sans donnée personnelle.',
    );
  }
  return adminTransaction(adminId, async (tx) => {
    const existing = await tx.discordOutbox.findUnique({
      where: { eventKey: manualEventKey(publication) },
    });
    if (existing)
      throw new AdminError('Ce contenu existe déjà dans la file Discord.');
    const draft = await tx.discordOutbox.create({
      data: {
        ...publication,
        eventKey: manualEventKey(publication),
        status: 'DRAFT',
      },
    });
    await audit(
      tx,
      adminId,
      'DISCORD_DRAFT_CREATED',
      'DiscordOutbox',
      draft.id,
    );
    return draft;
  });
}
export async function manageDiscordPublication(
  adminId: string,
  form: FormData,
) {
  whitelist(form, ['id', 'operation', 'reviewed', 'messageId']);
  const publicationId = id(form)!;
  const operation = choice(form, 'operation', [
    'queue',
    'cancel',
    'confirm-sent',
    'retry',
  ]);
  const reviewed = checked(form, 'reviewed');
  const messageId = text(form, 'messageId', 25, false);
  return adminTransaction(adminId, async (tx) => {
    await tx.$queryRaw`SELECT id FROM "DiscordOutbox" WHERE id = ${publicationId}::uuid FOR UPDATE`;
    const event = await tx.discordOutbox.findUnique({
      where: { id: publicationId },
    });
    if (!event || event.status === 'SENT' || event.status === 'PROCESSING')
      throw new AdminError('Cette publication ne peut pas être modifiée.');
    let status: 'PENDING' | 'CANCELLED' | 'SENT';
    if (operation === 'cancel') status = 'CANCELLED';
    else if (operation === 'confirm-sent') {
      if (
        event.status !== 'REVIEW' ||
        !reviewed ||
        !/^\d{15,25}$/.test(messageId)
      )
        throw new AdminError(
          'Vérifiez le message dans Discord puis renseignez son identifiant.',
        );
      status = 'SENT';
    } else {
      if (
        !discordEnabled() ||
        !discordConfigured(event.kind as DiscordPublicationKind)
      )
        throw new AdminError(
          'Les publications Discord ne sont pas activées ou leur salon est absent.',
        );
      if (
        !reviewed ||
        (operation === 'queue'
          ? event.status !== 'DRAFT'
          : !['REVIEW', 'REJECTED'].includes(event.status))
      )
        throw new AdminError(
          'Relisez le contenu et confirmez la vérification demandée.',
        );
      status = 'PENDING';
    }
    await tx.discordOutbox.update({
      where: { id: publicationId },
      data: {
        status,
        nextAttemptAt: new Date(),
        lockedAt: null,
        errorCode: null,
        ...(status === 'SENT' ? { messageId } : {}),
      },
    });
    await audit(
      tx,
      adminId,
      'DISCORD_PUBLICATION_' + operation.toUpperCase(),
      'DiscordOutbox',
      publicationId,
    );
  });
}
