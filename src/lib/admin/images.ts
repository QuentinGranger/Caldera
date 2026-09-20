import 'server-only';
import { imageStorage } from '@/lib/storage/images';
import { adminTransaction, audit, lockProduct } from './common';
import {
  AdminError,
  checked,
  id,
  integer,
  text,
  whitelist,
} from './validation';
export async function uploadImage(adminId: string, form: FormData) {
  whitelist(form, ['productId', 'file', 'alt']);
  const productId = id(form, 'productId')!;
  const alt = text(form, 'alt', 300, false);
  const file = form.get('file');
  if (!(file instanceof File)) throw new AdminError('Sélectionnez une image.');
  // Check permission before writing files, then check again in the persistence transaction.
  await adminTransaction(adminId, (tx) => lockProduct(tx, productId));
  const url = await imageStorage.upload(file);
  try {
    return await adminTransaction(adminId, async (tx) => {
      const product = await lockProduct(tx, productId);
      const aggregate = await tx.productImage.aggregate({
        where: { productId },
        _max: { sortOrder: true },
      });
      const primary = await tx.productImage.count({
        where: { productId, isPrimary: true },
      });
      const image = await tx.productImage.create({
        data: {
          productId,
          url,
          alt: alt || product.name,
          sortOrder: (aggregate._max.sortOrder ?? -1) + 1,
          isPrimary: primary === 0,
        },
      });
      await audit(tx, adminId, 'IMAGE_UPLOADED', 'Product', productId, {
        imageId: image.id,
      });
      return image;
    });
  } catch (error) {
    await imageStorage.delete(url);
    throw error;
  }
}
export async function editImage(
  adminId: string,
  form: FormData,
  remove = false,
) {
  whitelist(
    form,
    remove
      ? ['id', 'productId']
      : ['id', 'productId', 'alt', 'sortOrder', 'isPrimary'],
  );
  const imageId = id(form)!;
  const productId = id(form, 'productId')!;
  const result = await adminTransaction(adminId, async (tx) => {
    const product = await lockProduct(tx, productId);
    const image = await tx.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) throw new AdminError('Image introuvable.');
    if (remove) {
      await tx.productImage.delete({ where: { id: imageId } });
      if (image.isPrimary) {
        const next = await tx.productImage.findFirst({
          where: { productId },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        });
        if (next)
          await tx.productImage.update({
            where: { id: next.id },
            data: { isPrimary: true },
          });
      }
    } else {
      const isPrimary = checked(form, 'isPrimary') || image.isPrimary;
      if (isPrimary)
        await tx.productImage.updateMany({
          where: { productId, isPrimary: true },
          data: { isPrimary: false },
        });
      await tx.productImage.update({
        where: { id: imageId },
        data: {
          alt: text(form, 'alt', 300, false) || product.name,
          sortOrder: integer(form, 'sortOrder'),
          isPrimary,
        },
      });
    }
    await audit(
      tx,
      adminId,
      remove ? 'IMAGE_REMOVED' : 'IMAGE_UPDATED',
      'Product',
      productId,
      { imageId },
    );
    return image;
  });
  // Keep immutable blobs: a concurrent checkout may still snapshot the old URL.
  // Removing a gallery entry never destroys a historical order's image.
  return result;
}
