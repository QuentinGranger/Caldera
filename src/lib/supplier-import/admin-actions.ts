'use server';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@/generated/prisma/client';
import type { AdminActionState } from '@/lib/admin/action-types';
import { requireAdmin } from '@/lib/admin/auth';
import {
  AdminError,
  checked,
  choice,
  id,
  integer,
  text,
  uuid,
  whitelist,
} from '@/lib/admin/validation';
import { applyImport, revertImport } from './apply';
import { FIELDS, type FieldKey } from './fields';
import type { Language, Mapping } from './normalize';
import { CHUNK_SIZE } from './records';
import {
  aiReadPage,
  bulkDecide,
  cancelImport,
  changePage,
  changeSheet,
  correctRow,
  decideRow,
  deleteProfile,
  finishUpload,
  ocrStep,
  saveMapping,
  saveSupplier,
  startImport,
  uploadChunk,
  type RowDecision,
} from './service';
import { ImportFileError } from './table';

function message(error: unknown) {
  if (error instanceof AdminError || error instanceof ImportFileError)
    return error.message;
  console.error(
    JSON.stringify({
      scope: 'supplier-import',
      action: 'admin_mutation_failed',
      code:
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.code
          : 'UNEXPECTED',
    }),
  );
  return 'Action impossible. Rechargez la page puis réessayez.';
}

const failure = (error: unknown): AdminActionState => ({
  success: false,
  message: message(error),
});

function refresh() {
  revalidatePath('/admin/fournisseurs', 'layout');
}

// ------------------------------------------------------------ suppliers

export async function saveSupplierAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    whitelist(form, [
      'id',
      'name',
      'code',
      'email',
      'website',
      'notes',
      'isActive',
    ]);
    const supplierId = id(form, 'id', true);
    const email = text(form, 'email', 200, false);
    const website = text(form, 'website', 300, false);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new AdminError('Adresse e-mail invalide.');
    if (website && !/^https?:\/\/[^\s]+$/i.test(website))
      throw new AdminError('Site web : adresse complète (https://…).');
    const supplier = await saveSupplier(admin.id, supplierId, {
      name: text(form, 'name', 120),
      code: text(form, 'code', 12).toUpperCase(),
      email: email || null,
      website: website || null,
      notes: text(form, 'notes', 2000, false) || null,
      isActive: supplierId ? checked(form, 'isActive') : true,
    });
    refresh();
    return {
      success: true,
      message: 'Fournisseur enregistré.',
      redirectTo: supplierId ? undefined : `/admin/fournisseurs/${supplier.id}`,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteProfileAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    whitelist(form, ['id']);
    await deleteProfile(admin.id, id(form)!);
    refresh();
    return { success: true, message: 'Profil supprimé.' };
  } catch (error) {
    return failure(error);
  }
}

// --------------------------------------------------------------- upload

type UploadResult = { ok: true } | { ok: false; message: string };

export async function startImportAction(input: {
  supplierId: string;
  fileName: string;
  fileSize: number;
  fileHash: string;
  scope: string;
}): Promise<
  { ok: true; id: string; chunkSize: number } | { ok: false; message: string }
> {
  const admin = await requireAdmin();
  try {
    if (input.scope !== 'FULL' && input.scope !== 'PARTIAL')
      throw new AdminError('Périmètre du fichier invalide.');
    const created = await startImport(admin.id, {
      supplierId: uuid(String(input.supplierId)),
      fileName: String(input.fileName).trim(),
      fileSize: Number(input.fileSize),
      fileHash: String(input.fileHash),
      scope: input.scope,
    });
    return { ok: true, id: created.id, chunkSize: CHUNK_SIZE };
  } catch (error) {
    return { ok: false, message: message(error) };
  }
}

export async function uploadChunkAction(form: FormData): Promise<UploadResult> {
  await requireAdmin();
  try {
    whitelist(form, ['id', 'index', 'chunk']);
    const chunk = form.get('chunk');
    if (!(chunk instanceof Blob)) throw new AdminError('Morceau manquant.');
    await uploadChunk(
      id(form)!,
      integer(form, 'index', 0, 100),
      new Uint8Array(await chunk.arrayBuffer()),
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, message: message(error) };
  }
}

export async function finishUploadAction(
  importId: string,
): Promise<UploadResult> {
  await requireAdmin();
  try {
    await finishUpload(uuid(String(importId)));
    refresh();
    return { ok: true };
  } catch (error) {
    return { ok: false, message: message(error) };
  }
}

export async function ocrStepAction(
  importId: string,
): Promise<{ ok: true; remaining: number } | { ok: false; message: string }> {
  await requireAdmin();
  try {
    const result = await ocrStep(uuid(String(importId)));
    if (!result.remaining) refresh();
    return { ok: true, remaining: result.remaining };
  } catch (error) {
    return { ok: false, message: message(error) };
  }
}

// ----------------------------------------------------------- extraction

export async function pageAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  try {
    whitelist(form, ['id', 'page', 'change']);
    const change = choice(form, 'change', ['ignore', 'restore', 'local']);
    await changePage(id(form)!, integer(form, 'page', 1, 10000), change);
    refresh();
    return {
      success: true,
      message:
        change === 'ignore'
          ? 'Page ignorée : ses lignes sont retirées.'
          : 'Page reprise dans le tableau.',
    };
  } catch (error) {
    return failure(error);
  }
}

export async function aiPageAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    whitelist(form, ['id', 'page']);
    await aiReadPage(admin.id, id(form)!, integer(form, 'page', 1, 10000));
    refresh();
    return {
      success: true,
      message: 'Page relue par IA : vérifiez ses lignes dans l’aperçu.',
    };
  } catch (error) {
    return failure(error);
  }
}

export async function sheetAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  try {
    whitelist(form, ['id', 'sheet']);
    await changeSheet(id(form)!, text(form, 'sheet', 100));
    refresh();
    return { success: true, message: 'Feuille relue.' };
  } catch (error) {
    return failure(error);
  }
}

// --------------------------------------------------------------- mapping

const LANGUAGES = ['FR', 'EN', 'JP', 'DE', 'ES', 'IT', 'OTHER'] as const;
const VAT_RATES = ['20.00', '10.00', '5.50', '2.10', '0.00'] as const;

export async function mappingAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    whitelist(form, [
      'id',
      ...FIELDS.map((field) => `field:${field.key}`),
      'decimal',
      'dateOrder',
      'defaultLanguage',
      'defaultVatRate',
      'scope',
      'saveProfile',
      'profileName',
    ]);
    const mapping: Mapping = {};
    for (const field of FIELDS) {
      const column = text(form, `field:${field.key}`, 300, false);
      if (column) mapping[field.key] = column;
    }
    const language = text(form, 'defaultLanguage', 5, false);
    const rate = text(form, 'defaultVatRate', 6, false);
    if (language && !LANGUAGES.some((value) => value === language))
      throw new AdminError('Langue par défaut invalide.');
    if (rate && !VAT_RATES.some((value) => value === rate))
      throw new AdminError('Taux de TVA par défaut invalide.');
    await saveMapping(admin.id, id(form)!, {
      mapping,
      options: {
        decimal: choice(form, 'decimal', [',', '.']),
        dateOrder: choice(form, 'dateOrder', ['DMY', 'MDY']),
        defaultLanguage: (language || null) as Language | null,
        defaultVatRate: rate || null,
      },
      scope: choice(form, 'scope', ['FULL', 'PARTIAL']),
      profileName: checked(form, 'saveProfile')
        ? text(form, 'profileName', 120)
        : null,
    });
    refresh();
    return {
      success: true,
      message: 'Fichier analysé : vérifiez l’aperçu ci-dessous.',
    };
  } catch (error) {
    return failure(error);
  }
}

// ---------------------------------------------------------------- review

export async function decisionAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    whitelist(form, ['id', 'row', 'decision', 'sku']);
    const value = text(form, 'decision', 60);
    let decision: RowDecision;
    if (value.startsWith('link:'))
      decision = { kind: 'link', variantId: uuid(value.slice(5)) };
    else if (value === 'sku')
      decision = { kind: 'link-sku', sku: text(form, 'sku', 64) };
    else if (value === 'create' || value === 'offer' || value === 'ignore')
      decision = { kind: value };
    else throw new AdminError('Décision inconnue.');
    await decideRow(admin.id, id(form)!, id(form, 'row')!, decision);
    refresh();
    return { success: true, message: 'Décision enregistrée.' };
  } catch (error) {
    return failure(error);
  }
}

export async function correctionAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    whitelist(form, [
      'id',
      'row',
      ...FIELDS.map((field) => `fix:${field.key}`),
    ]);
    const corrections: Partial<Record<FieldKey, string>> = {};
    for (const field of FIELDS)
      if (form.has(`fix:${field.key}`))
        corrections[field.key] = text(form, `fix:${field.key}`, 500, false);
    const row = await correctRow(
      admin.id,
      id(form)!,
      id(form, 'row')!,
      corrections,
    );
    refresh();
    return {
      success: true,
      message: row.issues.some((issue) => issue.level === 'error')
        ? 'Correction enregistrée, mais la ligne a encore des erreurs.'
        : 'Correction enregistrée : ligne analysée à nouveau.',
    };
  } catch (error) {
    return failure(error);
  }
}

export async function bulkAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    whitelist(form, ['id', 'kind']);
    const count = await bulkDecide(
      admin.id,
      id(form)!,
      choice(form, 'kind', [
        'confirm-probable',
        'offers-only',
        'ignore-review',
      ]),
    );
    refresh();
    return {
      success: true,
      message: `${count} ligne${count > 1 ? 's' : ''} mise${count > 1 ? 's' : ''} à jour.`,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function applyAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    whitelist(form, ['id', 'ignoreReview']);
    const report = await applyImport(admin.id, id(form)!, {
      ignoreReview: checked(form, 'ignoreReview'),
    });
    refresh();
    revalidatePath('/admin/produits');
    return {
      success: true,
      message: `Import appliqué : ${report.offersCreated} offre(s) créée(s), ${report.offersUpdated} mise(s) à jour, ${report.productsCreated} brouillon(s).`,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function revertAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    whitelist(form, ['id']);
    const report = await revertImport(admin.id, id(form)!);
    refresh();
    revalidatePath('/admin/produits');
    return {
      success: true,
      message: `Import défait : ${report.offersRestored} offre(s) restaurée(s), ${report.offersDeleted} supprimée(s), ${report.productsDeleted} brouillon(s) supprimé(s).`,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function cancelAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    whitelist(form, ['id']);
    await cancelImport(admin.id, id(form)!);
    refresh();
    return {
      success: true,
      message: 'Import abandonné.',
      redirectTo: '/admin/fournisseurs',
    };
  } catch (error) {
    return failure(error);
  }
}
