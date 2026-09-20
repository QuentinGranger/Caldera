/** Aide à la saisie ; UNIQUE PostgreSQL tranche les collisions concurrentes. */
export function createSlug(
  name: string,
  existing: Iterable<string> = [],
): string {
  const base =
    name
      .toLowerCase()
      .replace(/œ/g, 'oe')
      .replace(/æ/g, 'ae')
      .replace(/ß/g, 'ss')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100)
      .replace(/-+$/, '') || 'produit';
  const occupied = new Set(existing);
  let slug = base;
  for (let suffix = 2; occupied.has(slug); suffix++) slug = `${base}-${suffix}`;
  return slug;
}
