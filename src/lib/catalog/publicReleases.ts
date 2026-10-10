import 'server-only';

/** Development fixtures must never become public release announcements. */
export function visibleSetInEnvironment(set: {
  slug: string;
  name: string;
}): boolean {
  return (
    process.env.NODE_ENV !== 'production' ||
    !(set.slug.startsWith('dev-') || set.name.trimStart().startsWith('[Démo]'))
  );
}
