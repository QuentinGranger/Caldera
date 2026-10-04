const BASE_URL = process.env.QA_BASE_URL || process.env.TEST_BASE_URL || 'http://localhost:3001';

async function discoverProduct() {
  const response = await fetch(`${BASE_URL}/catalogue`);
  if (!response.ok) throw new Error(`Catalogue indisponible (${response.status})`);
  const html = await response.text();
  const match = html.match(/href=["'](\/produit\/[^"'?#]+)["']/);
  if (!match?.[1]) throw new Error('Aucune fiche produit détectée depuis /catalogue');
  return match[1];
}

export async function getQaTargets() {
  const product = await discoverProduct();
  return [
    { id: 'accueil', path: '/', immersive: true },
    { id: 'catalogue', path: '/catalogue', immersive: true },
    { id: 'pokemon', path: '/pokemon', immersive: true },
    { id: 'categorie', path: '/pokemon/boosters', immersive: true },
    { id: 'extensions', path: '/extensions', immersive: true },
    { id: 'calendrier', path: '/calendrier-des-sorties', immersive: true },
    { id: 'produit', path: product, immersive: false },
    { id: 'panier', path: '/panier', immersive: false },
  ];
}

export const qaBaseUrl = BASE_URL;
