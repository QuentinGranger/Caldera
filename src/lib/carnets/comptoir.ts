import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/admin/auth';
import { parseComptoirSelection } from './comptoir-selection';
import { AdminError } from '@/lib/admin/validation';
export type CarnetProduct = {
  id: string;
  name: string;
  href: string;
  image: string;
  price: string;
  stock: number;
  eligible: boolean;
  unavailableReason?: string;
};
const select = {
  id: true,
  name: true,
  slug: true,
  status: true,
  isDemonstration: true,
  category: { select: { isActive: true } },
  images: {
    take: 1,
    orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }],
    select: { url: true },
  },
  variants: {
    where: { isActive: true },
    orderBy: { price: 'asc' as const },
    select: { price: true, availableQuantity: true },
  },
} satisfies Prisma.ProductSelect;
function option(
  p: Prisma.ProductGetPayload<{ select: typeof select }>,
): CarnetProduct {
  const variants = p.variants.filter((v) => v.availableQuantity > 0);
  const stock = variants.reduce((sum, v) => sum + v.availableQuantity, 0);
  const price = (variants[0] ?? p.variants[0])?.price;
  const unavailableReason =
    p.status !== 'ACTIVE'
      ? 'produit non publié'
      : p.isDemonstration
        ? 'produit de démonstration'
        : !p.category.isActive
          ? 'catégorie inactive'
          : !p.variants.length
            ? 'aucune variante active'
            : stock <= 0
              ? 'épuisé (aucun stock disponible)'
              : undefined;
  return {
    id: p.id,
    name: p.name,
    href: `/produit/${p.slug}`,
    image: p.images[0]?.url ?? '',
    price: price
      ? `${p.variants.length > 1 ? 'À partir de ' : ''}${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(price))}`
      : '',
    stock,
    unavailableReason,
    eligible:
      p.status === 'ACTIVE' &&
      !p.isDemonstration &&
      p.category.isActive &&
      stock > 0,
  };
}
export const comptoirIds = (raw: string) => parseComptoirSelection(raw);
export async function loadComptoir(
  tx: Prisma.TransactionClient,
  ids: string[],
  requireAvailable = true,
) {
  ids = parseComptoirSelection(ids);
  const rows = await tx.product.findMany({
    where: { id: { in: ids } },
    select,
  });
  const products = ids.map((id) => {
    const p = rows.find((p) => p.id === id);
    if (!p) throw new AdminError('Produit du Comptoir introuvable.');
    return option(p);
  });
  const unavailable = products.find((p) => !p.eligible);
  if (requireAvailable && unavailable)
    throw new AdminError(
      `Envoi bloqué : le produit « ${unavailable.name} » est indisponible (${unavailable.unavailableReason ?? 'stock ou publication à vérifier'}). Remplacez-le ou supprimez-le du Comptoir.`,
    );
  return products;
}
export async function chapterComptoir(
  tx: Prisma.TransactionClient,
  chapterId: string,
  requireAvailable = true,
) {
  const refs = await tx.carnetComptoirProduct.findMany({
    where: { chapterId },
    orderBy: { position: 'asc' },
  });
  return loadComptoir(
    tx,
    refs.map((p) => p.productId),
    requireAvailable,
  );
}
export async function getCarnetProducts(selected: string[] = [], search = '') {
  await requireAdmin();
  selected = parseComptoirSelection(selected);
  const rows = await getPrisma().product.findMany({
    where: {
      OR: [
        {
          status: 'ACTIVE',
          isDemonstration: false,
          category: { isActive: true },
          variants: { some: { isActive: true, availableQuantity: { gt: 0 } } },
          ...(search
            ? {
                name: {
                  contains: search.slice(0, 120),
                  mode: 'insensitive' as const,
                },
              }
            : {}),
        },
        { id: { in: selected } },
      ],
    },
    select,
    take: 200,
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
  });
  const retained = selected.length
    ? await getPrisma().product.findMany({
        where: { id: { in: selected } },
        select,
      })
    : [];
  return [...retained, ...rows.filter((p) => !selected.includes(p.id))].map(
    option,
  );
}

/** One query for a month/reserve, using the same eligibility rules as queueing. */
export async function loadChapterComptoirs(
  tx: Prisma.TransactionClient,
  chapterIds: string[],
) {
  const refs = await tx.carnetComptoirProduct.findMany({
    where: { chapterId: { in: chapterIds } },
    orderBy: [{ chapterId: 'asc' }, { position: 'asc' }],
    select: { chapterId: true, product: { select } },
  });
  const result = new Map<string, CarnetProduct[]>();
  for (const ref of refs) {
    const products = result.get(ref.chapterId) ?? [];
    products.push(option(ref.product));
    result.set(ref.chapterId, products);
  }
  return result;
}
