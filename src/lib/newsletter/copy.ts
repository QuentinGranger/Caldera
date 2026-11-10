/** Shared wording for the signup, its invitations and the confirmation e-mail. */
export function newsletterCopy(preparing: boolean) {
  return preparing
    ? {
        title: 'Soyez prévenu de l’ouverture.',
        headingStart: 'Soyez prévenu',
        headingEnd: 'de l’ouverture.',
        lead: 'L’annonce d’ouverture, puis les nouvelles essentielles de Caldera.',
        shortLead: 'L’ouverture, puis les nouvelles de Caldera, par e-mail.',
        button: 'Me prévenir de l’ouverture',
        consent:
          'J’accepte de recevoir l’annonce d’ouverture, puis les sorties, réassorts et sélections de Caldera par e-mail.',
        confirmation:
          'Confirmez votre adresse e-mail pour recevoir l’annonce d’ouverture, puis les sorties, réassorts et sélections des Terres de Caldera.',
      }
    : {
        title: 'Les nouvelles de Caldera.',
        headingStart: 'Les sorties Pokémon,',
        headingEnd: 'sans avoir à les guetter.',
        lead: 'Sorties, réassorts et sélections de Caldera, par e-mail.',
        shortLead: 'Sorties, réassorts et sélections, par e-mail.',
        button: 'Recevoir les nouvelles',
        consent:
          'J’accepte de recevoir les sorties, réassorts et sélections de Caldera par e-mail.',
        confirmation:
          'Confirmez votre adresse e-mail pour recevoir les sorties, réassorts et sélections des Terres de Caldera.',
      };
}
