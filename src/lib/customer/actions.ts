'use server';

import { revalidatePath } from 'next/cache';
import { getPrisma } from '@/lib/db/prisma';
import { requireCustomer } from '@/lib/auth/customer/session';

export type CustomerActionState = { success: boolean; message: string };
const success = (message: string): CustomerActionState => ({
  success: true,
  message,
});
const failure = (message: string): CustomerActionState => ({
  success: false,
  message,
});

function addressData(formData: FormData) {
  const text = (name: string, max: number, required = true) => {
    const value = String(formData.get(name) ?? '').trim();
    if (required && !value)
      throw new Error('Complétez les champs obligatoires de l’adresse.');
    if (value.length > max)
      throw new Error('Un champ d’adresse est trop long.');
    return value || null;
  };
  const countryCode = String(formData.get('countryCode') ?? 'FR')
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error('Pays invalide.');
  return {
    label: text('label', 60) ?? 'Adresse',
    firstName: text('firstName', 80)!,
    lastName: text('lastName', 80)!,
    company: text('company', 120, false),
    addressLine1: text('addressLine1', 160)!,
    addressLine2: text('addressLine2', 160, false),
    postalCode: text('postalCode', 20)!,
    city: text('city', 100)!,
    region: text('region', 100, false),
    countryCode,
    phone: text('phone', 32, false),
    isDefaultShipping: formData.get('isDefaultShipping') === 'on',
    isDefaultBilling: formData.get('isDefaultBilling') === 'on',
  };
}

export async function createAddressAction(
  _state: CustomerActionState,
  formData: FormData,
) {
  try {
    const customer = await requireCustomer();
    const data = addressData(formData);
    await getPrisma().$transaction(async (tx) => {
      if (data.isDefaultShipping)
        await tx.customerAddress.updateMany({
          where: { customerId: customer.id },
          data: { isDefaultShipping: false },
        });
      if (data.isDefaultBilling)
        await tx.customerAddress.updateMany({
          where: { customerId: customer.id },
          data: { isDefaultBilling: false },
        });
      await tx.customerAddress.create({
        data: { customerId: customer.id, ...data },
      });
    });
    revalidatePath('/compte/adresses');
    return success('Adresse ajoutée.');
  } catch (error) {
    return failure(
      error instanceof Error
        ? error.message
        : 'Impossible d’ajouter cette adresse.',
    );
  }
}

export async function updateAddressAction(
  _state: CustomerActionState,
  formData: FormData,
) {
  try {
    const customer = await requireCustomer();
    const id = String(formData.get('id') ?? '');
    if (!/^[0-9a-f-]{36}$/.test(id)) return failure('Adresse introuvable.');
    const data = addressData(formData);
    await getPrisma().$transaction(async (tx) => {
      const owned = await tx.customerAddress.findFirst({
        where: { id, customerId: customer.id },
        select: { id: true },
      });
      if (!owned) throw new Error('Adresse introuvable.');
      if (data.isDefaultShipping)
        await tx.customerAddress.updateMany({
          where: { customerId: customer.id, NOT: { id } },
          data: { isDefaultShipping: false },
        });
      if (data.isDefaultBilling)
        await tx.customerAddress.updateMany({
          where: { customerId: customer.id, NOT: { id } },
          data: { isDefaultBilling: false },
        });
      await tx.customerAddress.update({ where: { id }, data });
    });
    revalidatePath('/compte/adresses');
    return success('Adresse mise à jour.');
  } catch (error) {
    return failure(
      error instanceof Error
        ? error.message
        : 'Impossible de modifier cette adresse.',
    );
  }
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const customer = await requireCustomer();
  const id = String(formData.get('id') ?? '');
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  await getPrisma().customerAddress.deleteMany({
    where: { id, customerId: customer.id },
  });
  revalidatePath('/compte/adresses');
}

export async function setDefaultAddressAction(
  formData: FormData,
): Promise<void> {
  try {
    const customer = await requireCustomer();
    const id = String(formData.get('id') ?? '');
    const role = formData.get('role') === 'billing' ? 'billing' : 'shipping';
    await getPrisma().$transaction(async (tx) => {
      const owned = await tx.customerAddress.findFirst({
        where: { id, customerId: customer.id },
        select: { id: true },
      });
      if (!owned) throw new Error('Adresse introuvable.');
      await tx.customerAddress.updateMany({
        where: { customerId: customer.id },
        data:
          role === 'shipping'
            ? { isDefaultShipping: false }
            : { isDefaultBilling: false },
      });
      await tx.customerAddress.update({
        where: { id },
        data:
          role === 'shipping'
            ? { isDefaultShipping: true }
            : { isDefaultBilling: true },
      });
    });
    revalidatePath('/compte/adresses');
    return;
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Impossible de définir cette adresse par défaut.',
    );
  }
}
