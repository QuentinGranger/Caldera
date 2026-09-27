import { escapeHtml } from './templates';
import { PRODUCTION_HOST, PRODUCTION_SITE_URL } from '@/lib/site';

export type AccountEmailKind = 'verify' | 'reset' | 'existing';

const COPY: Record<
  AccountEmailKind,
  {
    subject: string;
    title: string;
    body: string[];
    button: string;
    note: string;
  }
> = {
  verify: {
    subject: 'Confirmez votre adresse e-mail',
    title: 'Bienvenue aux Terres de Caldera',
    body: [
      'Votre compte est presque prêt. Confirmez votre adresse e-mail pour vous connecter et retrouver vos commandes.',
    ],
    button: 'Confirmer mon adresse',
    note: 'Ce lien est valable 24 heures. Si vous n’avez pas créé de compte, ignorez ce message : aucun compte ne sera activé.',
  },
  reset: {
    subject: 'Réinitialisation de votre mot de passe',
    title: 'Choisissez un nouveau mot de passe',
    body: [
      'Une réinitialisation du mot de passe de votre compte a été demandée.',
    ],
    button: 'Choisir un nouveau mot de passe',
    note: 'Ce lien est valable 1 heure et ne sert qu’une fois. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.',
  },
  existing: {
    subject: 'Vous avez déjà un compte',
    title: 'Un compte existe déjà avec cette adresse',
    body: [
      'Quelqu’un, sans doute vous, a voulu créer un compte avec cette adresse e-mail. Votre compte existant n’a pas été modifié.',
      'Vous pouvez vous connecter, ou choisir un nouveau mot de passe si vous l’avez oublié.',
    ],
    button: 'Me connecter',
    note: 'Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.',
  },
};

function button(url: string, text: string) {
  return `<a href="${escapeHtml(url)}" style="display:inline-block;margin:12px 0;padding:14px 22px;background:#003c2d;color:#fff;text-decoration:none;border-radius:4px">${escapeHtml(text)}</a>`;
}

/** Transactional account e-mail: no tracking, one link, plain-text twin. */
export function renderAccountEmail(
  kind: AccountEmailKind,
  urls: { action: string; logo: string; reset?: string },
) {
  const copy = COPY[kind];
  const extra =
    kind === 'existing' && urls.reset
      ? `<p><a href="${escapeHtml(urls.reset)}" style="color:#173e32">J’ai oublié mon mot de passe</a></p>`
      : '';
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(copy.subject)}</title></head><body style="margin:0;padding:20px 8px;background:#f6f1e4;font-family:Arial,sans-serif;color:#173e32;line-height:1.6"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fffcf5"><tr><td style="padding:26px;background:#003c2d;border-bottom:3px solid #e8c261"><img src="${escapeHtml(urls.logo)}" width="240" alt="Les Terres de Caldera" style="display:block;max-width:100%;height:auto;color:#f7e9be"></td></tr><tr><td style="padding:24px"><h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.2">${escapeHtml(copy.title)}</h1>${copy.body.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}${button(urls.action, copy.button)}${extra}<p style="font-size:12px;color:#60665d">${escapeHtml(copy.note)}</p></td></tr><tr><td style="padding:20px 24px;border-top:1px solid #d8d5c7;font-size:13px">Les Terres de Caldera<br><a href="${PRODUCTION_SITE_URL}" style="color:#173e32">${PRODUCTION_HOST}</a></td></tr></table></td></tr></table></body></html>`;
  const text = [
    copy.title,
    ...copy.body,
    `${copy.button} : ${urls.action}`,
    ...(kind === 'existing' && urls.reset
      ? [`Mot de passe oublié : ${urls.reset}`]
      : []),
    copy.note,
    'Les Terres de Caldera',
    `Site : ${PRODUCTION_SITE_URL}`,
  ].join('\n\n');
  return { subject: copy.subject, html, text };
}
