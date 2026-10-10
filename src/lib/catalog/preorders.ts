/** Explicit launch gate, independent of demo mode. Changing it requires a rebuild. */
export function preordersEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PREORDERS_ENABLED === 'true';
}

export function isPreorderContent(section: string, slug: string): boolean {
  return (
    (section === 'guides' && slug === 'precommander-produit-scelle') ||
    (section === 'glossaire' && slug === 'precommande')
  );
}
