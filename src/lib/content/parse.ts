// Front-matter validation and rendering of one content/{section}/{slug}.md file.
import { DESCRIPTION_MAX } from '@/lib/seo/metadata';
import type { FaqEntry } from '@/lib/seo/types';
import { renderDocument } from './markdown';
import { parseYamlFrontMatter } from './frontMatter';
import type { ContentKind, ContentPage, ContentSection } from './types';

export const CONTENT_SECTIONS: readonly ContentSection[] = [
  'guides',
  'glossaire',
  'questions',
  'actualites',
];
const SECTION_KINDS: Readonly<Record<ContentSection, readonly ContentKind[]>> =
  {
    guides: ['guide', 'comparatif', 'dossier'],
    glossaire: ['glossaire'],
    questions: ['question'],
    actualites: ['actualite'],
  };

export function contentSection(kind: ContentKind): ContentSection {
  if (kind === 'glossaire') return 'glossaire';
  if (kind === 'question') return 'questions';
  if (kind === 'actualite') return 'actualites';
  return 'guides';
}
/** Sections whose first paragraph is a short definition or answer. */
const LEAD_SECTIONS: readonly ContentSection[] = ['glossaire', 'questions'];
export function contentHref(section: ContentSection, slug: string): string {
  return `/${section}/${slug}`;
}

export class ContentError extends Error {
  override name = 'ContentError';
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FIELDS = new Set([
  'title',
  'description',
  'kind',
  'updated',
  'published',
  'games',
  'categories',
  'sets',
  'related',
  'faq',
]);
// The layout adds « | Caldera » through the title template.
const BRAND_SUFFIX = /[|–—-]\s*(?:les terres de )?caldera\s*$/i;

export interface ContentSource {
  section: ContentSection;
  /** File name without .md. */
  slug: string;
  source: string;
}

export interface ParsedContent {
  page: ContentPage;
  /** Rendered hrefs of the body links, for cross-file checks. */
  links: string[];
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function slugList(
  data: Record<string, unknown>,
  field: string,
  issues: string[],
): string[] {
  const value = data[field] ?? [];
  if (
    !Array.isArray(value) ||
    !value.every((slug) => typeof slug === 'string' && SLUG.test(slug))
  ) {
    issues.push(`« ${field} » doit être une liste de slugs`);
    return [];
  }
  const slugs = value as string[];
  const duplicates = slugs.filter((slug, i) => slugs.indexOf(slug) !== i);
  if (duplicates.length)
    issues.push(`« ${field} » répète ${[...new Set(duplicates)].join(', ')}`);
  return [...new Set(slugs)];
}

function dateValue(value: unknown): Date | null {
  const date =
    value instanceof Date
      ? value
      : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
        ? new Date(value)
        : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function faqList(value: unknown, issues: string[]): FaqEntry[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    issues.push('« faq » doit être une liste de { question, answer }');
    return [];
  }
  return value.flatMap((item, i) => {
    const entry =
      item && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {};
    const question = text(entry.question);
    const answer = text(entry.answer);
    const extra = Object.keys(entry).filter(
      (key) => key !== 'question' && key !== 'answer',
    );
    if (!question || !answer || extra.length) {
      issues.push(
        `« faq » n°${i + 1} : question et answer (textes non vides) attendus, rien d’autre`,
      );
      return [];
    }
    return [{ question, answer }];
  });
}

/** Parses and renders one file; throws a ContentError listing every problem. */
export function parseContentFile({
  section,
  slug,
  source,
}: ContentSource): ParsedContent {
  const file = `content/${section}/${slug}.md`;
  let data: Record<string, unknown>;
  let body: string;
  try {
    const parsed = parseYamlFrontMatter(source);
    data = parsed.data;
    body = parsed.content;
  } catch (error) {
    throw new ContentError(
      `${file} : front-matter YAML invalide (${error instanceof Error ? error.message : String(error)})`,
    );
  }

  const issues: string[] = [];
  if (!SLUG.test(slug))
    issues.push('nom de fichier invalide (minuscules, chiffres et tirets)');
  if (!Object.keys(data).length) issues.push('front-matter manquant');
  const unknown = Object.keys(data).filter((key) => !FIELDS.has(key));
  if (unknown.length) issues.push(`champs inconnus : ${unknown.join(', ')}`);

  const title = text(data.title);
  if (!title) issues.push('« title » manquant');
  else if (BRAND_SUFFIX.test(title))
    issues.push('« title » ne doit pas finir par la marque');
  const description = text(data.description);
  if (!description) issues.push('« description » manquante');
  else if (description.length > DESCRIPTION_MAX)
    issues.push(
      `« description » trop longue (${description.length} > ${DESCRIPTION_MAX} caractères)`,
    );
  const kinds = SECTION_KINDS[section];
  const kind = kinds.find((value) => value === data.kind);
  if (!kind) issues.push(`« kind » doit valoir ${kinds.join(' ou ')}`);
  const updated = dateValue(data.updated);
  if (!updated) issues.push('« updated » doit être une date AAAA-MM-JJ');
  const games = slugList(data, 'games', issues);
  const categories = slugList(data, 'categories', issues);
  const sets = slugList(data, 'sets', issues);
  const related = slugList(data, 'related', issues);
  if (related.includes(slug))
    issues.push('« related » cite le fichier lui-même');
  const faq = faqList(data.faq, issues);

  const document = renderDocument(body);
  if (!document.wordCount) issues.push('contenu vide');
  if (document.headingDepths.includes(1))
    issues.push('titre de niveau 1 interdit (le h1 vient de « title »)');
  if (document.rawHtml.length)
    issues.push(`HTML brut non autorisé : ${document.rawHtml.join(' ')}`);
  if (document.rejectedTargets.length)
    issues.push(
      `liens ou images refusés : ${document.rejectedTargets.join(', ')}`,
    );
  if (LEAD_SECTIONS.includes(section) && !document.lead)
    issues.push(
      section === 'glossaire'
        ? 'une définition commence par un paragraphe'
        : 'une question commence par un paragraphe de réponse directe',
    );
  const published =
    data.published === undefined ? updated : dateValue(data.published);
  if (section === 'actualites' && data.published === undefined)
    issues.push('« published » (date de publication) est obligatoire');
  else if (!published)
    issues.push('« published » doit être une date AAAA-MM-JJ');
  else if (updated && published > updated)
    issues.push('« published » est postérieure à « updated »');

  if (
    issues.length ||
    !title ||
    !description ||
    !kind ||
    !updated ||
    !published
  )
    throw new ContentError(`${file} : ${issues.join(' ; ')}`);
  return {
    page: {
      slug,
      kind,
      title,
      description,
      updated,
      published,
      games,
      categories,
      sets,
      related,
      faq,
      href: contentHref(section, slug),
      ...(LEAD_SECTIONS.includes(section) && document.lead
        ? { definition: document.lead }
        : {}),
      wordCount: document.wordCount,
      html: document.html,
      headings: document.headings,
    },
    links: document.links,
  };
}
