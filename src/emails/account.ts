import { emailLayout, emailText } from './layout';
import { EMAIL_SOCIAL_LINKS_TEXT } from './social-links';
import { escapeHtml } from './templates';
import { PRODUCTION_SITE_URL } from '@/lib/site';

export type AccountEmailKind =
  'verify' | 'reset' | 'existing' | 'password-changed';

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
      'Caldera vous accompagne dans le choix de vos produits du JCC Pokémon. Votre compte vous permettra de retrouver vos favoris, vos alertes stock et vos commandes.',
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
  'password-changed': {
    subject: 'Votre mot de passe a été modifié',
    title: 'Mot de passe modifié',
    body: [
      'Le mot de passe de votre compte Les Terres de Caldera vient d’être modifié. Vos autres appareils ont été déconnectés.',
    ],
    button: 'Me connecter',
    note: 'Si vous n’êtes pas à l’origine de ce changement, choisissez immédiatement un nouveau mot de passe avec le lien ci-dessus « mot de passe oublié » et prévenez-nous depuis la page contact du site.',
  },
};

function button(url: string, text: string) {
  return `<a href="${escapeHtml(url)}" style="display:inline-block;margin:12px 0;padding:14px 22px;background:#003c2d;color:#fff;text-decoration:none;border-radius:4px">${escapeHtml(text)}</a>`;
}

/** Transactional account e-mail: no tracking, plain-text twin. */
export function renderAccountEmail(
  kind: AccountEmailKind,
  urls: { action: string; logo: string; reset?: string },
) {
  const copy = COPY[kind];
  const extra =
    (kind === 'existing' || kind === 'password-changed') && urls.reset
      ? `<p><a href="${escapeHtml(urls.reset)}" style="color:#173e32">${kind === 'existing' ? 'J’ai oublié mon mot de passe' : 'Ce n’était pas moi : mot de passe oublié'}</a></p>`
      : '';
  const html = emailLayout({
    subject: copy.subject,
    logo: urls.logo,
    label: 'Votre espace Caldera',
    content: `<h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.2">${escapeHtml(copy.title)}</h1>${copy.body.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}${button(urls.action, copy.button)}${extra}<p style="font-size:12px;color:#60665d">${escapeHtml(copy.note)}</p>`,
  });
  const text = [
    copy.title,
    ...copy.body,
    `${copy.button} : ${urls.action}`,
    ...((kind === 'existing' || kind === 'password-changed') && urls.reset
      ? [`Mot de passe oublié : ${urls.reset}`]
      : []),
    copy.note,
    'Les Terres de Caldera',
    `Site : ${PRODUCTION_SITE_URL}`,
    EMAIL_SOCIAL_LINKS_TEXT,
  ].join('\n\n');
  return { subject: copy.subject, html, text: emailText(text) };
}
