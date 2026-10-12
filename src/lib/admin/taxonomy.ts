import 'server-only';
import { imageStorage } from '@/lib/storage/images';
import { recordSlugChange } from '@/lib/seo/redirects';
import { adminTransaction, audit } from './common';
import {
  GAME_DESCRIPTION_MAX_LENGTH,
  GAME_SHORT_NAME_MAX_LENGTH,
} from './limits';
import { assertFacetSlug, assertGameSlug, editorialFields } from './seo';
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
const editorialKeys = ['intro', 'seoTitle', 'seoDescription', 'faq'] as const;
export async function saveGame(adminId: string, form: FormData) {
  whitelist(form, [
    'id',
    'name',
    'slug',
    'shortName',
    'description',
    ...editorialKeys,
    'logoUrl',
    'logoFile',
    'sortOrder',
    'isActive',
  ]);
  const gameId = id(form, 'id', true);
  const name = text(form, 'name');
  const file = form.get('logoFile');
  if (file !== null && !(file instanceof File))
    throw new AdminError(
      'Sélectionnez le fichier du logo depuis votre ordinateur.',
    );
  const upload = file instanceof File && file.size > 0 ? file : null;
  if (upload && process.env.VERCEL && upload.size > 4 * 1024 * 1024)
    throw new AdminError('Logo trop lourd : 4 Mo maximum.');
  const data = {
    name,
    slug: slug(form, name),
    shortName:
      text(form, 'shortName', GAME_SHORT_NAME_MAX_LENGTH, false) || null,
    description:
      text(form, 'description', GAME_DESCRIPTION_MAX_LENGTH, false) || null,
    ...editorialFields(form),
    logoUrl: upload ? null : localImage(form, 'logoUrl'),
    sortOrder: integer(form, 'sortOrder'),
    isActive: checked(form, 'isActive'),
  };
  let uploadedUrl: string | null = null;
  if (upload) {
    // Validate permission and target before creating a blob, then recheck on save.
    await adminTransaction(adminId, async (tx) => {
      if (
        gameId &&
        !(await tx.game.findUnique({
          where: { id: gameId },
          select: { id: true },
        }))
      )
        throw new AdminError('Jeu introuvable.');
      await assertGameSlug(tx, data.slug, gameId);
    });
    uploadedUrl = await imageStorage.upload(upload);
    data.logoUrl = uploadedUrl;
  }
  try {
    return await adminTransaction(adminId, async (tx) => {
      const previous = gameId
        ? await tx.game.findUnique({
            where: { id: gameId },
            select: { slug: true },
          })
        : null;
      if (gameId && !previous) throw new AdminError('Jeu introuvable.');
      await assertGameSlug(tx, data.slug, gameId);
      const game = gameId
        ? await tx.game.update({ where: { id: gameId }, data })
        : await tx.game.create({ data });
      if (previous)
        await recordSlugChange(tx, 'GAME', game.id, previous.slug, game.slug);
      await audit(tx, adminId, 'GAME_SAVED', 'Game', game.id, {
        isActive: data.isActive,
        previousSlug: previous?.slug ?? null,
        nextSlug: game.slug,
      });
      return { game, previousSlug: previous?.slug };
    });
  } catch (error) {
    if (uploadedUrl) {
      await imageStorage.delete(uploadedUrl).catch(() => {
        console.error('Game logo cleanup failed', {
          code: 'GAME_LOGO_CLEANUP_FAILED',
        });
      });
    }
    throw error;
  }
}
export async function saveCategory(adminId: string, form: FormData) {
  whitelist(form, [
    'id',
    'name',
    'slug',
    'description',
    ...editorialKeys,
    'imageUrl',
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
    ...editorialFields(form),
    imageUrl: localImage(form, 'imageUrl'),
    parentId: id(form, 'parentId', true) || null,
    sortOrder: integer(form, 'sortOrder'),
    isActive: checked(form, 'isActive'),
  };
  return adminTransaction(adminId, async (tx) => {
    // Structural writes serialize; Serializable retries also protect against stale tree reads.
    await tx.$executeRaw`LOCK TABLE "Category" IN SHARE ROW EXCLUSIVE MODE`;
    const previous = categoryId
      ? await tx.category.findUnique({
          where: { id: categoryId },
          select: { slug: true },
        })
      : null;
    if (categoryId && !previous) throw new AdminError('Catégorie introuvable.');
    await assertFacetSlug(tx, 'category', data.slug, categoryId);
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
    if (previous)
      await recordSlugChange(
        tx,
        'CATEGORY',
        category.id,
        previous.slug,
        category.slug,
      );
    await audit(tx, adminId, 'CATEGORY_SAVED', 'Category', category.id, {
      isActive: data.isActive,
      parentId: data.parentId,
      previousSlug: previous?.slug ?? null,
      nextSlug: category.slug,
    });
    return category;
  });
}
export async function saveSet(adminId: string, form: FormData) {
  whitelist(form, [
    'id',
    'name',
    'slug',
    'gameId',
    'code',
    'series',
    'description',
    ...editorialKeys,
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
    gameId: id(form, 'gameId', true) || null,
    code: text(form, 'code', 50, false) || null,
    series: text(form, 'series', 200, false) || null,
    description: text(form, 'description', 2000, false) || null,
    ...editorialFields(form),
    releaseDate: date(form, 'releaseDate'),
    logoUrl: localImage(form, 'logoUrl'),
    symbolUrl: localImage(form, 'symbolUrl'),
    isActive: checked(form, 'isActive'),
  };
  return adminTransaction(adminId, async (tx) => {
    const previous = setId
      ? await tx.tcgSet.findUnique({
          where: { id: setId },
          select: { slug: true },
        })
      : null;
    if (setId && !previous) throw new AdminError('Extension introuvable.');
    await assertFacetSlug(tx, 'set', data.slug, setId);
    if (
      data.gameId &&
      !(await tx.game.findUnique({
        where: { id: data.gameId },
        select: { id: true },
      }))
    )
      throw new AdminError('Jeu introuvable.');
    const set = setId
      ? await tx.tcgSet.update({ where: { id: setId }, data })
      : await tx.tcgSet.create({ data });
    if (previous)
      await recordSlugChange(tx, 'SET', set.id, previous.slug, set.slug);
    // A product of a set that belongs to a game always belongs to that game.
    const reattached = data.gameId
      ? await tx.product.updateMany({
          where: {
            tcgSetId: set.id,
            OR: [{ gameId: null }, { gameId: { not: data.gameId } }],
          },
          data: { gameId: data.gameId },
        })
      : { count: 0 };
    await audit(tx, adminId, 'SET_SAVED', 'TcgSet', set.id, {
      isActive: data.isActive,
      gameId: data.gameId,
      previousSlug: previous?.slug ?? null,
      nextSlug: set.slug,
      productsReattached: reattached.count,
    });
    return set;
  });
}
