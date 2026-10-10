/**
 * Hard launch gate: preorders stay unavailable until the business is actually
 * ready to operate them. The public env flag alone must never expose preorder
 * filters, pages or purchasing before this is deliberately switched to true.
 */
const PREORDERS_OPERATIONAL = false;

export function preordersEnabled(): boolean {
  return (
    PREORDERS_OPERATIONAL &&
    process.env.NEXT_PUBLIC_PREORDERS_ENABLED === 'true'
  );
}

export function isPreorderContent(section: string, slug: string): boolean {
  return (
    (section === 'guides' && slug === 'precommander-produit-scelle') ||
    (section === 'glossaire' && slug === 'precommande')
  );
}
