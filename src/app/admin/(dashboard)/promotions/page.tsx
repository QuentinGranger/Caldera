import Link from 'next/link';
import { Plus } from 'lucide-react';
import { FilterPanel } from '@/components/admin/FilterPanel';
import {
  AdminTable,
  Badge,
  EmptyState,
  FilterSelect,
  PageHeader,
} from '@/components/admin/AdminUI';
import { euros, formatDate, label } from '@/lib/admin/format';
import { param, type SearchParams } from '@/lib/admin/queries';
import { getAdminPromotions } from '@/lib/promotions/admin';
import { describePromotion } from '@/lib/promotions/pricing';
import { toCents } from '@/lib/refunds/amounts';
import styles from '@/components/admin/Admin.module.scss';
import { requireAdmin } from '@/lib/admin/auth';

const states = [
  'PROMO_ACTIVE',
  'PROMO_SCHEDULED',
  'PROMO_EXHAUSTED',
  'PROMO_EXPIRED',
  'PROMO_DISABLED',
];

export default async function AdminPromotionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // The layout's check runs in parallel: never read data before this one.
  await requireAdmin();
  const params = await searchParams;
  const promotions = await getAdminPromotions(params);
  return (
    <>
      <PageHeader
        title="Codes promo"
        description="Créez des réductions à saisir au paiement : pourcentage, montant fixe ou livraison offerte, avec dates, limites d’utilisation et restriction à un jeu ou une catégorie."
      >
        <Link className={styles.button} href="/admin/promotions/nouvelle">
          <Plus size={16} aria-hidden="true" />
          Nouveau code
        </Link>
      </PageHeader>
      <FilterPanel
        action="/admin/promotions"
        search={param(params, 'search')}
        placeholder="Code ou libellé"
        activeCount={param(params, 'state') ? 1 : 0}
      >
        <FilterSelect
          name="state"
          label="État"
          value={param(params, 'state')}
          options={states.map((value) => ({ value, label: label(value) }))}
        />
      </FilterPanel>
      {promotions.length ? (
        <AdminTable
          caption="Codes promo"
          headings={[
            'Code',
            'Réduction',
            'Validité',
            'Utilisations',
            'Remise accordée',
            'État',
          ]}
        >
          {promotions.map((promotion) => (
            <tr key={promotion.id}>
              <td>
                <Link href={`/admin/promotions/${promotion.id}`}>
                  <code>{promotion.code}</code>
                </Link>
                <small>{promotion.label}</small>
              </td>
              <td>
                {describePromotion({
                  type: promotion.type,
                  percentOff: promotion.percentOff,
                  amountOffCents: promotion.amountOff
                    ? toCents(promotion.amountOff)
                    : null,
                })}
                {promotion.minimumSubtotal && (
                  <small>dès {euros(promotion.minimumSubtotal)}</small>
                )}
                {(promotion.game || promotion.category) && (
                  <small>
                    {[promotion.game?.name, promotion.category?.name]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                )}
              </td>
              <td>
                <small>
                  {promotion.startsAt
                    ? `Du ${formatDate(promotion.startsAt)}`
                    : 'Dès maintenant'}
                </small>
                <small>
                  {promotion.endsAt
                    ? `Jusqu’au ${formatDate(promotion.endsAt)}`
                    : 'Sans fin'}
                </small>
              </td>
              <td>
                {promotion.uses.consumed}
                {promotion.maxRedemptions !== null &&
                  ` / ${promotion.maxRedemptions}`}
                {promotion.uses.reserved > 0 && (
                  <small>+ {promotion.uses.reserved} en cours de paiement</small>
                )}
              </td>
              <td>{euros(promotion.uses.discount)}</td>
              <td>
                <Badge value={promotion.state} />
              </td>
            </tr>
          ))}
        </AdminTable>
      ) : (
        <EmptyState>Aucun code promo pour ces critères.</EmptyState>
      )}
    </>
  );
}
