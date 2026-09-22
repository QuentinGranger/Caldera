'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';
import { getAdminAuth, requireAdmin } from './auth';
import { allowLogin } from './login';
import { AdminError, text, whitelist } from './validation';
import type { AdminActionState } from './action-types';
import { saveProduct, saveVariant, changePublication } from './products';
import { adjustStock } from './inventory';
import { saveCategory, saveSet } from './taxonomy';
import { editImage, uploadImage } from './images';
import { cancelAdminOrder, saveOrderNote } from './orders';
import { saveBusinessPilotage } from './pilotage';

function failure(error: unknown): AdminActionState {
  if (error instanceof AdminError)
    return { success: false, message: error.message };
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
    return {
      success: false,
      message: 'Ce slug, SKU, code ou code-barres est déjà utilisé.',
    };
  console.error('Admin mutation failed', {
    code:
      error instanceof Prisma.PrismaClientKnownRequestError
        ? error.code
        : 'UNEXPECTED',
  });
  return {
    success: false,
    message: 'Enregistrement impossible. Rechargez la page puis réessayez.',
  };
}
async function invalidateCatalog(productId?: string, previousSlug?: string) {
  revalidatePath('/');
  revalidatePath('/catalogue');
  revalidatePath('/categorie/[slug]', 'page');
  revalidatePath('/extensions/[slug]', 'page');
  revalidatePath('/nouveautes');
  revalidatePath('/extensions');
  revalidatePath('/precommandes');
  if (previousSlug) revalidatePath(`/produit/${previousSlug}`);
  if (productId) {
    const product = await getPrisma().product.findUnique({
      where: { id: productId },
      select: { slug: true },
    });
    if (product) revalidatePath(`/produit/${product.slug}`);
    revalidatePath(`/admin/produits/${productId}`);
  } else revalidatePath('/produit/[slug]', 'page');
  revalidatePath('/admin');
  revalidatePath('/admin/produits');
  revalidatePath('/admin/stocks');
}
export async function loginAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  try {
    whitelist(form, ['email', 'password']);
    const email = text(form, 'email', 254).toLowerCase();
    const password = form.get('password');
    if (
      typeof password !== 'string' ||
      password.length < 12 ||
      password.length > 128 ||
      !(await allowLogin(email))
    )
      return {
        success: false,
        message:
          'Connexion impossible. Vérifiez vos identifiants ou réessayez dans quelques minutes.',
      };
    const result = await getAdminAuth().api.signInEmail({
      headers: await headers(),
      body: { email, password },
    });
    const admin = await getPrisma().adminUser.findFirst({
      where: { id: result.user.id, isActive: true, role: 'ADMIN' },
      select: { id: true },
    });
    if (!admin) return { success: false, message: 'Identifiants incorrects.' };
    await getPrisma().adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });
  } catch {
    return { success: false, message: 'Identifiants incorrects.' };
  }
  redirect('/admin');
}
export async function logoutAction() {
  await getAdminAuth().api.signOut({ headers: await headers() });
  redirect('/admin/login');
}
export async function saveProductAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    const result = await saveProduct(admin.id, form);
    await invalidateCatalog(result.product.id, result.previousSlug);
    return {
      success: true,
      message: 'Produit enregistré.',
      redirectTo: form.get('id')
        ? undefined
        : `/admin/produits/${result.product.id}`,
    };
  } catch (error) {
    return failure(error);
  }
}
export async function publicationAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    const product = await changePublication(admin.id, form);
    await invalidateCatalog(product.id);
    return { success: true, message: 'Publication mise à jour.' };
  } catch (error) {
    return failure(error);
  }
}
export async function saveVariantAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    const variant = await saveVariant(admin.id, form);
    await invalidateCatalog(variant.productId);
    return { success: true, message: 'Variante enregistrée.' };
  } catch (error) {
    return failure(error);
  }
}
export async function adjustStockAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    const variant = await adjustStock(admin.id, form);
    await invalidateCatalog(variant.productId);
    return {
      success: true,
      message: 'Stock mis à jour et ajustement enregistré.',
    };
  } catch (error) {
    return failure(error);
  }
}
export async function saveCategoryAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    await saveCategory(admin.id, form);
    await invalidateCatalog();
    revalidatePath('/admin/categories');
    return { success: true, message: 'Catégorie enregistrée.' };
  } catch (error) {
    return failure(error);
  }
}
export async function saveSetAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    await saveSet(admin.id, form);
    await invalidateCatalog();
    revalidatePath('/admin/extensions');
    return { success: true, message: 'Extension enregistrée.' };
  } catch (error) {
    return failure(error);
  }
}
export async function uploadImageAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    const image = await uploadImage(admin.id, form);
    await invalidateCatalog(image.productId);
    return { success: true, message: 'Image téléversée.' };
  } catch (error) {
    return failure(error);
  }
}
export async function editImageAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    const image = await editImage(admin.id, form);
    await invalidateCatalog(image.productId);
    return { success: true, message: 'Image enregistrée.' };
  } catch (error) {
    return failure(error);
  }
}
export async function deleteImageAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    const image = await editImage(admin.id, form, true);
    await invalidateCatalog(image.productId);
    return { success: true, message: 'Image retirée de la galerie.' };
  } catch (error) {
    return failure(error);
  }
}
export async function orderNoteAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    const orderId = await saveOrderNote(admin.id, form);
    revalidatePath(`/admin/commandes/${orderId}`);
    return { success: true, message: 'Note interne enregistrée.' };
  } catch (error) {
    return failure(error);
  }
}
export async function cancelOrderAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    const orderId = await cancelAdminOrder(admin.id, form);
    revalidatePath(`/admin/commandes/${orderId}`);
    revalidatePath('/admin/commandes');
    await invalidateCatalog();
    return { success: true, message: 'Commande annulée.' };
  } catch (error) {
    return failure(error);
  }
}

export async function saveBusinessPilotageAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  try {
    await saveBusinessPilotage(form);
    revalidatePath('/admin');
    revalidatePath('/admin/pilotage');
    return {
      success: true,
      message: 'Modèle économique enregistré.',
    };
  } catch (error) {
    return failure(error);
  }
}
