export type NewsletterActionState = {
  success: boolean;
  message: string;
  errors?: Record<string, string>;
};

export const initialNewsletterState: NewsletterActionState = {
  success: false,
  message: '',
};

export const NEWSLETTER_CONSENT_VERSION = '2026-09-28';
