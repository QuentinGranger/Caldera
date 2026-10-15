import { chapterComptoir } from '@/lib/carnets/comptoir';
import { parseCarnetContent, deriveCarnet } from '@/lib/carnets/content';
import { getNewsletterStudioData } from '@/lib/newsletter/studio';
import { getPrisma } from '@/lib/db/prisma';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { PageHeader } from '@/components/admin/AdminUI';
import { NewsletterCampaignEditor } from '@/components/admin/NewsletterCampaignEditor';
import { saveNewsletterCampaignAction } from '@/lib/newsletter/admin-actions';
import styles from '@/components/admin/Admin.module.scss';
import { getAdminCarnet } from '@/lib/carnets/admin';
import { notFound } from 'next/navigation';

export default async function NewNewsletterCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ chapterId?: string }>;
}) {
  const studio = await getNewsletterStudioData();
  const raw = (await searchParams).chapterId;
  if (raw && typeof raw !== 'string') notFound();
  const chapter = raw ? await getAdminCarnet(raw) : null;
  if (raw && !chapter) notFound();
  const carnetProducts = chapter
    ? await chapterComptoir(getPrisma(), chapter.id, false)
    : [];
  const chapters =
    chapter && !studio.chapters.some((c) => c.id === chapter.id)
      ? [
          {
            id: chapter.id,
            number: chapter.number,
            title: chapter.title,
            status: chapter.status,
          },
          ...studio.chapters,
        ]
      : studio.chapters;
  return (
    <>
      <PageHeader
        title="Nouvelle campagne"
        description="Préparez le contenu, enregistrez le brouillon, puis envoyez-vous un test avant de choisir les destinataires confirmés."
      >
        <Link
          className={`${styles.button} ${styles.secondaryButton}`}
          href="/admin/newsletter"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Newsletter
        </Link>
      </PageHeader>
      <NewsletterCampaignEditor
        action={saveNewsletterCampaignAction}
        products={studio.products}
        chapters={chapters}
        value={{
          internalName: chapter
            ? `Carnet #${String(chapter.number).padStart(3, '0')}`
            : '',
          subject: chapter?.title ?? '',
          preheader: '',
          heading: chapter?.title ?? '',
          bodyMarkdown: '',
          ctaLabel: '',
          ctaUrl: '',
          chapterId: chapter?.id ?? '',
          ...(chapter &&
          deriveCarnet(parseCarnetContent(chapter.content)).excerpt
            ? {
                carnetSource: {
                  products: carnetProducts,
                  illustration: chapter.illustrationUrl
                    ? {
                        src: chapter.illustrationUrl,
                        alt: chapter.illustrationAlt ?? '',
                      }
                    : undefined,
                  id: chapter.id,
                  number: chapter.number,
                  title: chapter.title,
                  slug: chapter.slug,
                  html: deriveCarnet(parseCarnetContent(chapter.content))
                    .excerpt!.html,
                  text: deriveCarnet(parseCarnetContent(chapter.content))
                    .excerpt!.text,
                },
              }
            : {}),
        }}
      />
    </>
  );
}
