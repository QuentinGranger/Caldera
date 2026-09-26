import 'server-only';
import {
  type Prisma,
  ProductLanguage,
  ProductType,
} from '@/generated/prisma/client';
import { createSlug } from '@/lib/catalog/createSlug';
import { recordSlugChange } from '@/lib/seo/redirects';
import { adminTransaction, audit, lockProduct } from './common';
import { changeStock } from './inventory';
import { seoMetaFields } from './seo';
import {
  AdminError,
  checked,
  choice,
  date,
  id,
  integer,
  money,
  slug,
  text,
  whitelist,
} from './validation';
/** The game of a set wins: empty means inherited, a different game is refused. */
async function productGame(
  tx: Prisma.TransactionClient,
  tcgSetId: string | null,
  requestedGameId: string | null,
) {
  const set = tcgSetId
    ? await tx.tcgSet.findUnique({
        where: { id: tcgSetId },
        select: { name: true, gameId: true, game: { select: { name: true } } },
      })
    : null;
  if (tcgSetId && !set) throw new AdminError('Extension introuvable.');
  if (set?.gameId) {
    if (requestedGameId && requestedGameId !== set.gameId)
      throw new AdminError(
        `L’extension « ${set.name} » appartient au jeu « ${set.game?.name ?? ''} » : le produit doit être rattaché à ce jeu.`,
      );
    return set.gameId;
  }
  if (
    requestedGameId &&
    !(await tx.game.findUnique({
      where: { id: requestedGameId },
      select: { id: true },
    }))
  )
    throw new AdminError('Jeu introuvable.');
  return requestedGameId;
}
export async function saveProduct(adminId: string, form: FormData) {
  whitelist(form, [
    'id',
    'name',
    'slug',
    'description',
    'shortDescription',
    'productType',
    'categoryId',
    'tcgSetId',
    'gameId',
    'featured',
    'newArrival',
    'preorder',
    'releaseDate',
    'publishedAt',
    'seoTitle',
    'seoDescription',
    'tags',
    'version',
  ]);
  const productId = id(form, 'id', true);
  const name = text(form, 'name');
  const data = {
    name,
    slug: slug(form, name),
    description: text(form, 'description', 20000, false) || null,
    shortDescription: text(form, 'shortDescription', 500, false) || null,
    productType: choice(form, 'productType', Object.values(ProductType)),
    categoryId: id(form, 'categoryId')!,
    tcgSetId: id(form, 'tcgSetId', true) || null,
    featured: checked(form, 'featured'),
    newArrival: checked(form, 'newArrival'),
    preorder: checked(form, 'preorder'),
    releaseDate: date(form, 'releaseDate'),
    publishedAt: date(form, 'publishedAt'),
    ...seoMetaFields(form),
  };
  const requestedGameId = id(form, 'gameId', true) || null;
  const tags = [
    ...new Set(
      text(form, 'tags', 500, false)
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
  if (tags.length > 12 || tags.some((tag) => tag.length > 50))
    throw new AdminError('Maximum 12 tags de 50 caractères.');
  return adminTransaction(adminId, async (tx) => {
    const previous = productId ? await lockProduct(tx, productId) : null;
    if (previous && text(form, 'version') !== previous.updatedAt.toISOString())
      throw new AdminError(
        'Ce produit a été modifié. Rechargez avant d’enregistrer.',
      );
    const gameId = await productGame(tx, data.tcgSetId, requestedGameId);
    const connectedTags = [];
    for (const tag of tags)
      connectedTags.push(
        await tx.tag.upsert({
          where: { slug: createSlug(tag) },
          create: { name: tag, slug: createSlug(tag) },
          update: {},
          select: { id: true },
        }),
      );
    const product = previous
      ? await tx.product.update({
          where: { id: previous.id },
          data: { ...data, gameId, tags: { set: connectedTags } },
        })
      : await tx.product.create({
          data: {
            ...data,
            gameId,
            status: 'DRAFT',
            tags: { connect: connectedTags },
          },
        });
    if (previous)
      await recordSlugChange(
        tx,
        'PRODUCT',
        product.id,
        previous.slug,
        product.slug,
      );
    await audit(
      tx,
      adminId,
      previous ? 'PRODUCT_UPDATED' : 'PRODUCT_CREATED',
      'Product',
      product.id,
      {
        fields: [
          'name',
          'slug',
          'description',
          'shortDescription',
          'productType',
          'categoryId',
          'tcgSetId',
          'gameId',
          'featured',
          'newArrival',
          'preorder',
          'releaseDate',
          'publishedAt',
          'seoTitle',
          'seoDescription',
          'tags',
        ],
        previousSlug: previous?.slug ?? null,
        nextSlug: product.slug,
      },
    );
    return { product, previousSlug: previous?.slug };
  });
}
export async function changePublication(adminId: string, form: FormData) {
  whitelist(form, ['id', 'status']);
  const productId = id(form)!;
  const status = choice(form, 'status', ['DRAFT', 'ACTIVE', 'ARCHIVED']);
  return adminTransaction(adminId, async (tx) => {
    const previous = await lockProduct(tx, productId);
    if (status === 'ACTIVE') {
      const valid = await tx.productVariant.count({
        where: {
          productId,
          isActive: true,
          price: { gte: 0 },
          sku: { not: '' },
        },
      });
      if (!valid)
        throw new AdminError(
          'Ajoutez au moins une variante active avec un SKU et un prix valide avant de publier.',
        );
      const category = await tx.category.findUnique({
        where: { id: previous.categoryId },
      });
      const set = previous.tcgSetId
        ? await tx.tcgSet.findUnique({ where: { id: previous.tcgSetId } })
        : null;
      const game = previous.gameId
        ? await tx.game.findUnique({ where: { id: previous.gameId } })
        : null;
      if (
        !category?.isActive ||
        (set && !set.isActive) ||
        (game && !game.isActive)
      )
        throw new AdminError(
          'La catégorie, l’extension et le jeu doivent être actifs avant publication.',
        );
    }
    const product = await tx.product.update({
      where: { id: productId },
      data: {
        status,
        publishedAt:
          status === 'ACTIVE'
            ? (previous.publishedAt ?? new Date())
            : previous.publishedAt,
      },
    });
    await audit(tx, adminId, 'PRODUCT_STATUS_CHANGED', 'Product', productId, {
      previous: previous.status,
      next: status,
    });
    return product;
  });
}
export async function saveVariant(adminId: string, form: FormData) {
  whitelist(form, [
    'id',
    'productId',
    'sku',
    'barcode',
    'language',
    'condition',
    'price',
    'compareAtPrice',
    'costPrice',
    'stockQuantity',
    'lowStockThreshold',
    'isActive',
    'isDefault',
    'weightGrams',
    'version',
  ]);
  const variantId = id(form, 'id', true);
  const productId = id(form, 'productId')!;
  const price = money(form, 'price')!;
  const compareAtPrice = money(form, 'compareAtPrice', true);
  if (compareAtPrice && compareAtPrice.lt(price))
    throw new AdminError(
      'L’ancien prix ne peut pas être inférieur au prix actuel.',
    );
  const data = {
    sku: text(form, 'sku', 100),
    barcode: text(form, 'barcode', 100, false) || null,
    language: choice(form, 'language', Object.values(ProductLanguage)),
    condition: choice(form, 'condition', ['NEW']),
    price,
    compareAtPrice,
    costPrice: money(form, 'costPrice', true),
    lowStockThreshold: integer(form, 'lowStockThreshold'),
    isActive: checked(form, 'isActive'),
    isDefault: checked(form, 'isDefault'),
    weightGrams: text(form, 'weightGrams', 10, false)
      ? integer(form, 'weightGrams')
      : null,
  };
  const initialStock = variantId ? 0 : integer(form, 'stockQuantity');
  if (variantId && form.has('stockQuantity'))
    throw new AdminError(
      'Utilisez un ajustement tracé pour modifier le stock.',
    );
  return adminTransaction(adminId, async (tx) => {
    await lockProduct(tx, productId);
    const previous = variantId
      ? await tx.productVariant.findFirst({
          where: { id: variantId, productId },
        })
      : null;
    if (variantId && !previous) throw new AdminError('Variante introuvable.');
    if (previous && text(form, 'version') !== previous.updatedAt.toISOString())
      throw new AdminError(
        'La variante a changé. Rechargez avant d’enregistrer.',
      );
    if (data.isDefault)
      await tx.productVariant.updateMany({
        where: { productId, isDefault: true },
        data: { isDefault: false },
      });
    const variant = previous
      ? await tx.productVariant.update({ where: { id: previous.id }, data })
      : await tx.productVariant.create({ data: { ...data, productId } });
    if (!previous && initialStock)
      await changeStock(tx, adminId, variant.id, {
        mode: 'delta',
        quantity: initialStock,
        type: 'RESTOCK',
        reason: 'Stock initial à la création de la variante.',
      });
    await audit(
      tx,
      adminId,
      previous ? 'VARIANT_UPDATED' : 'VARIANT_CREATED',
      'ProductVariant',
      variant.id,
      {
        previous: previous
          ? {
              price: previous.price.toFixed(2),
              isActive: previous.isActive,
              isDefault: previous.isDefault,
            }
          : null,
        next: {
          price: data.price.toFixed(2),
          isActive: data.isActive,
          isDefault: data.isDefault,
        },
        productId,
      },
    );
    return variant;
  });
}
