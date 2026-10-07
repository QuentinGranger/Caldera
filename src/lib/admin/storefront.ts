import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { visibleProductWhere } from '@/lib/catalog/queries';
import { isShopGame, shopProductWhere } from '@/lib/catalog/shopGame';
import { getPrisma } from '@/lib/db/prisma';
import { requireAdmin } from './auth';

/**
 * Listed in the shop: the catalogue's own rules (published, every parent
 * active, an active variant) and the licence sold. Products outside it can
 * still be published: these are the ones to explain.
 */
export const storefrontProductWhere: Prisma.ProductWhereInput = {
  AND: [visibleProductWhere, shopProductWhere],
};
export const hiddenPublishedWhere: Prisma.ProductWhereInput = {
  status: 'ACTIVE',
  NOT: storefrontProductWhere,
};

export type StorefrontCheck = {
  label: string;
  /** ok: nothing to do; warn: shown but degraded; block: kept out of the shop. */
  state: 'ok' | 'warn' | 'block';
  text: string;
  href?: string;
};

/** How a product meets the shop, rule by rule, with the way to fix each. */
export async function getStorefrontStatus(productId: string) {
  await requireAdmin();
  return readStorefrontStatus(productId);
}

/** The same, without the session check: for tests and scripts. */
export async function readStorefrontStatus(productId: string) {
  const db = getPrisma();
  const [product, listed] = await Promise.all([
    db.product.findUniqueOrThrow({
      where: { id: productId },
      select: {
        status: true,
        preorder: true,
        category: { select: { name: true, isActive: true } },
        game: { select: { name: true, slug: true, isActive: true } },
        tcgSet: { select: { name: true, isActive: true } },
        variants: {
          where: { isActive: true },
          select: { price: true, availableQuantity: true },
        },
        _count: { select: { images: true } },
      },
    }),
    db.product.count({ where: { id: productId, ...storefrontProductWhere } }),
  ]);
  const checks: StorefrontCheck[] = [
    product.status === 'ACTIVE'
      ? { label: 'Publication', state: 'ok', text: 'Publié.' }
      : {
          label: 'Publication',
          state: 'block',
          text:
            product.status === 'DRAFT'
              ? 'Brouillon : seule l’administration le voit.'
              : 'Archivé : sa page redirige vers sa famille, ou indique qu’il est retiré.',
          href: '#publication',
        },
    product.category.isActive
      ? { label: 'Catégorie', state: 'ok', text: product.category.name }
      : {
          label: 'Catégorie',
          state: 'block',
          text: `« ${product.category.name} » est désactivée.`,
          href: '/admin/categories',
        },
  ];
  if (product.game)
    checks.push(
      !product.game.isActive
        ? {
            label: 'Jeu',
            state: 'block',
            text: `« ${product.game.name} » est désactivé.`,
            href: '/admin/jeux',
          }
        : !isShopGame([product.game.slug])
          ? {
              label: 'Jeu',
              state: 'block',
              text: `« ${product.game.name} » n’est pas une licence vendue par la boutique.`,
              href: '#informations',
            }
          : { label: 'Jeu', state: 'ok', text: product.game.name },
    );
  if (product.tcgSet)
    checks.push(
      product.tcgSet.isActive
        ? { label: 'Extension', state: 'ok', text: product.tcgSet.name }
        : {
            label: 'Extension',
            state: 'block',
            text: `« ${product.tcgSet.name} » est désactivée.`,
            href: '/admin/extensions',
          },
    );
  const available = product.variants.reduce(
    (sum, variant) => sum + variant.availableQuantity,
    0,
  );
  checks.push(
    !product.variants.length
      ? {
          label: 'Variantes',
          state: 'block',
          text: 'Aucune variante active : rien à acheter.',
          href: '#variantes',
        }
      : product.variants.some((variant) => variant.price.lte(0))
        ? {
            label: 'Prix',
            state: 'block',
            text: 'Une variante active est à 0 € : corrigez son prix.',
            href: '#variantes',
          }
        : {
            label: 'Disponibilité',
            state: available > 0 || product.preorder ? 'ok' : 'warn',
            text:
              available > 0
                ? `${available} en stock.`
                : product.preorder
                  ? 'En précommande.'
                  : 'Rupture : affiché, sans achat possible ; les clients peuvent demander une alerte.',
            href: available > 0 || product.preorder ? undefined : '#variantes',
          },
    product._count.images
      ? {
          label: 'Images',
          state: 'ok',
          text: `${product._count.images} image${product._count.images > 1 ? 's' : ''}.`,
        }
      : {
          label: 'Images',
          state: 'warn',
          text: 'Aucune image : un visuel générique est affiché.',
          href: '#images',
        },
  );
  // The catalogue's verdict is the reference: explain any rule left unnamed.
  if (!listed && checks.every((check) => check.state !== 'block'))
    checks.push({
      label: 'Licence',
      state: 'block',
      text: 'Son extension appartient à une licence que la boutique ne vend pas.',
      href: '#informations',
    });
  return { listed: listed > 0, checks };
}
