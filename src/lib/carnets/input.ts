import {
  AdminError,
  choice,
  id,
  integer,
  text,
  whitelist,
  localImage,
} from '@/lib/admin/validation';
import { parseCarnetDate } from './dates';
import {
  deriveCarnet,
  parseCarnetContent,
  CarnetContentError,
  suggestCarnetSlug,
} from './content';
export function carnetInput(form: FormData) {
  whitelist(form, [
    'id',
    'revision',
    'number',
    'title',
    'slug',
    'arcTitle',
    'arcPosition',
    'arcTotal',
    'content',
    'status',
    'illustrationUrl',
    'illustrationAlt',
    'illustrationFile',
    'location',
    'earlyAccessAt',
    'publicAt',
  ]);
  const chapterId = id(form, 'id', true);
  const revision = integer(form, 'revision', 0, 2147483647);
  if (!chapterId && revision !== 0)
    throw new AdminError('Révision de création invalide.');
  const number = integer(form, 'number', 1, 999999);
  const title = text(form, 'title', 200);
  const slug =
    text(form, 'slug', 120, false) || suggestCarnetSlug(number, title);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new AdminError(
      'Slug : lettres minuscules, chiffres et tirets uniquement.',
    );
  const arcTitle = text(form, 'arcTitle', 200, false) || null;
  const position = text(form, 'arcPosition', 4, false),
    total = text(form, 'arcTotal', 4, false);
  const arcPosition = position ? integer(form, 'arcPosition', 1, 1000) : null;
  const arcTotal = total ? integer(form, 'arcTotal', 1, 1000) : null;
  if (
    Boolean(position) !== Boolean(total) ||
    (position && !arcTitle) ||
    (arcPosition !== null && arcTotal !== null && arcPosition > arcTotal)
  )
    throw new AdminError(
      'Renseignez l’arc et une position comprise entre 1 et le nombre total de chapitres.',
    );
  const status = choice(form, 'status', ['DRAFT', 'READY'] as const);
  let content;
  try {
    content = parseCarnetContent(text(form, 'content', 100000));
  } catch (error) {
    if (error instanceof CarnetContentError)
      throw new AdminError(error.message);
    throw error;
  }
  if (status === 'READY') {
    const derived = deriveCarnet(content);
    if (!derived.excerpt?.words || derived.full.words <= derived.excerpt.words)
      throw new AdminError(
        'Pour marquer le Carnet prêt, ajoutez une coupure avec du récit avant et après. Les longueurs recommandées ne bloquent pas l’enregistrement.',
      );
  }
  return {
    id: chapterId,
    revision,
    data: {
      number,
      title,
      slug,
      arcTitle,
      arcPosition,
      arcTotal,
      status,
      content,
      ...(form.has('illustrationUrl')
        ? { illustrationUrl: localImage(form, 'illustrationUrl') }
        : {}),
      ...(form.has('illustrationAlt')
        ? { illustrationAlt: text(form, 'illustrationAlt', 300, false) || null }
        : {}),
      ...(form.has('location')
        ? { location: text(form, 'location', 200, false) || null }
        : {}),
      ...(form.has('earlyAccessAt')
        ? {
            earlyAccessAt: parseCarnetDate(
              text(form, 'earlyAccessAt', 16, false),
              'Accès anticipé',
            ),
          }
        : {}),
      ...(form.has('publicAt')
        ? {
            publicAt: parseCarnetDate(
              text(form, 'publicAt', 16, false),
              'Publication publique',
            ),
          }
        : {}),
    },
  };
}
