import { getPrisma } from '../../src/lib/db/prisma';
import { chapterComptoir } from '../../src/lib/carnets/comptoir';
import { carnetTestSignature } from '../../src/lib/carnets/verification-server';
/** Disposable audit fixture for tests unrelated to the actual mail provider. */
export async function carnetTestProof(adminId: string, campaignId: string) {
  if (
    process.env.NODE_ENV === 'production' ||
    !['localhost', '127.0.0.1'].includes(
      new URL(process.env.DATABASE_URL!).hostname,
    )
  )
    throw Error('Local QA only');
  const db = getPrisma(),
    campaign = await db.newsletterCampaign.findUniqueOrThrow({
      where: { id: campaignId },
      include: { chapter: true },
    });
  if (!campaign.chapter) throw Error('Chapter required');
  const products = await chapterComptoir(db, campaign.chapter.id, false);
  await db.adminAuditLog.create({
    data: {
      adminUserId: adminId,
      action: 'NEWSLETTER_CAMPAIGN_TEST_SENT',
      entityType: 'NewsletterCampaign',
      entityId: campaignId,
      metadata: {
        chapterRevision: campaign.chapter.revision,
        campaignUpdatedAt: campaign.updatedAt.toISOString(),
        carnetTestSignature: carnetTestSignature(
          campaign.chapter,
          campaign,
          products,
        ),
      },
    },
  });
}
