import { emailLayout } from './layout';
import { EMAIL_SOCIAL_LINKS_TEXT } from './social-links';
import { escapeHtml } from './templates';

export type AdminEmailKind = 'reset' | 'password-changed';

const COPY: Record<
  AdminEmailKind,
  { subject: string; title: string; body: string; button: string; note: string }
> = {
  reset: {
    subject: 'Nouveau mot de passe pour le back-office Caldera',
    title: 'Choisissez un nouveau mot de passe',
    body: 'Une réinitialisation de l’accès au back-office Caldera a été demandée.',
    button: 'Changer mon mot de passe',
    note: 'Ce lien est valable une heure, ne sert qu’une fois et remplace tout lien envoyé avant lui. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.',
  },
  'password-changed': {
    subject: 'Mot de passe du back-office Caldera modifié',
    title: 'Mot de passe modifié',
    body: 'Le mot de passe de votre accès au back-office Caldera vient d’être modifié. Toutes les sessions ouvertes ont été fermées.',
    button: 'Me connecter',
    note: 'Si vous n’êtes pas à l’origine de ce changement, demandez immédiatement un nouveau lien depuis « Mot de passe oublié » et vérifiez le journal d’audit.',
  },
};

/** Back-office account e-mail: plain-text twin, no tracking. */
export function renderAdminAccountEmail(
  kind: AdminEmailKind,
  urls: { action: string; logo: string },
) {
  const copy = COPY[kind];
  const html = emailLayout({
    subject: copy.subject,
    logo: urls.logo,
    label: 'Administration · Sécurité',
    content: `<p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6441c8">Administration</p><h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.2">${escapeHtml(copy.title)}</h1><p>${escapeHtml(copy.body)}</p><a href="${escapeHtml(urls.action)}" style="display:inline-block;margin:12px 0;padding:14px 22px;background:#6441c8;color:#fff;text-decoration:none;border-radius:4px">${escapeHtml(copy.button)}</a><p style="font-size:12px;color:#60665d">${escapeHtml(copy.note)}</p>`,
  });
  const text = [
    'Administration Caldera',
    copy.title,
    copy.body,
    `${copy.button} : ${urls.action}`,
    copy.note,
    'Les Terres de Caldera',
    EMAIL_SOCIAL_LINKS_TEXT,
  ].join('\n\n');
  return { subject: copy.subject, html, text };
}

/** Kept for the existing callers and tests. */
export function renderAdminPasswordResetEmail(urls: {
  action: string;
  logo: string;
}) {
  return renderAdminAccountEmail('reset', urls);
}
