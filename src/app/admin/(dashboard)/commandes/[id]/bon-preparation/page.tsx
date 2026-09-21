import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAdminOrder } from '@/lib/admin/queries';
import { formatDate, label } from '@/lib/admin/format';
import { PrintButton } from '@/components/admin/PrintButton';
import styles from '@/components/admin/PackingSlip.module.scss';

export default async function PackingSlipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const order = await getAdminOrder((await params).id);
  if (
    !order ||
    order.status !== 'PAID' ||
    order.payment?.status !== 'SUCCEEDED'
  )
    notFound();
  const address = order.addresses.find((row) => row.role === 'SHIPPING');
  return (
    <article className={styles.sheet}>
      <div className={styles.actions}>
        <PrintButton />
        <Link href={`/admin/commandes/${order.id}`}>Retour à la commande</Link>
      </div>
      <p>Les Terres de Caldera</p>
      <h1>Bon de préparation</h1>
      <h2>{order.orderNumber}</h2>
      <p>Payée le {formatDate(order.paidAt)}</p>
      <p>
        Mode de livraison : <strong>{order.shippingMethodName}</strong>
      </p>
      {address && (
        <address>
          {address.firstName} {address.lastName}
          <br />
          {address.company && (
            <>
              {address.company}
              <br />
            </>
          )}
          {address.addressLine1}
          <br />
          {address.addressLine2 && (
            <>
              {address.addressLine2}
              <br />
            </>
          )}
          {address.postalCode} {address.city}
          <br />
          {address.region && (
            <>
              {address.region}
              <br />
            </>
          )}
          {address.countryCode}
        </address>
      )}
      {order.pickupPoint && (
        <section>
          <h2>Point de retrait</h2>
          <p>
            {order.pickupPoint.name} — {order.pickupPoint.pointId}
            <br />
            {order.pickupPoint.address1}
            <br />
            {order.pickupPoint.postalCode} {order.pickupPoint.city}
          </p>
        </section>
      )}
      <div className={styles.tableWrapper}>
        <table>
          <caption>Articles à préparer</caption>
          <thead>
            <tr>
              <th>Article</th>
              <th>SKU / langue</th>
              <th>Quantité</th>
              <th>Vérifié</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <Image src={item.imageUrl} alt="" width={50} height={60} />
                  <span>{item.productName}</span>
                </td>
                <td>
                  <strong>{item.sku}</strong>
                  <br />
                  {label(item.language)}
                </td>
                <td>
                  <strong>{item.quantity}</strong>
                </td>
                <td>
                  <span
                    className={styles.checkbox}
                    aria-label="Case de vérification sur papier"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>Préparé par : ____________________ &nbsp; Date : ______________</p>
      <small>
        Document de préparation interne. Ce document n’est pas une facture.
      </small>
    </article>
  );
}
