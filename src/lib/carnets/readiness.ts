import type {
  CarnetChapter,
  NewsletterCampaign,
} from '@/generated/prisma/client';
import type { CarnetProduct } from './comptoir';
import {
  deriveCarnet,
  parseCarnetContent,
  CARNET_CTA_LABEL,
  carnetUrl,
} from './content';
import { carnetPublicDate } from './dates';
import {
  parseNewsletterDocument,
  newsletterIssues,
  safeNewsletterLink,
} from '@/lib/newsletter/document';
import { PRODUCTION_SITE_URL } from '@/lib/site';

type Chapter = Pick<
  CarnetChapter,
  | 'content'
  | 'status'
  | 'revision'
  | 'updatedAt'
  | 'illustrationUrl'
  | 'illustrationAlt'
>;
type Campaign = Pick<NewsletterCampaign, 'subject' | 'preheader' | 'updatedAt'>;
export type EditorialTest = { createdAt: Date; metadata: unknown } | null;

/** Shared by the production dashboard and calendar; dates alone never validate a test. */
export function carnetReadiness(
  chapter: Chapter,
  campaign: Campaign | null,
  products: Pick<CarnetProduct, 'name' | 'eligible' | 'unavailableReason'>[],
  lastTest: EditorialTest,
) {
  let words = 0,
    excerptWords = 0;
  try {
    const derived = deriveCarnet(parseCarnetContent(chapter.content));
    words = derived.full.words;
    excerptWords = derived.excerpt?.words ?? 0;
  } catch {
    // Invalid legacy documents remain visible as editorial work to finish.
  }
  const metadata = lastTest?.metadata;
  const versioned =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? metadata
      : null;
  const testCurrent = Boolean(
    campaign &&
    lastTest &&
    (versioned && 'chapterRevision' in versioned
      ? versioned.chapterRevision === chapter.revision &&
        'campaignUpdatedAt' in versioned &&
        versioned.campaignUpdatedAt === campaign.updatedAt.toISOString()
      : lastTest.createdAt >= chapter.updatedAt &&
        lastTest.createdAt >= campaign.updatedAt),
  );
  const excerptReady = excerptWords > 0 && words > excerptWords;
  const chapterReady =
    ['READY', 'EARLY_ACCESS', 'PUBLIC'].includes(chapter.status) &&
    excerptReady;
  const illustrationReady = Boolean(
    chapter.illustrationUrl && chapter.illustrationAlt?.trim(),
  );
  const unavailable = products
    .filter((product) => !product.eligible)
    .map(({ name, unavailableReason }) => ({
      name,
      reason: unavailableReason,
    }));
  const emailReady = Boolean(
    campaign?.subject.trim() && campaign.preheader?.trim(),
  );
  return {
    chapterReady,
    excerptReady,
    excerptWords,
    illustrationReady,
    unavailable,
    emailReady,
    testCurrent,
  };
}

// The editor and server gate consume the same rules; generic Studio block checks stay authoritative.
export type DepartureCheck = {
  key: string;
  label: string;
  state: 'ok' | 'warning' | 'blocking';
  detail: string;
  action?: {
    label: string;
    target:
      | 'recit'
      | 'coupure'
      | 'illustration'
      | 'comptoir'
      | 'email'
      | 'diffusion'
      | 'test';
  };
};
export type DepartureChapter = Chapter & {
  title: string;
  slug: string;
  earlyAccessAt: Date | null;
  publicAt: Date | null;
  publishedAt?: Date | null;
};
export type DepartureCampaign = Campaign & {
  status: string;
  carnetCustomized: boolean;
  heading: string;
  bodyMarkdown: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
};
export function carnetChecklist(
  chapter: DepartureChapter,
  campaign: DepartureCampaign | null,
  products: Pick<
    CarnetProduct,
    'id' | 'name' | 'eligible' | 'unavailableReason'
  >[],
  context: {
    testCurrent: boolean;
    accessConfigured: boolean;
    dirty?: boolean;
    scheduleValidated?: boolean;
  },
  now = new Date(),
) {
  const ready = carnetReadiness(chapter, campaign, products, null);
  let full = 0,
    cut = false;
  try {
    const derived = deriveCarnet(parseCarnetContent(chapter.content));
    full = derived.full.words;
    cut = derived.cutIndex >= 0;
  } catch {}
  let calendar = false;
  try {
    calendar = Boolean(
      chapter.earlyAccessAt &&
      chapter.publicAt &&
      carnetPublicDate(chapter.earlyAccessAt).getTime() ===
        chapter.publicAt.getTime(),
    );
  } catch {}
  const dateValid = Boolean(
    chapter.earlyAccessAt &&
    Number.isFinite(chapter.earlyAccessAt.getTime()) &&
    (context.scheduleValidated ||
      campaign?.status !== 'DRAFT' ||
      chapter.publishedAt ||
      chapter.earlyAccessAt.getTime() >= now.getTime() + 60000),
  );
  const address =
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(chapter.slug) &&
    chapter.slug.length <= 120;
  const isStoryCta = (label: string | null, href: string | null) => {
    if (
      label?.trim().replaceAll("'", '’').toLocaleLowerCase('fr') !==
        CARNET_CTA_LABEL.toLocaleLowerCase('fr') ||
      !href ||
      !safeNewsletterLink(href)
    )
      return false;
    try {
      const url = new URL(href, PRODUCTION_SITE_URL);
      return (
        url.origin === PRODUCTION_SITE_URL &&
        url.pathname === carnetUrl(chapter.slug)
      );
    } catch {
      return false;
    }
  };
  let cta = address,
    genericIssues: string[] = [];
  if (campaign?.carnetCustomized) {
    cta = isStoryCta(campaign.ctaLabel, campaign.ctaUrl);
    try {
      const doc = parseNewsletterDocument(campaign.bodyMarkdown);
      if (doc) {
        genericIssues = newsletterIssues(doc);
        cta ||= doc.blocks.some(
          (b) =>
            (b.type === 'button' && isStoryCta(b.label, b.href)) ||
            (b.type === 'feature' && isStoryCta(b.label, b.href)) ||
            (b.type === 'columns' &&
              b.columns.some((c) => isStoryCta(c.label, c.href))),
        );
      } else if (!campaign.bodyMarkdown.trim())
        genericIssues = ['Ajoutez du contenu à la campagne.'];
      if (
        Boolean(campaign.ctaLabel) !== Boolean(campaign.ctaUrl) ||
        (campaign.ctaUrl && !safeNewsletterLink(campaign.ctaUrl))
      )
        genericIssues.push('Le bouton principal est incomplet ou invalide.');
    } catch {
      genericIssues = ['La composition newsletter est invalide.'];
    }
  }
  const checks: DepartureCheck[] = [];
  const add = (
    key: string,
    label: string,
    ok: boolean,
    detail: string,
    action?: DepartureCheck['action'],
    warning = false,
  ) =>
    checks.push({
      key,
      label,
      state: ok ? 'ok' : warning ? 'warning' : 'blocking',
      detail,
      action: ok ? undefined : action,
    });
  add(
    'excerpt',
    'Extrait entre 250 et 400 mots',
    ready.excerptWords >= 250 && ready.excerptWords <= 400,
    `${ready.excerptWords} mots · plage éditoriale conseillée`,
    { label: 'Ajuster l’extrait', target: 'coupure' },
    ready.excerptWords > 0,
  );
  add(
    'chapter',
    'Chapitre complet renseigné',
    full > 0 && (!cut || full > ready.excerptWords),
    `${full} mots · du récit doit rester après la coupure`,
    { label: 'Compléter le chapitre', target: 'recit' },
  );
  add(
    'cut',
    'Coupure newsletter placée',
    cut && ready.excerptReady,
    'Une coupure, avec du texte avant et après.',
    { label: 'Ajouter ou déplacer la coupure', target: 'coupure' },
  );
  add(
    'access',
    'Page anticipée accessible',
    address &&
      ready.chapterReady &&
      calendar &&
      dateValid &&
      context.accessConfigured,
    'Accès signé validé côté serveur ; ouverture à la date d’envoi, sans rendre le récit public avant terme.',
    { label: 'Vérifier l’accès et la date', target: 'diffusion' },
  );
  add(
    'public',
    'Publication publique prévue à J+14',
    calendar && dateValid,
    '14 jours calendaires à la même heure de Paris ; changements d’heure pris en compte.',
    { label: 'Choisir la date d’envoi', target: 'diffusion' },
  );
  add(
    'illustration',
    'Illustration présente + alt renseigné',
    ready.illustrationReady,
    'Image principale et alternative textuelle requises.',
    {
      label: chapter.illustrationUrl
        ? 'Ajouter un alt'
        : 'Ajouter l’illustration',
      target: 'illustration',
    },
  );
  add(
    'count',
    'Maximum 3 produits',
    products.length <= 3 &&
      new Set(products.map((p) => p.id)).size === products.length,
    `${products.length}/3 · Comptoir vide autorisé, sans doublon.`,
    { label: 'Réduire la sélection', target: 'comptoir' },
  );
  add(
    'products',
    'Produits encore disponibles',
    !ready.unavailable.length,
    ready.unavailable.length
      ? ready.unavailable
          .map((p) => `${p.name} : ${p.reason ?? 'indisponible'}`)
          .join(' · ')
      : products.length
        ? 'Produits et variantes actifs ; stock disponible après réservations.'
        : 'Comptoir vide : aucun produit requis.',
    { label: 'Remplacer le produit épuisé', target: 'comptoir' },
  );
  add(
    'cta',
    'CTA « Continuer l’expédition » présent',
    Boolean(campaign && cta),
    'Le bouton doit conduire au chapitre de cette édition.',
    { label: 'Corriger l’email', target: 'email' },
  );
  add(
    'email',
    'Objet email + preheader renseignés',
    ready.emailReady,
    'Ces deux champs sont partagés avec la campagne.',
    { label: 'Compléter l’objet et le preheader', target: 'email' },
  );
  add(
    'test',
    'Test email envoyé',
    context.testCurrent && !context.dirty,
    context.dirty
      ? 'Sauvegardez, puis testez cette nouvelle version.'
      : context.testCurrent
        ? 'Preuve d’envoi retrouvée pour le contenu actuel.'
        : 'Envoyez un test de la version actuelle.',
    { label: 'M’envoyer un test', target: 'test' },
  );
  add(
    'edition',
    'Édition enregistrée et prête',
    Boolean(
      campaign &&
      ready.chapterReady &&
      chapter.title.trim() &&
      address &&
      !context.dirty,
    ),
    'Enregistrez le Carnet avec le statut prêt éditorialement.',
    { label: 'Compléter et enregistrer l’édition', target: 'recit' },
  );
  if (campaign?.carnetCustomized)
    add(
      'composition',
      'Composition newsletter valide',
      !genericIssues.length,
      genericIssues.join(' · ') ||
        'Contrôles génériques du Campaign Studio validés.',
      { label: 'Corriger la composition', target: 'email' },
    );
  const blocking = checks.filter((c) => c.state === 'blocking');
  return {
    checks,
    canSchedule: !blocking.length,
    canTest: !blocking.some(
      (c) => !['test', 'access', 'public'].includes(c.key),
    ),
    blocking,
    warnings: checks.filter((c) => c.state === 'warning'),
  };
}

/** Product fields actually rendered in the tested email, shared with the editor. */
export function carnetProductTestValue({
  id,
  name,
  href,
  image,
  price,
}: Pick<CarnetProduct, 'id' | 'name' | 'href' | 'image' | 'price'>) {
  return { id, name, href, image, price };
}
