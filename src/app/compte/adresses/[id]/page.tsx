import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddressForm } from '@/components/account/CustomerForm';
import { requireCustomer } from '@/lib/auth/customer/session';
import { getPrisma } from '@/lib/db/prisma';
import { updateAddressAction } from '@/lib/customer/actions';
import styles from '@/components/account/Account.module.scss';
export const metadata: Metadata = {
  title: 'Modifier une adresse | Les Terres de Caldera',
  robots: { index: false, follow: false },
};
export default async function EditAddressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const customer = await requireCustomer();
  const { id } = await params;
  const address = await getPrisma().customerAddress.findFirst({
    where: { id, customerId: customer.id },
    select: {
      id: true,
      label: true,
      firstName: true,
      lastName: true,
      company: true,
      addressLine1: true,
      addressLine2: true,
      postalCode: true,
      city: true,
      region: true,
      countryCode: true,
      phone: true,
      isDefaultShipping: true,
      isDefaultBilling: true,
    },
  });
  if (!address) notFound();
  return (
    <>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>MON COMPTE</p>
        <h1>Modifier l’adresse</h1>
        <p>Mettez à jour cette adresse enregistrée.</p>
      </header>
      <section className={styles.card}>
        <AddressForm action={updateAddressAction} address={address} />
        <div className={styles.actions}>
          <Link className={styles.textLink} href="/compte/adresses">
            Retour aux adresses
          </Link>
        </div>
      </section>
    </>
  );
}
