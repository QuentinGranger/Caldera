import 'server-only';
import { getPrisma } from '@/lib/db/prisma';
import {
  newsletterChannels,
  validNewsletterChannel,
  type NewsletterChannel,
} from './acquisition';

const parisDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The database key is a calendar date, represented at midnight UTC. */
export function confirmationDay(instant: Date) {
  return new Date(`${parisDate.format(instant)}T00:00:00Z`);
}

function shift(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

const frenchDate = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'UTC',
  dateStyle: 'short',
});
const format = new Intl.NumberFormat('fr-FR');

export async function getOpeningRadar(now = new Date()) {
  const today = confirmationDay(now);
  // Friday's report uses seven completed days, even if run manually later.
  const end = shift(today, -((today.getUTCDay() + 2) % 7));
  const start = shift(end, -7);
  const previousStart = shift(start, -7);
  const db = getPrisma();
  const [daily, active] = await db.$transaction([
    db.newsletterConfirmationDaily.findMany({
      where: { day: { gte: previousStart, lt: end } },
      select: { day: true, channel: true, count: true },
    }),
    db.newsletterSubscriber.count({ where: { status: 'ACTIVE' } }),
  ]);
  let recent = 0;
  let previous = 0;
  const counts = new Map<NewsletterChannel, number>();
  for (const row of daily) {
    if (row.day < start) {
      previous += row.count;
      continue;
    }
    recent += row.count;
    const source = validNewsletterChannel(row.channel);
    counts.set(source, (counts.get(source) ?? 0) + row.count);
  }
  const channels = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const known = channels.filter(([source]) => source !== 'unknown');
  const knownTotal = known.reduce((sum, [, count]) => sum + count, 0);
  const first = known[0];
  const nextStep: Partial<Record<NewsletterChannel, string>> = {
    instagram_bio:
      'Mettre en avant la liste d’attente dans une publication qui renvoie à la bio Instagram.',
    instagram_story:
      'Refaire une story Instagram avec le lien vers la liste d’attente.',
    instagram:
      'Utiliser un lien distinct en bio et en story pour comparer les deux.',
    discord:
      'Relayer la liste d’attente dans Discord avec le même lien balisé.',
    site: 'Mettre en avant le lien d’inscription sur le site.',
  };
  const recommendation =
    first && first[1] >= 3 && knownTotal >= 5 && first[1] > (known[1]?.[1] ?? 0)
      ? `${nextStep[first[0]]} ${newsletterChannels[first[0]]} a apporté le plus de confirmations attribuées (${format.format(first[1])}).`
      : 'Publier un lien balisé cette semaine. Il manque des confirmations attribuées pour départager les canaux.';
  const difference = recent - previous;
  const delta = `${difference > 0 ? '+' : ''}${format.format(difference)}`;
  return {
    title: 'Caldera · Radar d’ouverture',
    period: `${frenchDate.format(start)} → ${frenchDate.format(shift(end, -1))}`,
    summary: `**${format.format(recent)}** confirmations · ${format.format(previous)} la semaine précédente (${delta})\n**${format.format(active)}** abonnés actifs à la lecture`,
    origin: channels.length
      ? channels
          .map(
            ([source, count]) =>
              `${newsletterChannels[source]} · ${format.format(count)}`,
          )
          .join('\n')
      : 'Aucune confirmation sur cette période.',
    recommendation,
    methodology:
      'Confirmations par e-mail sur 7 jours complets. L’origine dépend des liens balisés et de l’accord de mesure d’audience.',
  };
}
