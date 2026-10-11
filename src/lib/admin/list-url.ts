import type { SearchParams } from './queries';

/** Changing one criterion keeps the current view and restarts pagination. */
export function adminListHref(
  path: string,
  params: SearchParams,
  changes: Record<string, string | undefined>,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value && key !== 'page')
      query.set(key, value);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value) query.set(key, value);
    else query.delete(key);
  }
  return `${path}${query.size ? `?${query}` : ''}`;
}
