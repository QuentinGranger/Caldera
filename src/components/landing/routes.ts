// Route guards of the silo pages: 404 and 308 answers around the resolutions,
// shared by generateMetadata and the page (the resolutions are request-cached).
import 'server-only';
import { notFound, permanentRedirect } from 'next/navigation';
import { connection } from 'next/server';
import type { SearchParams } from '@/lib/catalog/params';
import {
  resolveCategoryHub,
  type CategoryHubView,
} from './categoryData';
import { resolveLanding, type LandingView } from './landingData';
import { withSearchParams } from './landingText';
import { resolveSetPage, type StandaloneSetView } from './releaseData';

type Resolution<T> =
  | { type: 'ok'; view: T }
  | { type: 'redirect'; path: string }
  | { type: 'not-found' };

async function answer<T>(
  resolution: Resolution<T>,
  searchParams: Promise<SearchParams>,
): Promise<T> {
  if (resolution.type === 'not-found') notFound();
  // The query (page, filters, tracking) follows the renamed or reordered path.
  if (resolution.type === 'redirect')
    permanentRedirect(withSearchParams(resolution.path, await searchParams));
  return resolution.view;
}

/** /{game} (no segment) and /{game}/{facets}. */
export async function requireLandingView(
  gameSlug: string,
  segments: readonly string[],
  searchParams: Promise<SearchParams>,
): Promise<LandingView> {
  await connection();
  return answer(
    await resolveLanding(gameSlug, segments.join('/')),
    searchParams,
  );
}

/** /extensions/{slug}: 308 to the game silo, or the page of a set without game. */
export async function requireStandaloneSet(
  slug: string,
  searchParams: Promise<SearchParams>,
): Promise<StandaloneSetView> {
  await connection();
  return answer(await resolveSetPage(slug), searchParams);
}

/** /categorie/{slug} */
export async function requireCategoryHub(
  slug: string,
  searchParams: Promise<SearchParams>,
): Promise<CategoryHubView> {
  await connection();
  return answer(await resolveCategoryHub(slug), searchParams);
}
