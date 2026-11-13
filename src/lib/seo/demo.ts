/** Real public content may rank before sales open; example stock must not. */
export function isDemoIndexablePath(path: string) {
  if (
    [
      '/',
      '/liens',
      '/univers',
      '/contact',
      '/guides',
      '/glossaire',
      '/questions',
      '/actualites',
      '/cgv',
      '/mentions-legales',
      '/confidentialite',
    ].includes(path)
  )
    return true;
  return /^\/(guides|glossaire|questions|actualites|univers)\/[a-z0-9-]+(?:\/[a-z0-9-]+)?$/.test(
    path,
  );
}
