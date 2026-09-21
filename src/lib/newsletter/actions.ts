'use server';

import { after } from 'next/server';
import { sendNewsletterWelcome } from './email';
import { NewsletterValidationError, subscribeToNewsletter } from './service';

export type NewsletterActionState = {
  success: boolean;
  message: string;
};

export async function subscribeNewsletterAction(
  _previous: NewsletterActionState,
  formData: FormData,
): Promise<NewsletterActionState> {
  if (String(formData.get('website') ?? '').trim()) {
    return {
      success: true,
      message: 'Votre inscription est bien enregistrée.',
    };
  }

  if (formData.get('consent') !== 'on') {
    return {
      success: false,
      message: 'Votre accord est nécessaire pour recevoir la newsletter.',
    };
  }

  try {
    const { subscription, activated } = await subscribeToNewsletter(
      String(formData.get('email') ?? ''),
    );

    if (activated && process.env.EMAILS_ENABLED === 'true') {
      after(async () => {
        await sendNewsletterWelcome(subscription);
      });
    }

    return {
      success: true,
      message: 'Bienvenue dans l’expédition ! Votre inscription est confirmée.',
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof NewsletterValidationError
          ? error.message
          : 'Inscription momentanément indisponible. Réessayez plus tard.',
    };
  }
}
