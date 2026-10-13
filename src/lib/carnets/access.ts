import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { appOrigin } from '@/lib/orders/access';
import { carnetUrl } from './content';
export type CarnetCalendar = {
  id: string;
  status: string;
  earlyAccessAt: Date | null;
  publicAt: Date | null;
  publishedAt: Date | null;
  releaseCampaignId: string | null;
};
export function carnetAccessState(chapter: CarnetCalendar, now = new Date()) {
  if (!['READY', 'EARLY_ACCESS', 'PUBLIC'].includes(chapter.status))
    return 'hidden';
  if (
    !chapter.earlyAccessAt ||
    !chapter.publicAt ||
    (!chapter.releaseCampaignId && !chapter.publishedAt)
  )
    return 'hidden';
  if (chapter.publicAt <= chapter.earlyAccessAt) return 'hidden';
  if (now >= chapter.publicAt) return 'public';
  return now >= chapter.earlyAccessAt ? 'early' : 'scheduled';
}
function signature(chapter: CarnetCalendar) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error('Configuration des liens Carnets manquante.');
  const key = createHmac('sha256', secret)
    .update('caldera:carnets:early-access:v1')
    .digest();
  return createHmac('sha256', key)
    .update(
      `v1:${chapter.id}:${chapter.earlyAccessAt!.getTime()}:${chapter.publicAt!.getTime()}`,
    )
    .digest('hex');
}
export function carnetAccessToken(chapter: CarnetCalendar) {
  if (!chapter.earlyAccessAt || !chapter.publicAt)
    throw new Error('Calendrier Carnet manquant.');
  return `v1.${chapter.publicAt.getTime()}.${signature(chapter)}`;
}
export function verifyCarnetAccess(
  chapter: CarnetCalendar,
  token: unknown,
  now = new Date(),
) {
  if (carnetAccessState(chapter, now) !== 'early' || typeof token !== 'string')
    return false;
  const match = /^v1\.(\d{13})\.([a-f0-9]{64})$/.exec(token);
  if (!match || Number(match[1]) !== chapter.publicAt!.getTime()) return false;
  try {
    return timingSafeEqual(
      Buffer.from(match[2]!, 'hex'),
      Buffer.from(signature(chapter), 'hex'),
    );
  } catch {
    return false;
  }
}
export function carnetAccessUrl(chapter: CarnetCalendar & { slug: string }) {
  return `${appOrigin()}${carnetUrl(chapter.slug)}?access=${carnetAccessToken(chapter)}`;
}
