// Route guards of the silo pages: 404 and 308 answers around the resolutions,
// shared by generateMetadata and the page (the resolutions are request-cached).
import 'server-only';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { connection } from 'next/server';
import type { SearchParams } from '@/lib/catalog/params';
import { resolveCategoryHub, type CategoryHubView } from './categoryData';
import {
  getIndexedPages,
  resolveLanding,
  type LandingView,
} from './landingData';
import { withSearchParams } from './landingText';
import { resolveSetPage, type StandaloneSetView } from './releaseData';
import { getScopeStats } from '@/lib/seo/registry';
import { preordersEnabled } from '@/lib/catalog/preorders';

/** Temporary: publishing products in the admin restores the original page. */
export async function catalogFallback(gameSlug?: string): Promise<string> {
  if (gameSlug && (await getIndexedPages()).has(`/${gameSlug}`))
    return `/${gameSlug}`;
  return (await getScopeStats({})).productCount ? '/catalogue' : '/';
}

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
  if (segments.includes('precommandes') && !preordersEnabled())
    redirect(await catalogFallback(gameSlug));
  const view = await answer(
    await resolveLanding(gameSlug, segments.join('/')),
    searchParams,
  );
  if (!view.stats.productCount)
    redirect(await catalogFallback(segments.length ? gameSlug : undefined));
  return view;
}

/** /extensions/{slug}: 308 to the game silo, or the page of a set without game. */
export async function requireStandaloneSet(
  slug: string,
  searchParams: Promise<SearchParams>,
): Promise<StandaloneSetView> {
  await connection();
  const view = await answer(await resolveSetPage(slug), searchParams);
  if (!view.stats.productCount) redirect(await catalogFallback());
  return view;
}

/** /categorie/{slug} */
export async function requireCategoryHub(
  slug: string,
  searchParams: Promise<SearchParams>,
): Promise<CategoryHubView> {
  await connection();
  const view = await answer(await resolveCategoryHub(slug), searchParams);
  if (!view.stats.productCount) redirect(await catalogFallback());
  return view;
}
