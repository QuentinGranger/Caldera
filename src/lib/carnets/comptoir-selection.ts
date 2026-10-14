import { AdminError } from '@/lib/admin/errors';
export const MAX_COMPTOIR_PRODUCTS = 3;
/** The client and server share the same reference-only selection constraints. */
export function parseComptoirSelection(raw: unknown): string[] {
  let values: unknown = raw;
  if (typeof raw === 'string') {
    try {
      values = JSON.parse(raw);
    } catch {
      throw new AdminError('Sélection du Comptoir invalide.');
    }
  }
  if (!Array.isArray(values) || values.length > MAX_COMPTOIR_PRODUCTS)
    throw new AdminError('Le Comptoir est limité à trois produits.');
  const ids = values.map((value) => {
    if (
      typeof value !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
    )
      throw new AdminError('Identifiant de produit invalide.');
    return value;
  });
  if (new Set(ids.map((id) => id.toLowerCase())).size !== ids.length)
    throw new AdminError(
      'Un produit ne peut apparaître qu’une fois dans le Comptoir.',
    );
  return ids;
}
export function addComptoirProduct(ids: readonly string[], productId: string) {
  return parseComptoirSelection([...ids, productId]);
}
export function replaceComptoirProduct(
  ids: readonly string[],
  currentId: string,
  nextId: string,
) {
  if (!ids.includes(currentId))
    throw new AdminError('Le produit à remplacer n’est plus sélectionné.');
  return parseComptoirSelection(
    ids.map((id) => (id === currentId ? nextId : id)),
  );
}
export function reorderComptoirProduct(
  ids: readonly string[],
  sourceId: string,
  targetId: string,
) {
  const next = parseComptoirSelection([...ids]),
    from = next.indexOf(sourceId),
    to = next.indexOf(targetId);
  if (from < 0 || to < 0)
    throw new AdminError('Déplacement du Comptoir invalide.');
  next.splice(to, 0, next.splice(from, 1)[0]!);
  return next;
}
