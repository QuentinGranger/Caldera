import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { AdminForm } from '@/components/admin/AdminForm';
import { Hidden } from '@/components/admin/AdminFields';
import { AdminTable, PageHeader } from '@/components/admin/AdminUI';
import { param, type SearchParams } from '@/lib/admin/queries';
import { uuid } from '@/lib/admin/validation';
import { getPrisma } from '@/lib/db/prisma';
import { createReturnAction } from '@/lib/returns/admin-actions';
import { returnReasonLabels } from '@/lib/returns/rules';
import { returnableLines } from '@/lib/returns/service';
import styles from '@/components/admin/Admin.module.scss';
import { requireAdmin } from '@/lib/admin/auth';

/** A return agreed by e-mail or phone, recorded from the order. */
export default async function NewReturnPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // The layout's check runs in parallel: never read data before this one.
  await requireAdmin();
  let orderId: string;
  try {
    orderId = uuid(param(await searchParams, 'commande'));
  } catch {
    notFound();
  }
  const db = getPrisma();
  const exists = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true },
  });
  if (!exists || exists.status !== 'PAID') notFound();
  const { order, lines } = await returnableLines(db, orderId);
  return (
    <>
      <PageHeader
        title="Nouveau retour"
        description={`Commande ${order.orderNumber} · ${order.email}. À utiliser pour une demande reçue par e-mail ou téléphone : les délais légaux ne sont pas vérifiés ici.`}
      >
        <Link
          className={`${styles.button} ${styles.secondaryButton}`}
          href={`/admin/commandes/${order.id}`}
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Commande
        </Link>
      </PageHeader>
      <section className={styles.card}>
        <AdminForm action={createReturnAction} submit="Créer le retour">
          <Hidden name="orderId" value={order.id} />
          <div className={styles.fields}>
            <div className={`${styles.full} ${styles.tableWrapper}`}>
              <AdminTable
                caption="Articles retournés"
                headings={['Article', 'Commandé', 'Quantité retournée']}
              >
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td>
                      {line.name}
                      <small>
                        <code>{line.sku}</code>
                      </small>
                    </td>
                    <td>{line.quantity}</td>
                    <td>
                      <label>
                        <span className={styles.visuallyHidden}>
                          Quantité retournée pour {line.name}
                        </span>
                        <input
                          type="number"
                          name={`qty:${line.id}`}
                          min={0}
                          max={line.left}
                          step={1}
                          defaultValue={0}
                          disabled={!line.left}
                        />
                      </label>
                      <small>
                        {line.left ? `${line.left} au plus` : 'Déjà retourné'}
                      </small>
                    </td>
                  </tr>
                ))}
              </AdminTable>
            </div>
            <label>
              Motif
              <select name="reason" defaultValue="WITHDRAWAL">
                {Object.entries(returnReasonLabels).map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input type="checkbox" name="notify" defaultChecked />
              Envoyer l’accusé de réception au client
            </label>
            <label className={styles.full}>
              Demande du client (copie de son message) — facultatif
              <textarea name="message" maxLength={2000} />
            </label>
          </div>
        </AdminForm>
      </section>
    </>
  );
}
