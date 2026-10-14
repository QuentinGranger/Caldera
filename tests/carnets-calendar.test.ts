import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { carnetMonth } from '../src/lib/carnets/calendar-month';
import { carnetCalendarStatus } from '../src/lib/carnets/calendar-status';
import { carnetReadiness } from '../src/lib/carnets/readiness';
import { carnetPublicDate } from '../src/lib/carnets/dates';

const date = new Date('2026-11-01T07:00:00Z');
const campaign = {
  id: randomUUID(),
  status: 'DRAFT' as const,
  subject: 'Carnet',
  preheader: 'Extrait',
  updatedAt: new Date('2026-10-01T08:00:00Z'),
};
const chapter = {
  id: randomUUID(),
  status: 'READY' as const,
  revision: 2,
  updatedAt: campaign.updatedAt,
  illustrationUrl: '/illustration.webp',
  illustrationAlt: 'La forêt',
  earlyAccessAt: date,
  publicAt: carnetPublicDate(date),
  publishedAt: null,
  releaseCampaignId: null,
  editionCampaignId: campaign.id,
  content: {
    version: 1,
    document: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Un extrait réel.' }],
        },
        { type: 'newsletterCut' },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'La suite du récit.' }],
        },
      ],
    },
  },
};
const proof = {
  createdAt: new Date('2026-10-02T08:00:00Z'),
  metadata: {
    chapterRevision: 2,
    campaignUpdatedAt: campaign.updatedAt.toISOString(),
  },
};
const ready = carnetReadiness(chapter, campaign, [], proof);
test('Mois Paris : année suivante, entrée invalide et bornes de navigation', () => {
  assert.equal(carnetMonth('2027-01').previous, '2026-12');
  assert.equal(carnetMonth('2026-12').next, '2027-01');
  assert.equal(
    carnetMonth('2026-13', new Date('2026-10-31T23:30:00Z')).value,
    '2026-11',
  );
  assert.equal(
    carnetMonth(['2026-12'], new Date('2026-10-31T23:30:00Z')).value,
    '2026-11',
  );
  assert.equal(carnetMonth('2000-01').previous, null);
  assert.equal(carnetMonth('2099-12').next, null);
});
test('Mois Paris : limites civiles du mois contenant un changement d’heure', () => {
  const month = carnetMonth('2026-03');
  assert.equal(month.start.toISOString(), '2026-02-28T23:00:00.000Z');
  assert.equal(month.end.toISOString(), '2026-03-31T22:00:00.000Z');
});
test('États éditoriaux : brouillon, texte prêt, prêt à envoyer sans produits obligatoires', () => {
  assert.equal(
    carnetCalendarStatus(chapter, campaign, null, ready),
    'Prêt à envoyer',
  );
  assert.equal(
    carnetCalendarStatus(chapter, campaign, null, {
      ...ready,
      testCurrent: false,
    }),
    'Texte prêt',
  );
  assert.equal(
    carnetCalendarStatus(chapter, campaign, null, {
      ...ready,
      illustrationReady: false,
    }),
    'Texte prêt',
  );
  assert.equal(
    carnetCalendarStatus(chapter, campaign, null, {
      ...ready,
      chapterReady: false,
    }),
    'Brouillon',
  );
  const invalid = carnetReadiness(
    { ...chapter, content: {} },
    campaign,
    [],
    proof,
  );
  assert.equal(invalid.chapterReady, false);
  assert.equal(invalid.excerptReady, false);
});
test('Stock réel, statut du chapitre et preuve de test périmée empêchent Prêt à envoyer', () => {
  const stale = carnetReadiness(
    { ...chapter, revision: 3 },
    campaign,
    [],
    proof,
  );
  assert.equal(stale.testCurrent, false);
  assert.equal(
    carnetCalendarStatus(chapter, campaign, null, stale),
    'Texte prêt',
  );
  const noStock = carnetReadiness(
    chapter,
    campaign,
    [{ name: 'ETB', eligible: false, unavailableReason: 'épuisé' }],
    proof,
  );
  assert.equal(
    carnetCalendarStatus(chapter, campaign, null, noStock),
    'Texte prêt',
  );
  const draft = carnetReadiness(
    { ...chapter, status: 'DRAFT' },
    campaign,
    [],
    proof,
  );
  assert.equal(
    carnetCalendarStatus(
      { ...chapter, status: 'DRAFT' },
      campaign,
      null,
      draft,
    ),
    'Brouillon',
  );
});
test('Dates prévisionnelles, vraie programmation et limites exactes d’accès/publication', () => {
  const before = new Date(date.getTime() - 1),
    release = { id: campaign.id, status: 'QUEUED' as const };
  assert.equal(
    carnetCalendarStatus(chapter, campaign, null, ready, chapter.publicAt),
    'Prêt à envoyer',
  );
  assert.equal(
    carnetCalendarStatus(
      { ...chapter, releaseCampaignId: release.id },
      release,
      release,
      ready,
      before,
    ),
    'Programmé',
  );
  assert.equal(
    carnetCalendarStatus(
      { ...chapter, releaseCampaignId: release.id },
      release,
      release,
      ready,
      date,
    ),
    'Accès anticipé',
  );
  assert.equal(
    carnetCalendarStatus(
      { ...chapter, releaseCampaignId: release.id },
      release,
      release,
      ready,
      chapter.publicAt,
    ),
    'Public',
  );
  const outOfStock = {
    ...ready,
    unavailable: [{ name: 'ETB', reason: 'épuisé' }],
  };
  assert.equal(
    carnetCalendarStatus(
      { ...chapter, releaseCampaignId: release.id },
      release,
      release,
      outOfStock,
      chapter.publicAt,
    ),
    'Public',
  );
  assert.equal(
    carnetCalendarStatus(chapter, release, null, ready, before),
    'Texte prêt',
  );
});
