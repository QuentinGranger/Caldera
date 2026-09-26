// Input limits shared by the admin forms and their server validation. Pure module:
// safe in client components.

/** createSlug (src/lib/catalog/createSlug.ts) never builds a longer slug. */
export const SLUG_MAX_LENGTH = 100;
export const SEO_TITLE_MAX_LENGTH = 70;
export const SEO_DESCRIPTION_MAX_LENGTH = 170;
export const INTRO_MAX_LENGTH = 20000;
export const FAQ_MAX_LENGTH = 20000;
export const FAQ_MAX_ENTRIES = 30;
export const FAQ_QUESTION_MAX_LENGTH = 300;
export const FAQ_ANSWER_MAX_LENGTH = 2000;
export const GAME_DESCRIPTION_MAX_LENGTH = 300;
export const GAME_SHORT_NAME_MAX_LENGTH = 50;
/** One line per entry in the FAQ textarea: « Question :: Réponse ». */
export const FAQ_SEPARATOR = '::';
