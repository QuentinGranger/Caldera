import 'server-only';
import { ProductLanguage, ProductType } from '@/generated/prisma/client';
import { createSlug } from '@/lib/catalog/createSlug';
import { adminTransaction, audit, lockProduct } from './common';
import { changeStock } from './inventory';
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
    'featured',
    'newArrival',
    'preorder',
    'releaseDate',
    'publishedAt',
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
  };
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
          data: { ...data, tags: { set: connectedTags } },
        })
      : await tx.product.create({
          data: { ...data, status: 'DRAFT', tags: { connect: connectedTags } },
        });
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
          'featured',
          'newArrival',
          'preorder',
          'releaseDate',
          'publishedAt',
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
      if (!category?.isActive || (set && !set.isActive))
        throw new AdminError(
          'La catégorie et l’extension doivent être actives avant publication.',
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
