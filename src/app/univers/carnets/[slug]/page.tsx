import { cache } from 'react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { connection } from 'next/server';
import { notFound, redirect } from 'next/navigation';
import { readCarnet, listPublicCarnets } from '@/lib/carnets/public';
import {
  parseCarnetContent,
  deriveCarnet,
  carnetUrl,
} from '@/lib/carnets/content';
import { siteOrigin } from '@/lib/site';
import { DeadlineRefresh } from '../DeadlineRefresh';
import styles from '../page.module.scss';
export const dynamic = 'force-dynamic';
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ access?: string | string[] }>;
};
const read = cache(async (slug: string, access: string | undefined) => {
  await connection();
  return readCarnet(slug, access);
});
async function data(props: Props) {
  const [{ slug }, query] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  return {
    result: await read(
      slug,
      typeof query.access === 'string' ? query.access : undefined,
    ),
    hasAccess: query.access !== undefined,
  };
}
export async function generateMetadata(props: Props): Promise<Metadata> {
  const { result } = await data(props);
  if (!result)
    return {
      title: 'Carnet indisponible',
      robots: { index: false, follow: false },
    };
  const { chapter, state } = result;
  const canonical = `${siteOrigin()}${carnetUrl(chapter.slug)}`;
  const description = `Carnet #${String(chapter.number).padStart(3, '0')} — ${chapter.title}. Un récit des Terres de Caldera.`;
  return {
    title: `${chapter.title} · Les Carnets`,
    description,
    alternates: { canonical },
    robots: { index: state === 'public', follow: state === 'public' },
    openGraph: {
      title: chapter.title,
      description,
      url: canonical,
      type: 'article',
    },
  };
}
const date = (value: Date) =>
  new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(value);
export default async function CarnetPage(props: Props) {
  const { result, hasAccess } = await data(props);
  if (!result) notFound();
  const { chapter, state, content } = result;
  if (state === 'public' && hasAccess) redirect(carnetUrl(chapter.slug));
  const chapters = content ? await listPublicCarnets() : [];
  const older = chapters.filter((c) => c.number < chapter.number).at(0);
  const newer = [...chapters].reverse().find((c) => c.number > chapter.number);
  return (
    <main id="contenu" className={styles.main}>
      <div className={styles.inner}>
        <nav className={styles.nav} aria-label="Fil d’Ariane">
          <Link href="/univers">L’univers Caldera</Link>
          <Link href="/univers/carnets" prefetch={false}>
            Les Carnets
          </Link>
        </nav>
        <header className={styles.header}>
          <p className={styles.eyebrow}>
            LES CARNETS DE CALDERA · #{String(chapter.number).padStart(3, '0')}
          </p>
          {chapter.arcTitle && (
            <p>
              {chapter.arcTitle}
              {chapter.arcPosition && chapter.arcTotal
                ? ` · ${chapter.arcPosition} / ${chapter.arcTotal}`
                : ''}
            </p>
          )}
          <h1>{chapter.title}</h1>
          {state === 'early' && content && <p>Avant-première abonnés</p>}
          {content && chapter.location && <p>{chapter.location}</p>}
        </header>
        {content ? (
          <article aria-label={chapter.title}>
            {chapter.illustrationUrl && (
              <Image
                className={styles.image}
                src={chapter.illustrationUrl}
                alt={chapter.illustrationAlt ?? ''}
                width={1200}
                height={675}
                sizes="(max-width: 940px) 95vw, 900px"
              />
            )}
            <div
              className={styles.prose}
              dangerouslySetInnerHTML={{
                __html: deriveCarnet(parseCarnetContent(content)).full.html,
              }}
            />
            <nav className={styles.nav} aria-label="Navigation des Carnets">
              {older && (
                <Link href={carnetUrl(older.slug)} prefetch={false}>
                  ← {older.title}
                </Link>
              )}
              {newer && (
                <Link href={carnetUrl(newer.slug)} prefetch={false}>
                  {newer.title} →
                </Link>
              )}
            </nav>
          </article>
        ) : (
          <section className={styles.gate} aria-label="Avant-première réservée">
            <p>
              Ce Carnet est actuellement réservé aux abonnés de La Lettre de
              Caldera.
            </p>
            <p>
              Publication publique le <strong>{date(chapter.publicAt!)}</strong>{' '}
              (heure de Paris).
            </p>
            <p>
              Si vous avez reçu cet épisode, ouvrez le lien « Continuer
              l’expédition » de votre newsletter.
            </p>
            <Link className={styles.cta} href="/newsletter">
              S’abonner à La Lettre
            </Link>
          </section>
        )}
        <DeadlineRefresh
          at={
            state === 'public'
              ? null
              : (state === 'scheduled'
                  ? chapter.earlyAccessAt!
                  : chapter.publicAt!
                ).toISOString()
          }
        />
      </div>
    </main>
  );
}
