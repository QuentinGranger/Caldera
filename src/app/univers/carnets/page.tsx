import type { Metadata } from 'next';
import { connection } from 'next/server';
import Link from 'next/link';
import { getPrisma } from '@/lib/db/prisma';
import { listPublicCarnets } from '@/lib/carnets/public';
import { carnetUrl } from '@/lib/carnets/content';
import { siteOrigin } from '@/lib/site';
import { DeadlineRefresh } from './DeadlineRefresh';
import styles from './page.module.scss';
export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const chapters = await listPublicCarnets();
  return {
    title: 'Les Carnets de Caldera',
    description: 'Les récits des Terres de Caldera, chapitre après chapitre.',
    alternates: { canonical: `${siteOrigin()}/univers/carnets` },
    robots: { index: chapters.length > 0, follow: true },
  };
}
export default async function CarnetsPage() {
  await connection();
  const now = new Date();
  const [chapters, next] = await Promise.all([
    listPublicCarnets(now),
    getPrisma().carnetChapter.findFirst({
      where: {
        status: { in: ['READY', 'EARLY_ACCESS', 'PUBLIC'] },
        publicAt: { gt: now },
        OR: [
          { releaseCampaignId: { not: null } },
          { publishedAt: { not: null } },
        ],
      },
      orderBy: { publicAt: 'asc' },
      select: { publicAt: true },
    }),
  ]);
  return (
    <main id="contenu" className={styles.main}>
      <div className={styles.inner}>
        <nav className={styles.nav}>
          <Link href="/univers">← L’univers Caldera</Link>
        </nav>
        <header className={styles.header}>
          <p className={styles.eyebrow}>LES TERRES DE CALDERA</p>
          <h1>Les Carnets de Caldera</h1>
          <p>
            Des récits à découvrir, chapitre après chapitre. Les abonnés de La
            Lettre les lisent quatorze jours en avant-première.
          </p>
        </header>
        {chapters.length ? (
          <ol className={styles.grid}>
            {chapters.map((chapter) => (
              <li key={chapter.id}>
                <Link href={carnetUrl(chapter.slug)} prefetch={false}>
                  <span className={styles.eyebrow}>
                    Carnet #{String(chapter.number).padStart(3, '0')}
                  </span>
                  <h2>{chapter.title}</h2>
                  {chapter.arcTitle && <p>{chapter.arcTitle}</p>}
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <section className={styles.gate}>
            <p>
              Les prochains Carnets seront réunis ici après leur avant-première.
            </p>
            <Link className={styles.cta} href="/newsletter">
              Découvrir La Lettre
            </Link>
          </section>
        )}
        <DeadlineRefresh at={next?.publicAt?.toISOString() ?? null} />
      </div>
    </main>
  );
}
