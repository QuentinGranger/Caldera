import Link from 'next/link';
import { Mail } from 'lucide-react';
import { FilterPanel } from '@/components/admin/FilterPanel';
import { AdminForm } from '@/components/admin/AdminForm';
import { Hidden } from '@/components/admin/AdminFields';
import { EmptyState, PageHeader, Pagination } from '@/components/admin/AdminUI';
import { customerReplyLink } from '@/emails/reply';
import { messageHandledAction } from '@/lib/admin/actions';
import { formatDate } from '@/lib/admin/format';
import { getAdminMessages } from '@/lib/admin/messages';
import { param, type SearchParams } from '@/lib/admin/queries';
import styles from '@/components/admin/Admin.module.scss';

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const data = await getAdminMessages(params);
  const tabs = [
    { value: 'open', label: 'À traiter', count: data.open },
    { value: 'handled', label: 'Traités' },
    { value: 'all', label: 'Tous' },
  ];
  return (
    <>
      <PageHeader
        title="Messages"
        description="Les messages du formulaire de contact, gardés ici même si l’e-mail ne vous parvient pas. Répondez depuis votre messagerie, puis marquez-les comme traités."
      />
      <nav className={styles.tabs} aria-label="Vues messages">
        {tabs.map((tab) => (
          <Link
            key={tab.value}
            href={
              tab.value === 'open'
                ? '/admin/messages'
                : `/admin/messages?view=${tab.value}`
            }
            aria-current={data.view === tab.value ? 'page' : undefined}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={styles.tabCount}>{tab.count}</span>
            )}
          </Link>
        ))}
      </nav>
      <FilterPanel
        action="/admin/messages"
        search={param(params, 'search')}
        placeholder="Nom, e-mail ou n° de commande"
        keep={{ view: data.view === 'open' ? '' : data.view }}
      />
      {data.messages.length ? (
        <ol className={styles.messages}>
          {data.messages.map((message) => {
            const first = message.name.trim().split(/\s+/)[0];
            return (
              <li
                key={message.id}
                className={styles.card}
                data-handled={message.handledAt ? '' : undefined}
              >
                <div className={styles.panelHeader}>
                  <h2>
                    {message.topic} · {message.name}
                  </h2>
                  <span
                    className={`${styles.badge} ${message.handledAt ? styles.success : styles.pending}`}
                  >
                    {message.handledAt ? 'Traité' : 'À traiter'}
                  </span>
                </div>
                <p className={styles.muted}>
                  <a href={`mailto:${message.email}`}>{message.email}</a> ·{' '}
                  {formatDate(message.createdAt)}
                  {message.orderNumber && (
                    <>
                      {' · commande '}
                      <Link
                        href={`/admin/commandes?search=${encodeURIComponent(message.orderNumber)}`}
                      >
                        {message.orderNumber}
                      </Link>
                    </>
                  )}
                  {!message.emailedAt &&
                    ' · e-mail non parvenu : message gardé ici'}
                  {message.handledAt &&
                    ` · traité le ${formatDate(message.handledAt)}${message.handledBy ? ` par ${message.handledBy.name}` : ''}`}
                </p>
                <blockquote className={styles.quote}>
                  {message.message}
                </blockquote>
                <div className={styles.inline}>
                  <a
                    className={styles.button}
                    href={customerReplyLink({
                      to: message.email,
                      subject: `Votre message : ${message.topic}${message.orderNumber ? ` (commande ${message.orderNumber})` : ''}`,
                      name: message.name,
                      quote: message.message,
                    })}
                  >
                    <Mail size={16} aria-hidden="true" />
                    {first ? `Répondre à ${first}` : 'Répondre'}
                  </a>
                  <AdminForm
                    action={messageHandledAction}
                    submit={
                      message.handledAt ? 'Rouvrir' : 'Marquer comme traité'
                    }
                    guard={false}
                  >
                    <Hidden name="id" value={message.id} />
                    <Hidden
                      name="handled"
                      value={message.handledAt ? 'false' : 'true'}
                    />
                  </AdminForm>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState>
          {data.view === 'open'
            ? 'Aucun message à traiter.'
            : 'Aucun message pour cette vue.'}
        </EmptyState>
      )}
      <Pagination
        page={data.page}
        total={data.total}
        params={params}
        path="/admin/messages"
      />
      <small>
        Dates : Europe/Paris. Un message traité est supprimé un an plus tard.
      </small>
    </>
  );
}
