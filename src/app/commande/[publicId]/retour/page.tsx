import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PackageOpen } from 'lucide-react';
import { Container } from '@/components/ui/Container/Container';
import { ReturnRequestForm } from '@/components/returns/ReturnRequestForm';
import { getCartCookie } from '@/lib/cart/cartCookie';
import { getPrisma } from '@/lib/db/prisma';
import { getCustomerOrder } from '@/lib/orders/queries';
import {
  canReportProblem,
  canWithdraw,
  returnStatusCustomerLabels,
  withdrawalDeadline,
} from '@/lib/returns/rules';
import { returnableLines } from '@/lib/returns/service';
import page from '@/components/newsletter/NewsletterPage.module.scss';
import styles from '@/components/returns/Returns.module.scss';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Retour ou rétractation',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

const day = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeZone: 'Europe/Paris',
});

export default async function OrderReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ access?: string }>;
}) {
  const { publicId } = await params;
  const access = (await searchParams).access ?? '';
  const order = await getCustomerOrder(publicId, await getCartCookie(), access);
  if (!order || order.status !== 'PAID') notFound();
  const db = getPrisma();
  const [{ lines }, history] = await Promise.all([
    returnableLines(db, order.id),
    db.returnRequest.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        number: true,
        status: true,
        createdAt: true,
        replacement: {
          select: {
            carrierName: true,
            trackingNumber: true,
            trackingUrl: true,
          },
        },
      },
    }),
  ]);
  const withdraw = canWithdraw(order.deliveredAt);
  const report = canReportProblem(order);
  const deadline = withdrawalDeadline(order.deliveredAt);
  const back = `/commande/${publicId}${access ? `?access=${encodeURIComponent(access)}` : ''}`;
  const open = lines.some((line) => line.left > 0) && (withdraw || report);
  return (
    <main id="contenu" tabIndex={-1} className={page.main}>
      <Container>
        <section className={page.card} aria-labelledby="retour-titre">
          <PackageOpen size={38} strokeWidth={1.5} aria-hidden="true" />
          <p className={page.eyebrow}>Commande {order.orderNumber}</p>
          <h1 id="retour-titre">Retour ou rétractation</h1>
          <p className={page.lead}>
            {withdraw
              ? deadline
                ? `Vous pouvez vous rétracter sans justification jusqu’au ${day.format(new Date(deadline.getTime() - 1))} inclus.`
                : 'Vous pouvez vous rétracter sans justification jusqu’à 14 jours après la réception de votre colis.'
              : 'Le délai de rétractation de 14 jours est passé. Un article abîmé, défectueux ou différent de votre commande reste couvert par la garantie légale.'}{' '}
            Les frais de retour sont à votre charge, sauf erreur ou défaut de
            notre part (<Link href="/cgv#article-12">CGV, articles 12 à 14</Link>
            ).
          </p>
          {history.length > 0 && (
            <ul className={styles.history} aria-label="Vos demandes">
              {history.map((request) => (
                <li key={request.id}>
                  <span>
                    <strong>{request.number}</strong>{' '}
                    <small>du {day.format(request.createdAt)}</small>
                  </span>
                  <span>
                    {returnStatusCustomerLabels[request.status]}
                    {request.replacement && (
                      <small className={styles.tracking}>
                        {request.replacement.carrierName}
                        {request.replacement.trackingNumber &&
                          ` · suivi ${request.replacement.trackingNumber}`}
                        {request.replacement.trackingUrl && (
                          <>
                            {' · '}
                            <a
                              href={request.replacement.trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Suivre le colis
                            </a>
                          </>
                        )}
                      </small>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <ReturnRequestForm
            publicId={publicId}
            access={access}
            lines={lines.map((line) => ({
              id: line.id,
              name: line.name,
              quantity: line.quantity,
              left: line.left,
            }))}
            canWithdraw={withdraw}
            canReport={report}
            closed={!open}
          />
          <p className={page.back}>
            <Link href={back}>Retour à la commande</Link>
          </p>
        </section>
      </Container>
    </main>
  );
}
