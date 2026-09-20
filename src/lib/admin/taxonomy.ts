import 'server-only';
import { adminTransaction, audit } from './common';
import {
  AdminError,
  checked,
  date,
  id,
  integer,
  localImage,
  slug,
  text,
  whitelist,
} from './validation';
export async function saveCategory(adminId: string, form: FormData) {
  whitelist(form, [
    'id',
    'name',
    'slug',
    'description',
    'parentId',
    'sortOrder',
    'isActive',
  ]);
  const categoryId = id(form, 'id', true);
  const name = text(form, 'name');
  const data = {
    name,
    slug: slug(form, name),
    description: text(form, 'description', 2000, false) || null,
    parentId: id(form, 'parentId', true) || null,
    sortOrder: integer(form, 'sortOrder'),
    isActive: checked(form, 'isActive'),
  };
  return adminTransaction(adminId, async (tx) => {
    // Structural writes serialize; Serializable retries also protect against stale tree reads.
    await tx.$executeRaw`LOCK TABLE "Category" IN SHARE ROW EXCLUSIVE MODE`;
    const visited = new Set<string>(categoryId ? [categoryId] : []);
    let parent = data.parentId;
    while (parent) {
      if (visited.has(parent))
        throw new AdminError('Cette catégorie parente créerait un cycle.');
      visited.add(parent);
      const row = await tx.category.findUnique({
        where: { id: parent },
        select: { parentId: true },
      });
      if (!row) throw new AdminError('Catégorie parente introuvable.');
      parent = row.parentId;
    }
    const category = categoryId
      ? await tx.category.update({ where: { id: categoryId }, data })
      : await tx.category.create({ data });
    await audit(tx, adminId, 'CATEGORY_SAVED', 'Category', category.id, {
      isActive: data.isActive,
      parentId: data.parentId,
    });
    return category;
  });
}
export async function saveSet(adminId: string, form: FormData) {
  whitelist(form, [
    'id',
    'name',
    'slug',
    'code',
    'series',
    'description',
    'releaseDate',
    'logoUrl',
    'symbolUrl',
    'isActive',
  ]);
  const setId = id(form, 'id', true);
  const name = text(form, 'name');
  const data = {
    name,
    slug: slug(form, name),
    code: text(form, 'code', 50, false) || null,
    series: text(form, 'series', 200, false) || null,
    description: text(form, 'description', 2000, false) || null,
    releaseDate: date(form, 'releaseDate'),
    logoUrl: localImage(form, 'logoUrl'),
    symbolUrl: localImage(form, 'symbolUrl'),
    isActive: checked(form, 'isActive'),
  };
  return adminTransaction(adminId, async (tx) => {
    const set = setId
      ? await tx.tcgSet.update({ where: { id: setId }, data })
      : await tx.tcgSet.create({ data });
    await audit(tx, adminId, 'SET_SAVED', 'TcgSet', set.id, {
      isActive: data.isActive,
    });
    return set;
  });
}
