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

type ConfirmationRow = { day: Date; channel: string; count: number };

function channelCounts(rows: ConfirmationRow[]) {
  const counts = new Map<NewsletterChannel, number>();
  for (const row of rows) {
    const channel = validNewsletterChannel(row.channel);
    counts.set(channel, (counts.get(channel) ?? 0) + row.count);
  }
  return counts;
}

const nextSteps = {
  instagram_bio:
    'Refaire une publication qui renvoie au lien d’inscription dans la bio Instagram.',
  instagram_story: 'Refaire une story avec le lien d’inscription dédié.',
  instagram:
    'Baliser séparément la bio et les stories pour voir quel emplacement apporte les confirmations.',
  discord: 'Relayer la liste d’attente dans Discord avec le même lien balisé.',
  site: 'Mettre en avant le lien d’inscription sur le site.',
} satisfies Record<Exclude<NewsletterChannel, 'unknown'>, string>;

const bioLink =
  '[lien bio Instagram](https://lesterresdecaldera.fr/liens?utm_source=instagram&utm_medium=social&utm_campaign=ouverture&utm_content=bio)';

function signed(value: number) {
  return `${value > 0 ? '+' : ''}${format.format(value)}`;
}

function weeklyAction(counts: Map<NewsletterChannel, number>, total: number) {
  if (total === 0)
    return `Teste le ${bioLink} sur mobile jusqu’au formulaire, puis partage-le dans la bio. Aucune confirmation cette semaine.`;

  const attributed = total - (counts.get('unknown') ?? 0);
  if (attributed * 2 < total)
    return `Utilise le ${bioLink} dans la bio et un lien distinct pour chaque story. L’origine manque pour plus de la moitié des confirmations.`;

  const ranked = [...counts.entries()]
    .filter(([channel]) => channel !== 'unknown')
    .sort((a, b) => b[1] - a[1]);
  const leading = ranked[0];
  if (attributed < 5 || !leading || leading[1] < 3)
    return 'Relaye la liste d’attente avec les liens balisés déjà en place. Le volume est encore trop faible pour départager les canaux.';
  const second = ranked[1];
  if (second && leading[1] - second[1] < 2)
    return `Garde les deux canaux en test une semaine de plus. ${newsletterChannels[leading[0]]} et ${newsletterChannels[second[0]]} sont à une confirmation d’écart au maximum.`;

  const [channel, count] = leading;
  if (channel === 'unknown') return 'Vérifie le balisage des liens partagés.';
  return `${nextSteps[channel]} Ce canal a apporté ${format.format(count)} des ${format.format(attributed)} confirmations attribuées.`;
}

function dateRange(start: Date, exclusiveEnd: Date) {
  return `${frenchDate.format(start)} → ${frenchDate.format(shift(exclusiveEnd, -1))}`;
}

export function formatOpeningRadar(
  daily: ConfirmationRow[],
  active: number,
  now = new Date(),
) {
  const { start, end, previousStart } = radarWindow(now);
  const currentRows = daily.filter(({ day }) => day >= start && day < end);
  const previousRows = daily.filter(
    ({ day }) => day >= previousStart && day < start,
  );
  const recent = currentRows.reduce((sum, row) => sum + row.count, 0);
  const previous = previousRows.reduce((sum, row) => sum + row.count, 0);
  const current = channelCounts(currentRows);
  const earlier = channelCounts(previousRows);
  const attributed = recent - (current.get('unknown') ?? 0);
  const channels = [...new Set([...current.keys(), ...earlier.keys()])].sort(
    (a, b) =>
      a === 'unknown'
        ? 1
        : b === 'unknown'
          ? -1
          : (current.get(b) ?? 0) - (current.get(a) ?? 0) ||
            newsletterChannels[a].localeCompare(newsletterChannels[b], 'fr'),
  );
  const origin = channels.map((channel) => {
    const count = current.get(channel) ?? 0;
    const before = earlier.get(channel) ?? 0;
    return `${newsletterChannels[channel]} · **${format.format(count)}** contre ${format.format(before)} (${signed(count - before)})`;
  });

  return {
    title: 'Caldera · Radar d’ouverture',
    period: `${dateRange(start, end)}\nComparaison avec ${dateRange(previousStart, start)}`,
    summary: `**${format.format(recent)}** confirmations · ${format.format(previous)} la semaine précédente (${signed(recent - previous)})\n**${format.format(active)}** abonnés actifs au moment du bilan`,
    origin: channels.length
      ? [
          recent > 0
            ? `**Origine connue pour ${format.format(attributed)} sur ${format.format(recent)} confirmations**`
            : 'Aucune confirmation cette semaine.',
          ...origin,
        ].join('\n')
      : 'Aucune confirmation sur les deux périodes.',
    recommendation: weeklyAction(current, recent),
    methodology:
      'Confirmations reçues par e-mail sur 7 jours complets. L’origine dépend des liens et de l’accord de mesure d’audience.',
  };
}

function radarWindow(now: Date) {
  const today = confirmationDay(now);
  // The weekly period closes at midnight in Paris, before Friday's report.
  const end = shift(today, -((today.getUTCDay() + 2) % 7));
  const start = shift(end, -7);
  return { end, start, previousStart: shift(start, -7) };
}

export async function getOpeningRadar(now = new Date()) {
  const { end, previousStart } = radarWindow(now);
  const db = getPrisma();
  const [daily, active] = await db.$transaction([
    db.newsletterConfirmationDaily.findMany({
      where: { day: { gte: previousStart, lt: end } },
      select: { day: true, channel: true, count: true },
    }),
    db.newsletterSubscriber.count({ where: { status: 'ACTIVE' } }),
  ]);
  return formatOpeningRadar(daily, active, now);
}
