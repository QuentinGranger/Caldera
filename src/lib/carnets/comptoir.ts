import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/admin/auth';
import { AdminError, uuid } from '@/lib/admin/validation';
export type CarnetProduct = {
  id: string;
  name: string;
  href: string;
  image: string;
  price: string;
  stock: number;
  eligible: boolean;
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
  return {
    id: p.id,
    name: p.name,
    href: `/produit/${p.slug}`,
    image: p.images[0]?.url ?? '',
    price: price
      ? `${p.variants.length > 1 ? 'À partir de ' : ''}${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(price))}`
      : '',
    stock,
    eligible:
      p.status === 'ACTIVE' &&
      !p.isDemonstration &&
      p.category.isActive &&
      stock > 0,
  };
}
export function comptoirIds(raw: string) {
  let ids: unknown;
  try {
    ids = JSON.parse(raw);
  } catch {
    throw new AdminError('Sélection du Comptoir invalide.');
  }
  if (!Array.isArray(ids) || ids.length > 3)
    throw new AdminError('Le Comptoir est limité à trois produits.');
  const result = ids.map((v) => {
    if (typeof v !== 'string') throw new AdminError('Produit invalide.');
    return uuid(v);
  });
  if (new Set(result).size !== result.length)
    throw new AdminError(
      'Un produit ne peut apparaître qu’une fois dans le Comptoir.',
    );
  return result;
}
export async function loadComptoir(
  tx: Prisma.TransactionClient,
  ids: string[],
  requireAvailable = true,
) {
  const rows = await tx.product.findMany({
    where: { id: { in: ids } },
    select,
  });
  const products = ids.map((id) => {
    const p = rows.find((p) => p.id === id);
    if (!p) throw new AdminError('Produit du Comptoir introuvable.');
    return option(p);
  });
  if (requireAvailable && products.some((p) => !p.eligible))
    throw new AdminError(
      'Un produit du Comptoir est indisponible ou non publié. Retirez-le ou remplacez-le.',
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
