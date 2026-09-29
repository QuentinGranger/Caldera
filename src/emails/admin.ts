import { PRODUCTION_HOST, PRODUCTION_SITE_URL } from '@/lib/site';
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

/** Back-office account e-mail: one link, plain-text twin, no tracking. */
export function renderAdminAccountEmail(
  kind: AdminEmailKind,
  urls: { action: string; logo: string },
) {
  const copy = COPY[kind];
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(copy.subject)}</title></head><body style="margin:0;padding:20px 8px;background:#f0eee7;font-family:Arial,sans-serif;color:#25243a;line-height:1.6"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fffef9"><tr><td style="padding:26px;background:#003c2d;border-bottom:3px solid #e8c261"><img src="${escapeHtml(urls.logo)}" width="240" alt="Les Terres de Caldera" style="display:block;max-width:100%;height:auto;color:#f7e9be"></td></tr><tr><td style="padding:24px"><p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6441c8">Administration</p><h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.2">${escapeHtml(copy.title)}</h1><p>${escapeHtml(copy.body)}</p><a href="${escapeHtml(urls.action)}" style="display:inline-block;margin:12px 0;padding:14px 22px;background:#6441c8;color:#fff;text-decoration:none;border-radius:4px">${escapeHtml(copy.button)}</a><p style="font-size:12px;color:#60665d">${escapeHtml(copy.note)}</p></td></tr><tr><td style="padding:20px 24px;border-top:1px solid #d8d5c7;font-size:13px">Les Terres de Caldera<br><a href="${PRODUCTION_SITE_URL}" style="color:#173e32">${PRODUCTION_HOST}</a></td></tr></table></td></tr></table></body></html>`;
  const text = [
    'Administration Caldera',
    copy.title,
    copy.body,
    `${copy.button} : ${urls.action}`,
    copy.note,
    'Les Terres de Caldera',
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
