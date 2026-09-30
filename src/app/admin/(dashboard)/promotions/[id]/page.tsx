import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { AdminForm } from '@/components/admin/AdminForm';
import { Hidden } from '@/components/admin/AdminFields';
import {
  AdminTable,
  Badge,
  EmptyState,
  PageHeader,
} from '@/components/admin/AdminUI';
import { PromotionForm } from '@/components/admin/PromotionForm';
import { euros, formatDate } from '@/lib/admin/format';
import {
  categoryOptions,
  getAdminPromotion,
  getPromotionScopes,
  promotionFormValue,
} from '@/lib/promotions/admin';
import { deletePromotionAction } from '@/lib/promotions/admin-actions';
import { uuid } from '@/lib/admin/validation';
import styles from '@/components/admin/Admin.module.scss';
import { requireAdmin } from '@/lib/admin/auth';

export default async function AdminPromotionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // The layout's check runs in parallel: never read data before this one.
  await requireAdmin();
  const { id } = await params;
  let promotionId: string;
  try {
    promotionId = uuid(id);
  } catch {
    notFound();
  }
  const [promotion, [games, categories]] = await Promise.all([
    getAdminPromotion(promotionId),
    getPromotionScopes(),
  ]);
  if (!promotion) notFound();
  const used = promotion.redemptions.length > 0;
  return (
    <>
      <PageHeader
        title={promotion.code}
        description={`${promotion.label} · créé le ${formatDate(promotion.createdAt)}${promotion.createdBy ? ` par ${promotion.createdBy.name}` : ''}`}
      >
        <Link
          className={`${styles.button} ${styles.secondaryButton}`}
          href="/admin/promotions"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Codes promo
        </Link>
      </PageHeader>
      <section className={styles.card} aria-label="Bilan du code">
        <p>
          <Badge value={promotion.state} /> ·{' '}
          <strong>{promotion.uses.consumed}</strong> commande(s) payée(s)
          {promotion.uses.reserved > 0 &&
            ` · ${promotion.uses.reserved} en cours de paiement`}{' '}
          · remise accordée : <strong>{euros(promotion.uses.discount)}</strong>{' '}
          · chiffre d’affaires encaissé :{' '}
          <strong>{euros(promotion.revenue)}</strong>
        </p>
      </section>
      <section className={styles.card}>
        <h2>Réglages</h2>
        <PromotionForm
          locked={used}
          games={games}
          categories={categoryOptions(categories)}
          value={promotionFormValue(promotion)}
        />
      </section>
      <section className={styles.card}>
        <h2>Dernières utilisations</h2>
        {promotion.redemptions.length ? (
          <AdminTable
            caption="Commandes ayant utilisé ce code"
            headings={['Commande', 'Date', 'Remise', 'Total payé', 'État']}
          >
            {promotion.redemptions.map((redemption) => (
              <tr key={redemption.id}>
                <td>
                  <Link href={`/admin/commandes/${redemption.order.id}`}>
                    {redemption.order.orderNumber}
                  </Link>
                </td>
                <td>{formatDate(redemption.createdAt)}</td>
                <td>{euros(redemption.discountAmount)}</td>
                <td>{euros(redemption.order.totalAmount)}</td>
                <td>
                  <Badge value={redemption.status} />
                </td>
              </tr>
            ))}
          </AdminTable>
        ) : (
          <EmptyState>Ce code n’a pas encore servi.</EmptyState>
        )}
      </section>
      {!used && (
        <section className={styles.card}>
          <h2>Supprimer</h2>
          <p className={styles.muted}>
            Un code jamais utilisé peut être supprimé. Un code déjà utilisé se
            désactive.
          </p>
          <AdminForm
            action={deletePromotionAction}
            submit="Supprimer ce code"
            confirm={`Supprimer définitivement le code ${promotion.code} ?`}
          >
            <Hidden name="id" value={promotion.id} />
          </AdminForm>
        </section>
      )}
    </>
  );
}
