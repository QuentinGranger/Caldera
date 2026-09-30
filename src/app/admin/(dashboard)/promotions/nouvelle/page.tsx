import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { PageHeader } from '@/components/admin/AdminUI';
import { PromotionForm } from '@/components/admin/PromotionForm';
import { categoryOptions, getPromotionScopes } from '@/lib/promotions/admin';
import styles from '@/components/admin/Admin.module.scss';
import { requireAdmin } from '@/lib/admin/auth';

export default async function NewPromotionPage() {
  // The layout's check runs in parallel: never read data before this one.
  await requireAdmin();
  const [games, categories] = await getPromotionScopes();
  return (
    <>
      <PageHeader
        title="Nouveau code promo"
        description="Le client le saisit dans le récapitulatif de sa commande. La réduction est recalculée à chaque étape et vérifiée une dernière fois au passage au paiement."
      >
        <Link
          className={`${styles.button} ${styles.secondaryButton}`}
          href="/admin/promotions"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Codes promo
        </Link>
      </PageHeader>
      <section className={styles.card}>
        <PromotionForm
          locked={false}
          games={games}
          categories={categoryOptions(categories)}
          value={{
            code: '',
            label: '',
            type: 'PERCENTAGE',
            percentOff: '10',
            amountOff: '',
            minimumSubtotal: '',
            startsAt: '',
            endsAt: '',
            maxRedemptions: '',
            maxPerCustomer: '1',
            isActive: true,
            gameId: '',
            categoryId: '',
          }}
        />
      </section>
    </>
  );
}
